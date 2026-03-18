/**
 * Data export and reset utilities.
 * All data stays on-device — export copies JSON to clipboard.
 */
import { db } from "./db";
import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";

// ── Export all data as JSON ─────────────────────────────────────────────────

export function exportAllDataJson(): string {
  type SessionRow = { id: string; created_at: number; context_json: string; ranked_json: string };
  const sessions = db.getAllSync<SessionRow>(
    "SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC"
  );

  type FeedbackRow = { session_id: string; chosen_action: string; reward: number; created_at: number; context_json: string | null };
  const feedback = db.getAllSync<FeedbackRow>(
    "SELECT session_id, chosen_action, reward, created_at, context_json FROM feedback ORDER BY created_at DESC"
  );

  type ParamsRow = { key: string; value_json: string };
  const banditParams = db.getAllSync<ParamsRow>(
    "SELECT key, value_json FROM bandit_params"
  );

  type ProfileRow = { key: string; value_json: string; completed_at: number };
  const profile = db.getAllSync<ProfileRow>(
    "SELECT key, value_json, completed_at FROM profile_assessment"
  );

  const data = {
    exportedAt: new Date().toISOString(),
    sessions: sessions.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      context: JSON.parse(r.context_json) as CoachContext,
      top_action: (JSON.parse(r.ranked_json) as ActionId[])[0] ?? null,
    })),
    feedback: feedback.map((r) => ({
      session_id: r.session_id,
      chosen_action: r.chosen_action,
      reward: r.reward,
      created_at: r.created_at,
    })),
    banditParams: banditParams.map((r) => ({
      key: r.key,
      data: JSON.parse(r.value_json),
    })),
    profile: profile.map((r) => ({
      key: r.key,
      value: JSON.parse(r.value_json),
    })),
  };

  return JSON.stringify(data, null, 2);
}

// ── Reset learning data only ────────────────────────────────────────────────

export function resetLearningData() {
  db.runSync("DELETE FROM bandit_params");
  db.runSync("DELETE FROM ab_assignments");
  db.runSync("DELETE FROM fingerprint_events");
  db.runSync("DELETE FROM implicit_signals");
}

// ── Reset all data (keep settings + profile preferences) ────────────────────

export function resetAllData() {
  db.runSync("DELETE FROM coach_sessions");
  db.runSync("DELETE FROM feedback");
  db.runSync("DELETE FROM bandit_params");
  db.runSync("DELETE FROM outcome_reviews");
  db.runSync("DELETE FROM ab_assignments");
  db.runSync("DELETE FROM fingerprint_events");
  db.runSync("DELETE FROM implicit_signals");
  db.runSync("DELETE FROM daily_engagement");
  db.runSync("DELETE FROM daily_loop");
  db.runSync("DELETE FROM goals");
  db.runSync("DELETE FROM badges");
  db.runSync("DELETE FROM lesson_progress");
  // Keep: settings, profile_assessment
}
