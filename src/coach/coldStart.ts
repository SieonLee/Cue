import type { ActionId } from "./actions";

export const COLD_START_THRESHOLD = 3;

const LOW_RISK_ACTIONS: ActionId[] = [
  "A1",
  "A3",
  "A4",
  "A5",
  "A8",
  "A11",
  "A15",
  "A19",
];

export function prioritizeColdStartRanking(ranked: ActionId[]): ActionId[] {
  const preferred = ranked.filter((action) => LOW_RISK_ACTIONS.includes(action));
  const remaining = ranked.filter((action) => !LOW_RISK_ACTIONS.includes(action));
  return [...preferred, ...remaining];
}
