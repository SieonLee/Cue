import type { ActionId } from "../coach/actions";
import type { CoachContext } from "../types/models";
import { extractFeatures } from "./features";

/**
 * Thompson Sampling with hierarchical smoothing.
 * Includes Beta sampling, credible intervals, P(best), and confidence scores.
 */
export type BetaParams = { alpha: number; beta: number };

export type ActionScore = {
  action: ActionId;
  mean: number;          // posterior mean: α / (α+β)
  ci: [number, number];  // 90% credible interval
  pBest: number;         // P(this action is best) via MC
  confidence: number;    // 0-100%, higher = more data
  pulls: number;         // total observations (α+β-2)
  alpha: number;
  beta: number;
};

export function bucketKey(ctx: CoachContext): string {
  return extractFeatures(ctx).join("|");
}

/**
 * Legacy bucket key (without time-of-day and day-type segments).
 * Used as fallback when no data exists for the full key.
 */
export function legacyBucketKey(ctx: CoachContext): string {
  const features = extractFeatures(ctx);
  // Remove last 2 segments (timeOfDay, dayType) for backward compatibility
  return features.slice(0, -2).join("|");
}

/** Standard normal via Box-Muller transform */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Gamma(shape, 1) sampler — Marsaglia-Tsang method for shape >= 1,
 * with Ahrens-Dieter transformation for shape < 1.
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Gamma(a) = Gamma(a+1) * U^(1/a) for a < 1
    const g = sampleGamma(shape + 1);
    return g * Math.pow(Math.random(), 1 / shape);
  }
  // Marsaglia-Tsang for shape >= 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Sample from Beta(alpha, beta) distribution */
function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0) alpha = 0.01;
  if (beta <= 0) beta = 0.01;
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  if (x + y === 0) return 0.5;
  return x / (x + y);
}

/**
 * Beta quantile via bisection search.
 * Returns x such that P(X <= x) ≈ p for X ~ Beta(a, b).
 * Uses regularized incomplete beta function approximation.
 */
function betaQuantile(a: number, b: number, p: number): number {
  // Use MC sampling for quantile estimation (fast enough for mobile)
  const N = 500;
  const samples: number[] = [];
  for (let i = 0; i < N; i++) samples.push(sampleBeta(a, b));
  samples.sort((x, y) => x - y);
  const idx = Math.min(Math.floor(p * N), N - 1);
  return samples[idx];
}

/**
 * 90% equal-tailed credible interval for Beta(α, β).
 */
export function credibleInterval(alpha: number, beta: number): [number, number] {
  return [betaQuantile(alpha, beta, 0.05), betaQuantile(alpha, beta, 0.95)];
}

/**
 * Estimate P(each action is best) via Monte Carlo simulation.
 * Returns a map: actionId → probability of being the best action.
 */
export function computePBest(
  candidates: ActionId[],
  table: Record<string, BetaParams>,
  nSim: number = 2000,
): Record<ActionId, number> {
  const wins: Record<string, number> = {};
  for (const a of candidates) wins[a] = 0;

  for (let i = 0; i < nSim; i++) {
    let bestVal = -1;
    let bestAction = candidates[0];
    for (const a of candidates) {
      const p = table[a] ?? { alpha: 1, beta: 1 };
      const s = sampleBeta(p.alpha, p.beta);
      if (s > bestVal) { bestVal = s; bestAction = a; }
    }
    wins[bestAction]++;
  }

  const result: Record<string, number> = {};
  for (const a of candidates) result[a] = wins[a] / nSim;
  return result as Record<ActionId, number>;
}

/**
 * Confidence score: 0–100%.
 * Based on how tight the credible interval is and how many observations we have.
 * - More data → tighter CI → higher confidence
 * - Uses a sigmoid-like function of total pulls
 */
export function confidenceScore(alpha: number, beta: number): number {
  const pulls = Math.max(0, alpha + beta - 2); // subtract prior
  // Sigmoid: approaches 100% as pulls grow
  // At 5 pulls: ~50%, at 10: ~73%, at 20: ~90%, at 50: ~98%
  const dataPart = 1 - Math.exp(-pulls / 10);
  // CI width part: narrower = more confident
  const ci = credibleInterval(alpha, beta);
  const width = ci[1] - ci[0];
  const ciPart = Math.max(0, 1 - width);
  // Weighted combination
  return Math.round(((dataPart * 0.6 + ciPart * 0.4)) * 100);
}

/**
 * 3-level hierarchy:
 *   L0: global (all data)
 *   L1: by intent
 *   L2: full bucket key
 *
 * If full bucket has < 3 observations, blend with higher level.
 * Smoothing weights: empirical Bayes-inspired, proportional to data count.
 */
function getSmoothedParams(
  ctx: CoachContext,
  action: ActionId,
  params: Record<string, Record<ActionId, BetaParams>>,
): BetaParams {
  // Full bucket key (with time-of-day + day-type)
  const fullKey = bucketKey(ctx);
  const full = params[fullKey]?.[action] ?? { alpha: 1, beta: 1 };
  const fullN = full.alpha + full.beta - 2;

  if (fullN >= 5) return full; // enough data at full resolution

  // Legacy fallback: try key without time segments
  const legKey = legacyBucketKey(ctx);
  if (legKey !== fullKey) {
    const legacy = params[legKey]?.[action];
    if (legacy) {
      const legN = legacy.alpha + legacy.beta - 2;
      if (legN >= 5) return legacy;
      // Blend legacy data into full bucket calculation
      if (legN > fullN) {
        return { alpha: full.alpha + legacy.alpha - 1, beta: full.beta + legacy.beta - 1 };
      }
    }
  }

  // L1: aggregate by intent
  let l1Alpha = 1, l1Beta = 1;
  for (const [k, table] of Object.entries(params)) {
    if (k.includes(`|${ctx.intent}|`)) {
      const p = table[action];
      if (p) { l1Alpha += p.alpha - 1; l1Beta += p.beta - 1; }
    }
  }

  // L0: global aggregate
  let l0Alpha = 1, l0Beta = 1;
  for (const table of Object.values(params)) {
    const p = table[action];
    if (p) { l0Alpha += p.alpha - 1; l0Beta += p.beta - 1; }
  }

  // Blend: weight by data count with diminishing returns
  const wFull = Math.min(fullN / 5, 1);    // 0→1 as fullN reaches 5
  const wL1 = (1 - wFull) * 0.6;
  const wL0 = (1 - wFull) * 0.4;

  const blendedAlpha = wFull * full.alpha + wL1 * l1Alpha + wL0 * l0Alpha;
  const blendedBeta = wFull * full.beta + wL1 * l1Beta + wL0 * l0Beta;

  return { alpha: Math.max(1, blendedAlpha), beta: Math.max(1, blendedBeta) };
}

/**
 * Rank actions using Thompson Sampling with full Bayesian analytics.
 * Returns both ranked action IDs and detailed scores.
 */
export function rankActionsWithScores(
  ctx: CoachContext,
  candidates: ActionId[],
  params: Record<string, Record<ActionId, BetaParams>>,
): ActionScore[] {
  const key = bucketKey(ctx);
  const table = params[key] ?? {};

  // Get smoothed params for each candidate
  const smoothed: Record<string, BetaParams> = {};
  for (const a of candidates) {
    smoothed[a] = getSmoothedParams(ctx, a, params);
  }

  // P(best) via MC
  const pBest = computePBest(candidates, smoothed);

  // Sample and score
  const scored: ActionScore[] = candidates.map((a) => {
    const p = smoothed[a];
    const sample = sampleBeta(p.alpha, p.beta);
    const mean = p.alpha / (p.alpha + p.beta);
    const ci = credibleInterval(p.alpha, p.beta);
    const pulls = Math.max(0, Math.round(p.alpha + p.beta - 2));
    const conf = confidenceScore(p.alpha, p.beta);

    return {
      action: a,
      mean,
      ci,
      pBest: pBest[a] ?? 0,
      confidence: conf,
      pulls,
      alpha: p.alpha,
      beta: p.beta,
      _sample: sample, // for sorting only
    } as ActionScore & { _sample: number };
  });

  // Sort by Thompson sample (exploration-exploitation)
  scored.sort((a, b) => (b as any)._sample - (a as any)._sample);
  // Clean up internal field
  return scored.map(({ ...s }) => { delete (s as any)._sample; return s; });
}

/**
 * Simple rank (backward compatible) — returns just action IDs.
 */
export function rankActionsTS(
  ctx: CoachContext,
  candidates: ActionId[],
  params: Record<string, Record<ActionId, BetaParams>>,
): ActionId[] {
  return rankActionsWithScores(ctx, candidates, params).map((s) => s.action);
}

export const DEFAULT_DECAY = 1.0;

export function updateTS(
  ctx: CoachContext,
  action: ActionId,
  reward: number,
  params: Record<string, Record<ActionId, BetaParams>>,
  decayFactor: number = DEFAULT_DECAY,
): Record<string, Record<ActionId, BetaParams>> {
  const key = bucketKey(ctx);
  const next = { ...params };
  const table = { ...(next[key] ?? {}) };

  // Apply decay to ALL actions in this bucket (non-stationary adaptation)
  const decayed: Record<string, BetaParams> = {};
  for (const [a, p] of Object.entries(table)) {
    decayed[a] = {
      alpha: Math.max(1, (p as BetaParams).alpha * decayFactor),
      beta:  Math.max(1, (p as BetaParams).beta  * decayFactor),
    };
  }

  const cur = decayed[action] ?? { alpha: 1, beta: 1 };
  decayed[action] = { alpha: cur.alpha + reward, beta: cur.beta + (1 - reward) };
  next[key] = decayed as Record<ActionId, BetaParams>;

  // Snapshot params for model history tracking
  snapshotIfNeeded(next);

  return next;
}

/**
 * Save a weekly snapshot of bandit parameters for model evolution tracking.
 * Stored in settings as JSON: { weekKey: { actionId: { alpha, beta } } }
 */
function snapshotIfNeeded(params: Record<string, Record<ActionId, BetaParams>>) {
  try {
    const { getSetting, setSetting } = require("../db/sessions");
    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const historyRaw = getSetting("model_history") ?? "{}";
    const history = JSON.parse(historyRaw);

    if (history[weekKey]) return; // already snapshotted this week

    // Aggregate params across all buckets
    const agg: Record<string, { alpha: number; beta: number }> = {};
    for (const table of Object.values(params)) {
      for (const [actionId, bp] of Object.entries(table as Record<string, BetaParams>)) {
        if (!agg[actionId]) agg[actionId] = { alpha: 1, beta: 1 };
        agg[actionId].alpha += bp.alpha - 1;
        agg[actionId].beta += bp.beta - 1;
      }
    }

    history[weekKey] = agg;

    // Keep only last 52 weeks
    const keys = Object.keys(history).sort();
    if (keys.length > 52) {
      for (let i = 0; i < keys.length - 52; i++) delete history[keys[i]];
    }

    setSetting("model_history", JSON.stringify(history));
  } catch {
    // Silently fail — snapshot is best-effort
  }
}

/**
 * Apply informative priors based on onboarding behavioral preferences.
 * Instead of uniform Beta(1,1), use mild priors that favor actions
 * matching user preferences.
 *
 * E.g., if user prefers "yes_no" question style → A1 (Yes/No Check-in)
 *        gets a slight prior boost: Beta(2, 1) instead of Beta(1, 1).
 */
export function warmStartPriors(): Record<ActionId, BetaParams> {
  const defaults: Record<string, BetaParams> = {};
  for (let i = 1; i <= 20; i++) defaults[`A${i}`] = { alpha: 1, beta: 1 };

  try {
    const { db } = require("../db/db");

    // pref_question_style: yes_no → boost A1, A4
    const qs = db.getFirstSync(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_question_style'"
    ) as { value_json: string } | null;
    if (qs) {
      const style = JSON.parse(qs.value_json).value;
      if (style === "yes_no") {
        defaults.A1.alpha += 1;  // Yes/No Check-in
        defaults.A4.alpha += 1;  // Offer Choice
      } else if (style === "open") {
        defaults.A5.alpha += 1;  // One Clear Request
      }
    }

    // pref_message_length: short → boost A3 (Text Summary), A5 (One Request)
    const ml = db.getFirstSync(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_message_length'"
    ) as { value_json: string } | null;
    if (ml) {
      const len = JSON.parse(ml.value_json).value;
      if (len === "short") {
        defaults.A3.alpha += 1;  // Text Summary
        defaults.A5.alpha += 1;  // One Clear Request
      }
    }

    // pref_overload: break → boost A2 (Timeout)
    const ol = db.getFirstSync(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_overload'"
    ) as { value_json: string } | null;
    if (ol) {
      const response = JSON.parse(ol.value_json).value;
      if (response === "break") {
        defaults.A2.alpha += 1;   // Suggest Timeout
        defaults.A16.alpha += 1;  // Physical Reset
      } else if (response === "text") {
        defaults.A3.alpha += 1;   // Text Summary
        defaults.A17.alpha += 1;  // Written Note
      } else if (response === "summary") {
        defaults.A3.alpha += 1;   // Text Summary
        defaults.A14.alpha += 1;  // Topic Narrowing
      }
    }

    // Cross-preference boosts for new actions
    if (qs) {
      const style = JSON.parse(qs.value_json).value;
      if (style === "yes_no") {
        defaults.A13.alpha += 1;  // Energy Check (simple numeric)
      } else if (style === "open") {
        defaults.A10.alpha += 1;  // Feeling Statement
        defaults.A11.alpha += 1;  // Mirror Back
      }
    }
  } catch {
    // Tables may not exist — return uninformative priors
  }

  return defaults as Record<ActionId, BetaParams>;
}
