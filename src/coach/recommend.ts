import type { CoachContext } from "../types/models";
import type { ActionId } from "./actions";

/**
 * Context-based candidate filtering.
 * Returns 5-7 candidates per scenario (expanded from original 3-5).
 */
export function ruleCandidates(ctx: CoachContext): ActionId[] {
  const candidates: ActionId[] = [];

  // Stage-based
  if (ctx.stage === "escalation") {
    candidates.push("A2", "A1", "A6", "A11", "A16", "A19"); // timeout, check-in, repair, mirror, physical reset, validation
  }
  if (ctx.stage === "repair") {
    candidates.push("A6", "A8", "A9", "A18", "A20", "A19"); // repair, gratitude, wrap-up, future focus, small win, validation
  }

  // Intent-based
  if (ctx.intent === "schedule_change") {
    candidates.push("A3", "A4", "A5", "A12", "A14"); // summary, choice, request, schedule, narrow
  }
  if (ctx.intent === "apology") {
    candidates.push("A6", "A1", "A10", "A15"); // repair, check-in, feeling, soft start
  }
  if (ctx.intent === "request") {
    candidates.push("A5", "A4", "A1", "A10", "A14", "A15"); // request, choice, check-in, feeling, narrow, soft start
  }
  if (ctx.intent === "boundary") {
    candidates.push("A7", "A5", "A1", "A10", "A17"); // boundary, request, check-in, feeling, written
  }
  if (ctx.intent === "repair") {
    candidates.push("A6", "A8", "A1", "A9", "A11", "A18", "A20"); // repair, gratitude, check-in, wrap-up, mirror, future, win
  }
  if (ctx.intent === "checkin") {
    candidates.push("A1", "A8", "A13", "A15", "A20"); // check-in, gratitude, energy, soft start, small win
  }
  if (ctx.intent === "positive") {
    candidates.push("A8", "A20", "A15", "A9"); // gratitude, small win, soft start, wrap-up
  }
  if (ctx.intent === "logistics") {
    candidates.push("A3", "A5", "A4", "A14", "A12"); // summary, request, choice, narrow, schedule
  }
  if (ctx.intent === "support") {
    candidates.push("A11", "A19", "A13", "A10", "A16"); // mirror, validation, energy, feeling, physical
  }
  if (ctx.intent === "recurring") {
    candidates.push("A14", "A18", "A2", "A11", "A19", "A20"); // narrow, future, timeout, mirror, validation, win
  }
  if (ctx.intent === "decision") {
    candidates.push("A4", "A5", "A14", "A3", "A12", "A15"); // choice, request, narrow, summary, schedule, soft
  }
  if (ctx.intent === "gratitude") {
    candidates.push("A8", "A20", "A15", "A9", "A19"); // gratitude, small win, soft start, wrap-up, validation
  }

  // Channel modifiers
  if (ctx.channel === "text") {
    candidates.push("A3", "A17"); // summary, written note
  }

  // Tired flag → low-pressure actions
  if (ctx.tiredFlag) {
    candidates.push("A4", "A12", "A13"); // choice, schedule, energy check
  }

  // Deduplicate + limit to top 7
  return Array.from(new Set(candidates)).slice(0, 7);
}
