/**
 * Disjoint LinUCB with a small contextual feature vector.
 */

import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";

export const LINUCB_ALPHA = 0.5; // exploration coefficient

// Must match encodeContext output length.
export const FEATURE_DIM = 13;

export type LinUCBParams = Record<ActionId, { A: number[][]; b: number[] }>;

const INTENTS = ["schedule_change", "apology", "request", "repair", "boundary"] as const;
const STAGES  = ["start", "escalation", "repair"] as const;
const CHANNELS = ["text", "call", "in_person"] as const;

export function encodeContext(ctx: CoachContext): number[] {
  // one-hot: intent(5) + stage(3) + channel(3) + urgency(1) + tired(1) = 13
  const intent  = INTENTS.map((v) => (ctx.intent === v ? 1 : 0));
  const stage   = STAGES.map((v) => (ctx.stage === v ? 1 : 0));
  const channel = CHANNELS.map((v) => (ctx.channel === v ? 1 : 0));
  return [...intent, ...stage, ...channel, ctx.urgency, ctx.tiredFlag];
}

function identityMatrix(d: number): number[][] {
  return Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => (i === j ? 1 : 0))
  );
}

function matVecMul(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

// Gauss-Jordan is enough here because the feature matrix is small.
function invertMatrix(A: number[][]): number[][] {
  const d = A.length;
  const aug = A.map((row, i) => {
    const id = Array(d).fill(0);
    id[i] = 1;
    return [...row, ...id];
  });

  for (let col = 0; col < d; col++) {
    // Pivot
    let maxRow = col;
    for (let row = col + 1; row < d; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // singular guard
    for (let j = 0; j < 2 * d; j++) aug[col][j] /= pivot;
    for (let row = 0; row < d; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * d; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(d));
}

export function initLinUCBParams(actions: ActionId[]): LinUCBParams {
  const params: Partial<LinUCBParams> = {};
  for (const a of actions) {
    params[a] = {
      A: identityMatrix(FEATURE_DIM),
      b: Array(FEATURE_DIM).fill(0),
    };
  }
  return params as LinUCBParams;
}

export function rankActionsLinUCB(
  ctx: CoachContext,
  candidates: ActionId[],
  params: LinUCBParams,
  alpha: number = LINUCB_ALPHA
): ActionId[] {
  const x = encodeContext(ctx);

  const scored = candidates.map((a) => {
    const { A, b } = params[a] ?? { A: identityMatrix(FEATURE_DIM), b: Array(FEATURE_DIM).fill(0) };
    const Ainv = invertMatrix(A);
    const theta = matVecMul(Ainv, b);
    const ucb = dot(theta, x) + alpha * Math.sqrt(dot(x, matVecMul(Ainv, x)));
    return { a, ucb };
  });

  scored.sort((x, y) => y.ucb - x.ucb);
  return scored.map((s) => s.a);
}

export function updateLinUCB(
  ctx: CoachContext,
  action: ActionId,
  reward: number,
  params: LinUCBParams
): LinUCBParams {
  const x = encodeContext(ctx);
  const prev = params[action] ?? { A: identityMatrix(FEATURE_DIM), b: Array(FEATURE_DIM).fill(0) };

  // A_a += x·xᵀ
  const newA = prev.A.map((row, i) => row.map((v, j) => v + x[i] * x[j]));
  // b_a += reward·x
  const newB = prev.b.map((v, i) => v + reward * x[i]);

  return { ...params, [action]: { A: newA, b: newB } };
}

export function loadLinUCBParams(raw: Record<string, any> | null, actions: ActionId[]): LinUCBParams {
  if (!raw) return initLinUCBParams(actions);
  return raw as LinUCBParams;
}
