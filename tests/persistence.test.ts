import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportPayload,
  clearAllAppData,
  readSetting,
  writeSetting,
  type PersistenceDb,
} from "../src/db/persistence";

function createMemoryDb(): PersistenceDb {
  const settings = new Map<string, string>();
  const tables: Record<string, any[]> = {
    coach_sessions: [],
    feedback: [],
    bandit_params: [],
    profile_assessment: [],
    outcome_reviews: [{ id: "review-1" }],
    ab_assignments: [{ session_id: "session-1" }],
    fingerprint_events: [{ id: 1 }],
    implicit_signals: [{ id: 1 }],
    daily_engagement: [{ date_key: "2026-03-18" }],
    daily_loop: [{ date_key: "2026-03-18" }],
    goals: [{ id: 1 }],
    badges: [{ badge_id: "starter" }],
    lesson_progress: [{ lesson_id: "lesson-1" }],
  };

  return {
    runSync(sql: string, params?: any[]) {
      if (sql.startsWith("INSERT INTO settings")) {
        settings.set(String(params?.[0]), String(params?.[1]));
        return;
      }

      const match = sql.match(/^DELETE FROM (\w+)/);
      if (match) {
        const table = match[1];
        if (table === "settings") settings.clear();
        else tables[table] = [];
      }
    },
    getFirstSync<T>(sql: string, params?: any[]) {
      if (sql.startsWith("SELECT value FROM settings")) {
        const value = settings.get(String(params?.[0]));
        return value === undefined ? undefined : ({ value } as T);
      }
      return undefined;
    },
    getAllSync<T>(sql: string) {
      if (sql.includes("FROM coach_sessions")) return tables.coach_sessions as T[];
      if (sql.includes("FROM feedback")) return tables.feedback as T[];
      if (sql.includes("FROM bandit_params")) return tables.bandit_params as T[];
      if (sql.includes("FROM profile_assessment")) return tables.profile_assessment as T[];
      return [];
    },
  };
}

test("settings helpers round-trip saved values", () => {
  const db = createMemoryDb();

  writeSetting(db, "tone", "formal");
  writeSetting(db, "prefText", "1");

  assert.equal(readSetting(db, "tone"), "formal");
  assert.equal(readSetting(db, "prefText"), "1");
  assert.equal(readSetting(db, "missing"), null);
});

test("export payload and reset helpers preserve settings but clear app data", () => {
  const db = createMemoryDb();

  writeSetting(db, "tone", "casual");
  (db.getAllSync("SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC") as any[]).push({
    id: "session-1",
    created_at: 1710000000,
    context_json: JSON.stringify({
      intent: "request",
      stage: "start",
      channel: "text",
      urgency: 0,
      tiredFlag: 0,
      prefText: 1,
      prefYesNo: 1,
      noticeHours: 2,
      tone: "casual",
    }),
    ranked_json: JSON.stringify(["A5", "A4"]),
  });
  (db.getAllSync("SELECT session_id, chosen_action, reward, created_at, context_json, feedback_reason FROM feedback ORDER BY created_at DESC") as any[]).push({
    session_id: "session-1",
    chosen_action: "A5",
    reward: 1,
    created_at: 1710000010,
    context_json: null,
    feedback_reason: "It felt easy to use in the moment.",
  });
  (db.getAllSync("SELECT key, value_json FROM bandit_params") as any[]).push({
    key: "params",
    value_json: JSON.stringify({ bucket: { A5: { alpha: 2, beta: 1 } } }),
  });
  (db.getAllSync("SELECT key, value_json, completed_at FROM profile_assessment") as any[]).push({
    key: "pref_channel",
    value_json: JSON.stringify({ value: "text" }),
    completed_at: 1710000020,
  });

  const payload = buildExportPayload(db);

  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.sessions[0].top_action, "A5");
  assert.equal(payload.feedback.length, 1);
  assert.equal(payload.feedback[0].feedback_reason, "It felt easy to use in the moment.");
  assert.equal(payload.banditParams.length, 1);
  assert.equal(payload.profile.length, 1);

  clearAllAppData(db);

  assert.equal(readSetting(db, "tone"), "casual");
  assert.equal((db.getAllSync("SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC") as any[]).length, 0);
  assert.equal((db.getAllSync("SELECT session_id, chosen_action, reward, created_at, context_json, feedback_reason FROM feedback ORDER BY created_at DESC") as any[]).length, 0);
  assert.equal((db.getAllSync("SELECT key, value_json FROM bandit_params") as any[]).length, 0);
});
