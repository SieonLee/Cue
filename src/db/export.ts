// Export and reset helpers.
import { db } from "./db";
import type { DbLike } from "./db";
import { buildExportPayload, clearAllAppData, clearLearningTables } from "./persistence";

export function exportAllDataJson(dbOverride: DbLike = db): string {
  return JSON.stringify(buildExportPayload(dbOverride), null, 2);
}

export function resetLearningData(dbOverride: DbLike = db) {
  clearLearningTables(dbOverride);
}

export function resetAllData(dbOverride: DbLike = db) {
  clearAllAppData(dbOverride);
  // Keep settings and saved preferences.
}
