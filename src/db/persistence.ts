import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";

export interface PersistenceDb {
  runSync(sql: string, params?: any[]): void;
  getFirstSync<T>(sql: string, params?: any[]): T | undefined;
  getAllSync<T>(sql: string, params?: any[]): T[];
}

export function readSetting(db: PersistenceDb, key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export function writeSetting(db: PersistenceDb, key: string, value: string) {
  db.runSync(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export function buildExportPayload(db: PersistenceDb) {
  type SessionRow = { id: string; created_at: number; context_json: string; ranked_json: string };
  type FeedbackRow = { session_id: string; chosen_action: string; reward: number; created_at: number; context_json: string | null };
  type ParamsRow = { key: string; value_json: string };
  type ProfileRow = { key: string; value_json: string; completed_at: number };

  const sessions = db.getAllSync<SessionRow>(
    "SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC"
  );
  const feedback = db.getAllSync<FeedbackRow>(
    "SELECT session_id, chosen_action, reward, created_at, context_json FROM feedback ORDER BY created_at DESC"
  );
  const banditParams = db.getAllSync<ParamsRow>(
    "SELECT key, value_json FROM bandit_params"
  );
  const profile = db.getAllSync<ProfileRow>(
    "SELECT key, value_json, completed_at FROM profile_assessment"
  );

  return {
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
}

export function clearLearningTables(db: PersistenceDb) {
  db.runSync("DELETE FROM bandit_params");
  db.runSync("DELETE FROM ab_assignments");
  db.runSync("DELETE FROM fingerprint_events");
  db.runSync("DELETE FROM implicit_signals");
}

export function clearAllAppData(db: PersistenceDb) {
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
}
