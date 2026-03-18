import test from "node:test";
import assert from "node:assert/strict";
import { ruleCandidates } from "../src/coach/recommend";
import type { CoachContext } from "../src/types/models";

function makeContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    intent: "request",
    stage: "start",
    channel: "text",
    urgency: 0,
    tiredFlag: 0,
    prefText: 1,
    prefYesNo: 1,
    noticeHours: 2,
    tone: "casual",
    ...overrides,
  };
}

test("ruleCandidates keeps escalation sessions anchored on de-escalation actions", () => {
  const candidates = ruleCandidates(
    makeContext({ intent: "repair", stage: "escalation", urgency: 1 })
  );

  assert.ok(candidates.includes("A2"));
  assert.ok(candidates.includes("A1"));
  assert.ok(candidates.includes("A6"));
  assert.ok(candidates.length <= 7);
});

test("ruleCandidates keeps gratitude scenarios in appreciation-oriented actions", () => {
  const candidates = ruleCandidates(
    makeContext({ intent: "gratitude", channel: "in_person" })
  );

  assert.ok(candidates.includes("A8"));
  assert.ok(candidates.includes("A20"));
  assert.ok(!candidates.includes("A2"));
});
