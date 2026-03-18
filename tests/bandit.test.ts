import test from "node:test";
import assert from "node:assert/strict";
import { encodeContext, initLinUCBParams, updateLinUCB, FEATURE_DIM } from "../src/bandit/linucb";
import type { CoachContext } from "../src/types/models";
import type { ActionId } from "../src/coach/actions";

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

test("encodeContext produces the expected fixed-width feature vector", () => {
  const encoded = encodeContext(
    makeContext({ intent: "boundary", stage: "escalation", channel: "call", urgency: 1, tiredFlag: 1 })
  );

  assert.equal(encoded.length, FEATURE_DIM);
  assert.equal(encoded.at(-2), 1);
  assert.equal(encoded.at(-1), 1);
});

test("updateLinUCB updates only the selected action parameters", () => {
  const actions: ActionId[] = ["A1", "A5"];
  const initial = initLinUCBParams(actions);
  const next = updateLinUCB(makeContext(), "A5", 0.5, initial);

  assert.notDeepEqual(next.A5.A, initial.A5.A);
  assert.notDeepEqual(next.A5.b, initial.A5.b);
  assert.deepEqual(next.A1.A, initial.A1.A);
  assert.deepEqual(next.A1.b, initial.A1.b);
  assert.equal(next.A5.b.length, FEATURE_DIM);
});
