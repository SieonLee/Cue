/**
 * On-device NLP v2.0 — Context-Aware Signal Detection
 *
 * PRINCIPLES:
 * - No emotion interpretation or psychological diagnosis
 * - Detects structural patterns with negation awareness
 * - Outputs are signals for action selection, NOT labels about people
 *
 * v2.0 UPGRADES:
 * - Negation detection: "you always make me smile" != "you always forget"
 * - Sentence-level context: checks surrounding words, not just keywords
 * - Sarcasm guard: quotation marks / ellipsis patterns
 * - Intensity scoring: count + position weighting
 */

import type { ActionId } from "../coach/actions";

// ── Negation patterns ───────────────────────────────────────────────────

const NEGATION_WORDS = /\b(not|n't|never|no|don't|doesn't|didn't|wasn't|weren't|isn't|aren't|can't|couldn't|won't|wouldn't)\b/i;
const POSITIVE_CONTEXT = /\b(smile|laugh|happy|love|thank|appreciate|enjoy|proud|glad|great|wonderful|amazing)\b/i;

function isNegated(text: string, matchIndex: number): boolean {
  // Check 4 words before the match for negation
  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  return NEGATION_WORDS.test(before);
}

function hasPositiveContext(text: string, matchIndex: number): boolean {
  // Check surrounding 50 chars for positive words
  const window = text.slice(Math.max(0, matchIndex - 25), matchIndex + 50);
  return POSITIVE_CONTEXT.test(window);
}

// ── Keyword Signal Detection ───────────────────────────────────────────

const URGENCY_SIGNALS: { pattern: RegExp; weight: number }[] = [
  { pattern: /you always/i, weight: 2 },
  { pattern: /you never/i, weight: 2 },
  { pattern: /every single time/i, weight: 3 },
  { pattern: /i can'?t believe/i, weight: 2 },
  { pattern: /i'?m done/i, weight: 3 },
  { pattern: /i'?m leaving/i, weight: 3 },
  { pattern: /we'?re over/i, weight: 3 },
  { pattern: /forget it/i, weight: 2 },
  { pattern: /don'?t talk to me/i, weight: 3 },
  { pattern: /leave me alone/i, weight: 3 },
  { pattern: /shut up/i, weight: 3 },
  { pattern: /i hate/i, weight: 2 },
  { pattern: /you don'?t care/i, weight: 2 },
  { pattern: /what'?s the point/i, weight: 2 },
  // Korean
  { pattern: /\ub9e8\ub0a0/, weight: 2 },
  { pattern: /\ud56d\uc0c1/, weight: 2 },
  { pattern: /\ub3c4\ub300\uccb4/, weight: 2 },
  { pattern: /\ub10c\s*\ub9e8\ub0a0/, weight: 3 },
  { pattern: /\uc9c0\uaca8/, weight: 3 },
  { pattern: /\ub098\uac00/, weight: 2 },
  { pattern: /\ub05d\uc774\uc57c/, weight: 3 },
  { pattern: /\uad00\ub450/, weight: 2 },
  { pattern: /\ub410\uc5b4/, weight: 2 },
  { pattern: /\ub2e5\uccd0/, weight: 3 },
];

const PAUSE_SIGNALS: { pattern: RegExp; weight: number }[] = [
  { pattern: /i understand/i, weight: 2 },
  { pattern: /let me think/i, weight: 2 },
  { pattern: /can we talk/i, weight: 1 },
  { pattern: /i hear you/i, weight: 2 },
  { pattern: /let'?s take a break/i, weight: 2 },
  { pattern: /help me understand/i, weight: 2 },
  { pattern: /what do you need/i, weight: 2 },
  { pattern: /you'?re right/i, weight: 2 },
  { pattern: /i'?m sorry/i, weight: 2 },
  { pattern: /my fault/i, weight: 2 },
  // Korean
  { pattern: /\uc774\ud574\ud574/, weight: 2 },
  { pattern: /\uc7a0\uae50/, weight: 2 },
  { pattern: /\uc26c\uc790/, weight: 2 },
  { pattern: /\ub4e4\uc5b4\uc904/, weight: 2 },
  { pattern: /\uc5b4\ub5bb\uac8c\s*\ud558\uba74/, weight: 2 },
  { pattern: /\uac19\uc774\s*\ud574/, weight: 2 },
  { pattern: /\ubbf8\uc548/, weight: 2 },
];

// ── Sarcasm guard ───────────────────────────────────────────────────────

function hasSarcasmIndicators(text: string): boolean {
  // Excessive punctuation, quotation around key words, ellipsis patterns
  return /[""\u201c\u201d].*always.*[""\u201c\u201d]/i.test(text) ||
    /\.{3,}/.test(text) && /sure|right|great|fine|whatever/i.test(text);
}

// ── Signal Analysis ─────────────────────────────────────────────────────

export type SignalResult = {
  urgencySignals: string[];
  pauseSignals: string[];
  hasUrgency: boolean;
  hasPauseAttempt: boolean;
  urgencyScore: number;     // 0-10 intensity
  pauseScore: number;       // 0-10 intensity
  hasSarcasm: boolean;
};

/**
 * Detect structural communication signals with context awareness.
 * Returns observable patterns \u2014 NOT emotion labels.
 */
export function detectSignals(text: string): SignalResult {
  const urgencySignals: string[] = [];
  const pauseSignals: string[] = [];
  let urgencyScore = 0;
  let pauseScore = 0;

  for (const { pattern, weight } of URGENCY_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      const idx = match.index ?? 0;
      // v2.0: Skip if in positive context (e.g., "you always make me laugh")
      if (hasPositiveContext(text, idx)) continue;
      // v2.0: Skip if negated (e.g., "I'm not done with this")
      if (isNegated(text, idx)) continue;

      urgencySignals.push(match[0]);
      urgencyScore += weight;
    }
  }

  for (const { pattern, weight } of PAUSE_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      pauseSignals.push(match[0]);
      pauseScore += weight;
    }
  }

  const hasSarcasm = hasSarcasmIndicators(text);
  if (hasSarcasm) urgencyScore += 1; // sarcasm is mildly escalatory

  return {
    urgencySignals,
    pauseSignals,
    hasUrgency: urgencyScore >= 2,
    hasPauseAttempt: pauseScore >= 2,
    urgencyScore: Math.min(10, urgencyScore),
    pauseScore: Math.min(10, pauseScore),
    hasSarcasm,
  };
}

// ── Conversation Turn Parser ───────────────────────────────────────────

export type Turn = {
  speaker: "A" | "B";
  text: string;
  signals: SignalResult;
  detectedAction: ActionId | null;
};

export function parseConversation(text: string): Turn[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const turns: Turn[] = [];
  const labelA = /^(A|Me|\ub098|\ub0b4\uac00)\s*[:\uff1a]/i;
  const labelB = /^(B|Partner|\uc0c1\ub300|\ud30c\ud2b8\ub108)\s*[:\uff1a]/i;

  let lastSpeaker: "A" | "B" = "B";

  for (const line of lines) {
    let speaker: "A" | "B";
    let message: string;

    if (labelA.test(line)) {
      speaker = "A";
      message = line.replace(labelA, "").trim();
    } else if (labelB.test(line)) {
      speaker = "B";
      message = line.replace(labelB, "").trim();
    } else {
      speaker = lastSpeaker === "A" ? "B" : "A";
      message = line.trim();
    }

    lastSpeaker = speaker;
    turns.push({
      speaker,
      text: message,
      signals: detectSignals(message),
      detectedAction: mapTurnToAction(message),
    });
  }

  return turns;
}

// ── Action Mapping ─────────────────────────────────────────────────────

export function mapTurnToAction(text: string): ActionId | null {
  // A1: Yes/No Check-in
  if (/\b(can we talk|is now (a good|ok|okay) time|are you free|available)\b/i.test(text)) return "A1";
  if (/(\uc9c0\uae08\s*(\uad1c\ucc2e|\ub418\ub098|\uac00\ub2a5)|\uc598\uae30\s*\ud560\s*\uc218\s*\uc788)/.test(text)) return "A1";

  // A2: Suggest Timeout
  if (/\b(take a break|need a minute|cool down|timeout|pause|step away)\b/i.test(text)) return "A2";
  if (/(\uc7a0\uae50|\uc26c\uc790|\uc9c4\uc815|\ub098\uc911\uc5d0\s*\uc598\uae30)/.test(text)) return "A2";

  // A3: Text Summary
  if (/\b(to summarize|in short|basically|the point is|what i mean is)\b/i.test(text)) return "A3";
  if (/(\uc694\uc57d\ud558\uba74|\uacb0\ub860\uc740|\ud575\uc2ec\uc740|\ub9d0\ud558\uace0\s*\uc2f6\uc740\s*\uac74)/.test(text)) return "A3";

  // A4: Offer Choice
  if (/\b(would you prefer|do you want to .+ or|your choice|up to you)\b/i.test(text)) return "A4";
  if (/(\uc5b4\ub5bb\uac8c\s*\ud560\ub798|\ubb50\uac00\s*\uc88b\uc544|\uc120\ud0dd|\uace8\ub77c)/.test(text)) return "A4";

  // A5: One Clear Request
  if (/\b(could you please|would you mind|i need you to|one thing i ask)\b/i.test(text)) return "A5";
  if (/(\ubd80\ud0c1|\ud574\uc904\s*\uc218|\ud574\uc918|\ud558\ub098\ub9cc)/.test(text)) return "A5";

  // A6: Repair Script
  if (/\b(i'?m sorry|i apologize|my fault|i was wrong|i shouldn'?t have)\b/i.test(text)) return "A6";
  if (/(\ubbf8\uc548|\uc798\ubabb\ud588|\ub0b4\s*\ud0d3|\uc0ac\uacfc)/.test(text)) return "A6";

  // A7: Boundary Restatement
  if (/\b(i need .+ boundary|please (don'?t|stop)|i'?m not comfortable)\b/i.test(text)) return "A7";
  if (/(\uacbd\uacc4|\uadf8\ub7ec\uc9c0\s*\ub9c8|\ubd88\ud3b8\ud574|\ud558\uc9c0\s*\ub9c8)/.test(text)) return "A7";

  // A8: Gratitude Message
  if (/\b(thank you for|i appreciate|grateful|means a lot)\b/i.test(text)) return "A8";
  if (/(\uace0\ub9c8\uc6cc|\uac10\uc0ac|\ub2e4\ud589\uc774\ub2e4|\ub355\ubd84)/.test(text)) return "A8";

  // A9: Wrap-Up Signal
  if (/\b(so (we agree|let'?s)|next step|to wrap up|moving forward)\b/i.test(text)) return "A9";
  if (/(\uadf8\ub7ec\uba74|\uc815\ub9ac\ud558\uba74|\ub2e4\uc74c\uc5d0\ub294|\uc55e\uc73c\ub85c)/.test(text)) return "A9";

  // A10: Feeling Statement
  if (/\b(i feel|it makes me feel|when you .+ i feel)\b/i.test(text)) return "A10";

  // A11: Mirror Back
  if (/\b(so what you'?re saying|if i understand|let me make sure i got|you mean)\b/i.test(text)) return "A11";

  // A13: Energy Check
  if (/\b(my energy|on a scale|feeling (tired|drained|low))\b/i.test(text)) return "A13";

  // A15: Soft Start-Up
  if (/\b(i know .+ but|first.*want to say|before i bring this up)\b/i.test(text)) return "A15";

  // A19: Validation First
  if (/\b(i (see|get|understand) (your|why)|that makes sense|you have a point)\b/i.test(text)) return "A19";

  return null;
}
