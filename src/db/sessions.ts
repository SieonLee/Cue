import { db } from "./db";
import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export function loadBanditParams(): Record<string, any> {
  const row = db.getFirstSync<{ value_json: string }>(
    "SELECT value_json FROM bandit_params WHERE key = 'params'"
  );
  return row ? JSON.parse(row.value_json) : {};
}

export function saveBanditParams(params: Record<string, any>) {
  db.runSync(
    "INSERT INTO bandit_params(key, value_json) VALUES('params', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
    [JSON.stringify(params)]
  );
}

export function loadLinUCBBanditParams(): Record<string, any> {
  const row = db.getFirstSync<{ value_json: string }>(
    "SELECT value_json FROM bandit_params WHERE key = 'linucb_params'"
  );
  return row ? JSON.parse(row.value_json) : {};
}

export function saveLinUCBBanditParams(params: Record<string, any>) {
  db.runSync(
    "INSERT INTO bandit_params(key, value_json) VALUES('linucb_params', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
    [JSON.stringify(params)]
  );
}

export function resetBanditParams() {
  db.runSync("DELETE FROM bandit_params WHERE key IN ('params', 'linucb_params')");
}

// Export: returns JSON string (no raw message content — context tags only)
export function exportSessionsJson(): string {
  type Row = { id: string; created_at: number; context_json: string; ranked_json: string };
  const rows = db.getAllSync<Row>(
    "SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC"
  );
  const safe = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    context: JSON.parse(r.context_json) as CoachContext,
    top_action: (JSON.parse(r.ranked_json) as ActionId[])[0] ?? null,
  }));
  return JSON.stringify(safe, null, 2);
}

// Export: returns CSV string
export function exportSessionsCsv(): string {
  type Row = { id: string; created_at: number; context_json: string; ranked_json: string };
  const rows = db.getAllSync<Row>(
    "SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC"
  );
  const header = "id,created_at,intent,stage,channel,urgency,tiredFlag,tone,top_action";
  const lines = rows.map((r) => {
    const ctx = JSON.parse(r.context_json) as CoachContext;
    const topAction = (JSON.parse(r.ranked_json) as ActionId[])[0] ?? "";
    return [
      r.id,
      r.created_at,
      ctx.intent,
      ctx.stage,
      ctx.channel,
      ctx.urgency,
      ctx.tiredFlag,
      ctx.tone ?? "",
      topAction,
    ].join(",");
  });
  return [header, ...lines].join("\n");
}
