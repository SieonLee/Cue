import type { CoachContext } from "../types/models";
import { db } from "../db/db";
import { getSetting } from "../db/sessions";

/**
 * Feature extraction for contextual bandit bucket key.
 *
 * Uses ONLY behavioral preferences (no psychological classification):
 * - Active profile (A/B) for profile-scoped learning
 * - Context: intent, stage, channel, urgency, tiredFlag
 * - User settings: prefText, prefYesNo, tone
 * - Onboarding preferences: channel, message length, question style, overload response
 */
export function extractFeatures(ctx: CoachContext): string[] {
  const profile = getSetting("activeProfile") ?? "A";

  // Behavioral preferences from onboarding (not psychological profiles)
  let prefChannel = "mixed";
  let prefMsgLength = "short";
  let prefQStyle = "yes_no";
  let prefOverload = "break";

  try {
    const ch = db.getFirstSync<{ value_json: string }>(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_channel'"
    );
    if (ch) prefChannel = JSON.parse(ch.value_json).value ?? "mixed";

    const ml = db.getFirstSync<{ value_json: string }>(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_message_length'"
    );
    if (ml) prefMsgLength = JSON.parse(ml.value_json).value ?? "short";

    const qs = db.getFirstSync<{ value_json: string }>(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_question_style'"
    );
    if (qs) prefQStyle = JSON.parse(qs.value_json).value ?? "yes_no";

    const ol = db.getFirstSync<{ value_json: string }>(
      "SELECT value_json FROM profile_assessment WHERE key = 'pref_overload'"
    );
    if (ol) prefOverload = JSON.parse(ol.value_json).value ?? "break";
  } catch {
    // Tables may not exist yet on first run
  }

  // Time-of-day bucket
  const hour = new Date().getHours();
  let timeOfDay: string;
  if (hour >= 5 && hour < 12) timeOfDay = "morning";
  else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "evening";
  else timeOfDay = "night";

  // Day type
  const dayOfWeek = new Date().getDay();
  const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? "weekend" : "weekday";

  return [
    profile,
    ctx.intent,
    ctx.stage,
    ctx.channel,
    String(ctx.urgency),
    String(ctx.tiredFlag),
    String(ctx.prefText),
    String(ctx.prefYesNo),
    ctx.tone,
    prefChannel,
    prefMsgLength,
    prefQStyle,
    prefOverload,
    timeOfDay,
    dayType,
  ];
}
