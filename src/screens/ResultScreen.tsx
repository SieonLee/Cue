import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { db } from "../db/db";
import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";
import { ACTIONS } from "../coach/actions";
import { getSetting, loadBanditParams, saveBanditParams } from "../db/sessions";
import { updateTS, rankActionsWithScores } from "../bandit/thompson";
import type { ActionScore } from "../bandit/thompson";
import * as Clipboard from "expo-clipboard";
import { recordSignal, recordFingerprintEvent, implicitRewardBonus } from "../db/signals";
import { useSensoryStyles } from "../hooks/useSensoryStyles";
import { useTheme } from "../theme";
import { font, radii, spacing } from "../theme/tokens";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

type RewardLabel = "Good" | "Okay" | "Bad";

function rewardValue(label: RewardLabel): number {
  if (label === "Good") return 1.0;
  if (label === "Okay") return 0.5;
  return 0.0;
}

type ScriptPack = {
  messages: { id: string; label: "Short" | "Gentle" | "Structured"; text: string }[];
  checkIn?: string;
  tips: string[];
  examples?: string[];
};

type Personalization = {
  myName: string;
  partnerName: string;
  forbiddenPhrases: string[];
  tone: "casual" | "formal";
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyForbiddenFilter(text: string, forbidden: string[]): string {
  if (!forbidden.length) return text;
  let out = text;
  forbidden.forEach((phrase) => {
    if (!phrase) return;
    const re = new RegExp(escapeRegExp(phrase), "gi");
    out = out.replace(re, "___");
  });
  return out;
}

function applyNames(text: string, prefs: Personalization): string {
  if (!prefs.partnerName) return text;
  if (text.includes("\n")) return text;
  const trimmed = text.trim();
  if (trimmed.startsWith(prefs.partnerName)) return text;
  if (
    trimmed.startsWith("Summary") ||
    trimmed.startsWith("Options") ||
    trimmed.startsWith("Apology") ||
    trimmed.startsWith("Fact:")
  ) {
    return text;
  }
  return `${prefs.partnerName}, ${text}`;
}

function channelHint(channel: string): string {
  if (channel === "call") return "On a call, keep sentences shorter and allow silence.";
  if (channel === "in_person") return "In person, slow down and pause between sentences.";
  return "Over text, keep it to 2\u20133 sentences and ask only one question.";
}

function buildScript(action: ActionId, ctx: CoachContext, prefs: Personalization): ScriptPack {
  const f = prefs.tone === "formal";
  const tipsCommon = [
    "Start with a clarifying question \u2014 don\u2019t assume.",
    "Make one request at a time. Offering a choice lowers pressure.",
    channelHint(ctx.channel),
  ];

  switch (action) {
    case "A1":
      return {
        checkIn: f ? "Are you available to talk right now? (Yes/No)" : "Can you talk right now? (Yes/No)",
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "Are you available to talk right now? (Yes/No)" : "Can you talk right now? (Yes/No)",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "Do you have the capacity to talk right now? A simple Yes or No is perfectly fine."
              : "Do you have the energy to talk right now? A simple Yes/No is totally fine.",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "Are you available to talk right now? (Yes/No)\nIf yes, let\u2019s talk for 5 minutes. If no, I\u2019ll check in again in 30 minutes."
              : "Can you talk right now? (Yes/No)\nIf yes, let\u2019s talk for 5 minutes. If no, I\u2019ll check in again in 30 minutes.",
          },
        ],
        tips: tipsCommon,
      };

    case "A2":
      return {
        checkIn: f ? "Could we pause and continue in 15 minutes?" : "Can we pause and talk again in 15 minutes?",
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "I\u2019d like to pause. Can we talk again in 15 minutes?" : "Let\u2019s pause for now. Can we talk again in 15 minutes?",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "I feel my emotions rising. I think we\u2019ll communicate better after a short break. Would 15 minutes work?"
              : "I feel my emotions rising. I think we\u2019ll talk better after a short break. Is 15 minutes okay?",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "I\u2019d like to pause.\nReason: I may respond emotionally.\nPlan: In 15 minutes, I\u2019ll send a 2-sentence summary + one clear request.\nIs that alright?"
              : "I want to pause for a moment.\nReason: I\u2019m getting emotional and I don\u2019t want my words to come out harsh.\nPlan: Let\u2019s take 15 minutes, then I\u2019ll send a 2-sentence summary + one clear request.\nIs that okay?",
          },
        ],
        tips: [
          "A timeout isn\u2019t avoidance\u2014it\u2019s a way to protect the quality of the conversation.",
          "Be specific about when you\u2019ll restart.",
          ...tipsCommon,
        ],
      };

    case "A3":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "Let me summarize in two sentences: (1) ___ (2) ___" : "I\u2019ll keep it to two sentences: (1) ___ (2) ___",
          },
          {
            id: "m2", label: "Gentle",
            text: f ? "I don\u2019t want to over-explain. The key points are: (1) ___ (2) ___" : "I don\u2019t want to over-explain. The key points are: (1) ___ (2) ___",
          },
          {
            id: "m3", label: "Structured",
            text: f ? "Summary:\n- Fact: ___\n- One request: ___" : "Summary:\n- Fact: ___\n- One request: ___",
          },
        ],
        tips: ["Separate facts from your request.", ...tipsCommon],
        examples: ["I noticed the dishes were left out", "I need us to split the driving this weekend"],
      };

    case "A4":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "Would you prefer to talk now or later? Please choose whichever is easier." : "Do you want to talk now, or later? Pick what\u2019s easier.",
          },
          {
            id: "m2", label: "Gentle",
            text: f ? "I\u2019d like to give you the choice. Which is more comfortable \u2014 now or later?" : "I want to give you a choice. Is now or later more comfortable for you?",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "Options:\n1) Talk for 5 minutes now\n2) I\u2019ll text a short summary in 30 minutes\nWhich would you prefer?"
              : "Options:\n1) Talk for 5 minutes now\n2) I text a short summary in 30 minutes\nWhich feels easier?",
          },
        ],
        tips: ["Keep it to about two choices.", ...tipsCommon],
      };

    case "A5":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "I have one request: ___" : "I have one request: ___",
          },
          {
            id: "m2", label: "Gentle",
            text: f ? "I\u2019d like to ask just one thing right now. Would you be able to ___?" : "I want to ask just one thing right now. Could you ___?",
          },
          {
            id: "m3", label: "Structured",
            text: f ? "Fact: ___\nOne request: ___\nPlease let me know your preferred timing or approach." : "Fact: ___\nOne request: ___\nTell me what timing/how you prefer, too.",
          },
        ],
        tips: ["Leave only the most important one request.", ...tipsCommon],
        examples: ["Could you text me when you\u2019re on your way home?", "I need 30 minutes alone after work"],
      };

    case "A6":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "I didn\u2019t express that well. My intention was ___. Next time I\u2019ll ___." : "Sorry for how I said that. My intention was ___. Next time I\u2019ll ___.",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "I\u2019m sorry if what I said felt heavy. My intention was ___. Next time I\u2019ll try ___ instead."
              : "I\u2019m sorry if what I said felt heavy. My intention was ___. Next time I\u2019ll try ___ instead.",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "Apology: ___\nIntention: ___\nNext step (one request): ___\nWould now or later work better for you?"
              : "Apology: ___\nIntention: ___\nNext step (one request): ___\nIs now or later better for you?",
          },
        ],
        tips: ["Stick to: apology \u2192 intention \u2192 next step.", ...tipsCommon],
        examples: ["I raised my voice", "I wanted to share my frustration, not blame you", "I\u2019ll pause and take a breath first"],
      };

    case "A7":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "This is a boundary for me: ___" : "This is a boundary for me: ___",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "I\u2019m not trying to blame you. I just want you to know that ___ is difficult for me to handle."
              : "I\u2019m not blaming you. I just want you to know that ___ is hard for me to handle.",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "Boundary: ___\nReason (fact only): ___\nWhat I\u2019d prefer instead: ___\nCould we discuss this?"
              : "Boundary: ___\nReason (fact only): ___\nWhat I\u2019d prefer instead: ___\nCan we talk about this?",
          },
        ],
        tips: [
          "State the boundary as a fact about yourself, not a rule for them.",
          "One boundary per conversation.",
          ...tipsCommon,
        ],
        examples: ["I need at least an hour of alone time after work", "Loud arguments are overwhelming for me", "I\u2019d prefer we text about it first"],
      };

    case "A8":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "Thank you for ___." : "Thank you for ___.",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "It might seem small, but ___ really meant a lot to me."
              : "It might seem small, but ___ meant a lot to me.",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "Appreciation:\nSpecifically: ___\nWhat it meant to me: ___"
              : "Appreciation:\nSpecifically: ___\nWhat it meant to me: ___",
          },
        ],
        tips: [
          "Be specific\u2014generic thanks feels less genuine.",
          "No conditions or \u2018but\u2019 after the thanks.",
          ...tipsCommon,
        ],
        examples: ["picking up groceries without being asked", "listening to me vent without trying to fix it"],
      };

    case "A9":
      return {
        messages: [
          {
            id: "m1", label: "Short",
            text: f ? "Let\u2019s wrap up here. Next step: ___" : "Let\u2019s wrap up here. Next step: ___",
          },
          {
            id: "m2", label: "Gentle",
            text: f
              ? "Thank you for talking today. I\u2019d like us to ___ next."
              : "Thanks for talking today. I\u2019d like us to ___ next.",
          },
          {
            id: "m3", label: "Structured",
            text: f
              ? "What we agreed today: ___\nNext step: ___\nWhen to check in: ___"
              : "What we agreed today: ___\nNext step: ___\nWhen to check in: ___",
          },
        ],
        tips: [
          "End with one concrete next step.",
          "Confirm the next check-in time explicitly.",
          ...tipsCommon,
        ],
        examples: ["We agreed to split chores by room", "Check in on Sunday evening"],
      };

    case "A10":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "I feel ___ when ___." : "I feel ___ when ___." },
          { id: "m2", label: "Gentle", text: f ? "When ___ happens, I feel ___. I\u2019m not blaming you \u2014 I\u2019m sharing how it affects me." : "When ___ happens, I feel ___. I\u2019m not blaming you \u2014 just sharing how it hits me." },
          { id: "m3", label: "Structured", text: f ? "Observation: ___\nMy feeling: ___\nWhat I need: ___" : "What happened: ___\nHow I feel: ___\nWhat I need: ___" },
        ],
        tips: ["Stick to \u2018I feel\u2019 \u2014 avoid \u2018You make me feel.\u2019", ...tipsCommon],
        examples: ["anxious", "when plans change last minute"],
      };

    case "A11":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "So what you\u2019re saying is ___. Did I get that right?" : "So you\u2019re saying ___. Did I get that right?" },
          { id: "m2", label: "Gentle", text: f ? "Let me make sure I understand: ___. Is that what you mean?" : "Let me make sure I got it: ___. Is that what you mean?" },
          { id: "m3", label: "Structured", text: f ? "What I heard: ___\nWhat I think you need: ___\nPlease correct me if I\u2019m wrong." : "What I heard: ___\nWhat I think you need: ___\nCorrect me if I\u2019m off." },
        ],
        tips: ["Mirror first, respond second.", ...tipsCommon],
        examples: ["you feel unheard when I check my phone", "you need more notice before we make plans"],
      };

    case "A12":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "Can we talk about this at ___ (time)?" : "Can we talk about this at ___ (time)?" },
          { id: "m2", label: "Gentle", text: f ? "This is important to me. Can we set aside time at ___ to discuss it properly?" : "This matters to me. Can we set aside time at ___ to talk about it?" },
          { id: "m3", label: "Structured", text: f ? "Topic: ___\nProposed time: ___\nDuration: 10 minutes\nIs that okay?" : "Topic: ___\nWhen: ___\nHow long: 10 min\nDoes that work?" },
        ],
        tips: ["A specific time beats \u2018later.\u2019", ...tipsCommon],
        examples: ["tonight at 8pm", "Saturday morning after breakfast"],
      };

    case "A13":
      return {
        messages: [
          { id: "m1", label: "Short", text: "My energy right now: ___/10." },
          { id: "m2", label: "Gentle", text: f ? "Before we start \u2014 my energy is about ___/10 right now. Just so you know where I\u2019m at." : "Before we start \u2014 my energy is about ___/10 right now. Just so you know." },
          { id: "m3", label: "Structured", text: "Energy: ___/10\nBest channel right now: ___\nAvailable for: ___ minutes" },
        ],
        tips: ["Low energy isn\u2019t low interest \u2014 naming it prevents misreading.", ...tipsCommon],
        examples: ["4", "text or call", "15"],
      };

    case "A14":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "Let\u2019s focus on one thing: ___." : "Let\u2019s focus on one thing: ___." },
          { id: "m2", label: "Gentle", text: f ? "I know there\u2019s a lot going on. Can we focus on just ___ right now?" : "I know there\u2019s a lot. Can we just focus on ___ right now?" },
          { id: "m3", label: "Structured", text: "Today\u2019s topic: ___\nOther topics for later: ___\nLet\u2019s stay on this one." },
        ],
        tips: ["One topic per conversation. Park the rest.", ...tipsCommon],
        examples: ["the vacation budget", "how we handle bedtime routines"],
      };

    case "A15":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "First, I want to say ___. And I also want to talk about ___." : "First, I want to say ___. And I also want to bring up ___." },
          { id: "m2", label: "Gentle", text: f ? "I appreciate ___. There\u2019s also something I\u2019d like to discuss: ___." : "I appreciate ___. There\u2019s also something I want to talk about: ___." },
          { id: "m3", label: "Structured", text: "Positive: ___\nTopic: ___\nRequest: ___" },
        ],
        tips: ["Start soft. How you begin predicts the ending.", ...tipsCommon],
        examples: ["I appreciate how you handled yesterday", "the morning routine"],
      };

    case "A16":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "Can we move somewhere else and talk?" : "Can we go somewhere else and talk?" },
          { id: "m2", label: "Gentle", text: f ? "I think a change of scenery might help. Want to take a short walk?" : "I think moving might help. Want to take a quick walk?" },
          { id: "m3", label: "Structured", text: "Suggestion: Take a 5-min walk\nReason: Reset the environment\nThen: Come back and talk for 10 min" },
        ],
        tips: ["Movement lowers cortisol. A walk changes the dynamic.", ...tipsCommon],
      };

    case "A17":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "I\u2019d like to write this down and share it with you." : "Let me write this down and share it." },
          { id: "m2", label: "Gentle", text: f ? "I think I can express this better in writing. Can I send you a note?" : "I think I\u2019ll say this better in writing. Can I send you a note?" },
          { id: "m3", label: "Structured", text: "What I want to say: ___\nWhy writing: I can organize my thoughts better\nPlease read when you\u2019re ready." },
        ],
        tips: ["Writing = organized thoughts. No pressure to respond immediately.", ...tipsCommon],
      };

    case "A18":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "Next time, I\u2019ll ___." : "Next time, I\u2019ll ___." },
          { id: "m2", label: "Gentle", text: f ? "Instead of going over what happened, can we focus on what we\u2019ll do differently?" : "Instead of replaying what happened, can we focus on next time?" },
          { id: "m3", label: "Structured", text: "What happened: (brief)\nWhat I\u2019ll do differently: ___\nWhat I\u2019d like from you: ___" },
        ],
        tips: ["Future focus = problem-solving. Past focus = blame.", ...tipsCommon],
        examples: ["I'll check in before making plans", "ask first instead of assuming"],
      };

    case "A19":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "I understand why you feel that way." : "I get why you feel that way." },
          { id: "m2", label: "Gentle", text: f ? "That makes sense from your perspective. I also want to share mine: ___." : "That makes sense from your side. I also want to share: ___." },
          { id: "m3", label: "Structured", text: "Your point: ___\nMy acknowledgment: ___\nMy perspective: ___" },
        ],
        tips: ["Validate first. They can\u2019t hear you until they feel heard.", ...tipsCommon],
        examples: ["you want more quality time together", "you felt left out of the decision"],
      };

    case "A20":
      return {
        messages: [
          { id: "m1", label: "Short", text: f ? "Remember when we handled ___ well?" : "Remember when we handled ___ well?" },
          { id: "m2", label: "Gentle", text: f ? "We\u2019ve done this before. Remember when ___? We can do it again." : "We\u2019ve done this before. Remember ___? We can do it again." },
          { id: "m3", label: "Structured", text: "Past win: ___\nWhat worked: ___\nLet\u2019s try that again now." },
        ],
        tips: ["Recall a shared win. It shifts the narrative.", ...tipsCommon],
        examples: ["we talked through the holiday plans calmly", "we compromised on the budget"],
      };

    default:
      return { messages: [], tips: tipsCommon };
  }
}

let currentSessionId: string | null = null;

async function copyToClipboard(text: string) {
  await Clipboard.setStringAsync(text);
  if (currentSessionId) recordSignal(currentSessionId, "copy");
}

export function ResultScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { ls, lsStyles } = useSensoryStyles();
  const { sessionId } = route.params;
  currentSessionId = sessionId;
  const [chosen, setChosen] = useState<ActionId | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState<RewardLabel | null>(null);

  const styles = useMemo(() => themedStyles(colors), [colors]);

  const prefs = useMemo<Personalization>(() => {
    const myName = (getSetting("myName") ?? "").trim();
    const partnerName = (getSetting("partnerName") ?? "").trim();
    const forbiddenRaw = getSetting("forbiddenPhrases") ?? "";
    const forbiddenPhrases = forbiddenRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const toneRaw = getSetting("tone");
    const tone: "casual" | "formal" = toneRaw === "formal" ? "formal" : "casual";
    return { myName, partnerName, forbiddenPhrases, tone };
  }, []);

  const session = useMemo(() => {
    const row = db.getFirstSync<{
      context_json: string;
      ranked_json: string;
    }>("SELECT context_json, ranked_json FROM coach_sessions WHERE id = ?", [sessionId]);

    if (!row) return null;
    const ctx = JSON.parse(row.context_json) as CoachContext;
    const ranked = JSON.parse(row.ranked_json) as ActionId[];

    const params = loadBanditParams();
    let scores: ActionScore[] = [];
    try {
      scores = rankActionsWithScores(ctx, ranked, params);
    } catch {}

    return { ctx, ranked, scores };
  }, [sessionId]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Session not found.</Text>
      </View>
    );
  }

  const ctx = session.ctx;

  function submitFeedback(label: RewardLabel) {
    if (!chosen) {
      Alert.alert("Select one", "Please pick a recommended action first.");
      return;
    }

    const baseReward = rewardValue(label);
    // Add implicit feedback bonus (copy tracking, script editing, etc.)
    const bonus = implicitRewardBonus(sessionId);
    const reward = Math.min(1.0, baseReward + bonus);

    const params = loadBanditParams();
    const next = updateTS(ctx, chosen, reward, params);
    saveBanditParams(next);

    // Record fingerprint event for couple pattern analysis
    recordFingerprintEvent(chosen, ctx.channel, ctx.intent, reward);

    // Save feedback to DB (was previously missing!)
    db.runSync(
      "INSERT INTO feedback(session_id, chosen_action, reward, created_at, context_json) VALUES(?, ?, ?, ?, ?)",
      [sessionId, chosen, reward, Date.now(), JSON.stringify(ctx)]
    );

    setSubmitted(true);
    setFeedbackLabel(label);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Recommended next action</Text>
      <Text style={styles.subtitle}>
        These options are ranked from your current context and past feedback.
        Pick one, then use the draft below as a starting point.
      </Text>

      <View style={[styles.card, ls && lsStyles?.card]}>
        <Text style={styles.cardTitle}>Top picks</Text>
        {session.ranked.map((id, idx) => {
          const active = chosen === id;
          const a = ACTIONS[id];
          const score = session.scores.find((s) => s.action === id);
          return (
            <Pressable
              key={id}
              onPress={() => setChosen(id)}
              style={[styles.item, active ? styles.itemActive : styles.itemInactive]}
              accessibilityRole="radio" accessibilityLabel={`${a.title}: ${a.description}`} accessibilityState={{ selected: active }}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, active ? styles.itemTitleActive : styles.itemTitleInactive]}>
                  {idx + 1}. {a.title}
                </Text>
                {score && score.pulls > 0 && (
                  <View style={[styles.confBadge, { opacity: active ? 1 : 0.7 }]}>
                    <Text style={[styles.confText, active && styles.confTextActive]}>
                      {score.confidence}%
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.itemDesc, active ? styles.itemDescActive : styles.itemDescInactive]}>
                {a.description}
              </Text>
              {active && score && score.pulls > 0 && (
                  <View style={styles.bayesBox}>
                  <Text style={styles.bayesLabel}>Model details</Text>
                  <View style={styles.bayesRow}>
                    <View style={styles.bayesStat}>
                      <Text style={styles.bayesValue}>{Math.round(score.mean * 100)}%</Text>
                      <Text style={styles.bayesKey}>expected</Text>
                    </View>
                    <View style={styles.bayesStat}>
                      <Text style={styles.bayesValue}>{Math.round(score.ci[0] * 100)}\u2013{Math.round(score.ci[1] * 100)}%</Text>
                      <Text style={styles.bayesKey}>90% CI</Text>
                    </View>
                    <View style={styles.bayesStat}>
                      <Text style={styles.bayesValue}>{Math.round(score.pBest * 100)}%</Text>
                      <Text style={styles.bayesKey}>P(best)</Text>
                    </View>
                    <View style={styles.bayesStat}>
                      <Text style={styles.bayesValue}>{score.pulls}</Text>
                      <Text style={styles.bayesKey}>obs</Text>
                    </View>
                  </View>
                  {/* CI bar visualization */}
                  <View style={styles.ciBarTrack}>
                    <View style={[styles.ciBarRange, {
                      left: `${Math.round(score.ci[0] * 100)}%` as any,
                      width: `${Math.round((score.ci[1] - score.ci[0]) * 100)}%` as any,
                    }]} />
                    <View style={[styles.ciBarMean, {
                      left: `${Math.round(score.mean * 100)}%` as any,
                    }]} />
                  </View>
                  <View style={styles.ciBarLabels}>
                    <Text style={styles.ciBarLabel}>0%</Text>
                    <Text style={styles.ciBarLabel}>50%</Text>
                    <Text style={styles.ciBarLabel}>100%</Text>
                  </View>
                </View>
              )}
              {active && a.intent && (
                <View style={styles.intentBox}>
                  <Text style={styles.intentLabel}>Why this action?</Text>
                  <Text style={styles.intentText}>{a.intent}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {chosen && (
        <View style={[styles.card, ls && lsStyles?.card]}>
          <Text style={styles.cardTitle}>Action script</Text>
          {(() => {
            const pack = buildScript(chosen, session.ctx, prefs);
            return (
              <View style={{ gap: 10 }}>
                {pack.checkIn && (
                  <View style={styles.scriptBox}>
                    <Text style={styles.scriptLabel}>Check-in question</Text>
                    <Text style={styles.scriptText}>
                      {applyForbiddenFilter(pack.checkIn, prefs.forbiddenPhrases)}
                    </Text>
                    <Pressable
                      style={[styles.copyBtn, ls && lsStyles?.primaryBtn]}
                      onPress={() =>
                        copyToClipboard(
                          applyForbiddenFilter(pack.checkIn!, prefs.forbiddenPhrases)
                        )
                      }
                      accessibilityRole="button" accessibilityLabel="Copy script to clipboard"
                    >
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </Pressable>
                  </View>
                )}

                {pack.messages.map((m) => (
                  <EditableScript
                    key={m.id}
                    label={m.label}
                    initialText={applyForbiddenFilter(m.text, prefs.forbiddenPhrases)}
                    examples={pack.examples}
                  />
                ))}

                <View style={styles.scriptBox}>
                  <Text style={styles.scriptLabel}>Tips</Text>
                  {pack.tips.slice(0, 3).map((t, i) => (
                    <Text key={String(i)} style={styles.tipText}>
                      {"\u2022"} {t}
                    </Text>
                  ))}
                  {prefs.forbiddenPhrases.length > 0 && (
                    <Text style={styles.tipText}>
                      {"\u2022"} Avoid phrases: {prefs.forbiddenPhrases.join(", ")}
                    </Text>
                  )}
                  {(prefs.myName || prefs.partnerName) && (
                    <Text style={styles.tipText}>
                      {"\u2022"} Names: {prefs.myName || "me"} / {prefs.partnerName || "you"}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}
        </View>
      )}

      <View style={[styles.card, ls && lsStyles?.card]}>
        <Text style={styles.cardTitle}>Outcome feedback</Text>
        {submitted ? (
          <View style={styles.feedbackDone}>
            <Text style={styles.feedbackDoneText}>
              Saved — {feedbackLabel}. Cue will use this the next time it ranks actions.
            </Text>
            <Pressable
              style={styles.resetBtn}
              onPress={() => { setChosen(null); setSubmitted(false); setFeedbackLabel(null); }}
              accessibilityRole="button" accessibilityLabel="Try a different action"
            >
              <Text style={styles.resetBtnText}>Try a different action</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.feedbackRow}>
            {(["Good", "Okay", "Bad"] as RewardLabel[]).map((lab) => (
              <Pressable
                key={lab}
                onPress={() => submitFeedback(lab)}
                style={[styles.fbBtn, ls && lsStyles?.primaryBtn]}
                accessibilityRole="button" accessibilityLabel={`Rate this action as ${lab}`}
              >
                <Text style={styles.fbBtnText}>{lab}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Coach")}
        accessibilityRole="button" accessibilityLabel="Start a new coaching session">
        <Text style={styles.secondaryBtnText}>Recommend for a different situation</Text>
      </Pressable>
    </ScrollView>
  );
}

function EditableScript({ label, initialText, examples }: { label: string; initialText: string; examples?: string[] }) {
  const { colors } = useTheme();
  const { ls, lsStyles } = useSensoryStyles();
  const [text, setText] = useState(initialText);
  const hasBlank = initialText.includes("___");

  const styles = useMemo(() => themedStyles(colors), [colors]);

  function fillExample(example: string) {
    setText((prev) => prev.replace("___", example));
  }

  return (
    <View style={styles.scriptBox}>
      <Text style={styles.scriptLabel}>{label}{hasBlank ? " (tap to fill in)" : ""}</Text>
      <TextInput
        style={styles.scriptInput}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Fill in your words here..."
        placeholderTextColor="#aaa"
      />
      {examples && examples.length > 0 && text.includes("___") && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {examples.map((ex, i) => (
            <Pressable key={String(i)} onPress={() => fillExample(ex)}
              style={styles.exampleChip}>
              <Text style={styles.exampleChipText}>{ex}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable style={[styles.copyBtn, ls && lsStyles?.primaryBtn]} onPress={() => copyToClipboard(text)}
        accessibilityRole="button" accessibilityLabel="Copy script to clipboard">
        <Text style={styles.copyBtnText}>Copy</Text>
      </Pressable>
    </View>
  );
}

/* =========================
   Themed Styles
   ========================= */

const themedStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.xxl, gap: spacing.xl, paddingBottom: spacing.pageBtm },
    title: { fontSize: font.xxl, fontWeight: font.bold, color: c.text },
    subtitle: { fontSize: font.md, color: c.textSecondary, lineHeight: 18 },

    card: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, padding: spacing.cardPad, gap: spacing.md, backgroundColor: c.card },
    cardTitle: { fontSize: font.base, fontWeight: font.bold, color: c.text },

    item: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: 6 },
    itemActive: { backgroundColor: c.btnPrimary, borderColor: c.btnPrimary },
    itemInactive: { backgroundColor: c.card, borderColor: c.border },
    itemTitle: { fontSize: font.base, fontWeight: font.bold },
    itemTitleActive: { color: c.btnPrimaryText },
    itemTitleInactive: { color: c.text },
    itemDesc: { fontSize: font.md, lineHeight: 18 },
    itemDescActive: { color: c.btnPrimaryText, opacity: 0.9 },
    itemDescInactive: { color: c.text, opacity: 0.75 },
    itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    confBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: c.confBadgeBg },
    confText: { fontSize: font.sm, fontWeight: font.extrabold, color: c.teal },
    confTextActive: { color: c.confBadgeActive },

    bayesBox: { marginTop: spacing.sm, backgroundColor: c.overlay12, borderRadius: radii.sm, padding: spacing.md, gap: 6 },
    bayesLabel: { fontSize: font.xs, fontWeight: font.extrabold, color: c.btnPrimaryText, opacity: 0.5, letterSpacing: 1 },
    bayesRow: { flexDirection: "row", justifyContent: "space-between" },
    bayesStat: { alignItems: "center" },
    bayesValue: { fontSize: font.md, fontWeight: font.extrabold, color: c.btnPrimaryText },
    bayesKey: { fontSize: font.xs, color: c.btnPrimaryText, opacity: 0.6 },
    ciBarTrack: { height: 6, backgroundColor: c.overlay15, borderRadius: 3, position: "relative" },
    ciBarRange: { position: "absolute", height: 6, backgroundColor: c.tealOverlay, borderRadius: 3 },
    ciBarMean: { position: "absolute", width: 3, height: 10, top: -2, backgroundColor: c.btnPrimaryText, borderRadius: 1 },
    ciBarLabels: { flexDirection: "row", justifyContent: "space-between" },
    ciBarLabel: { fontSize: 8, color: c.btnPrimaryText, opacity: 0.4 },

    intentBox: { marginTop: spacing.sm, backgroundColor: c.overlay15, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm },
    intentLabel: { fontSize: font.sm, fontWeight: font.extrabold, color: c.btnPrimaryText, opacity: 0.7 },
    intentText: { fontSize: 12, lineHeight: 18, color: c.btnPrimaryText, opacity: 0.9 },

    feedbackRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
    fbBtn: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radii.md, backgroundColor: c.btnPrimary },
    fbBtnText: { color: c.btnPrimaryText, fontWeight: font.extrabold },
    feedbackDone: { gap: spacing.md },
    feedbackDoneText: { fontSize: font.md, lineHeight: 18, color: c.textSecondary },
    resetBtn: { alignSelf: "flex-start", paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
    resetBtnText: { fontSize: font.md, fontWeight: font.semibold, color: c.text },

    note: { fontSize: 12, color: c.textSecondary, lineHeight: 18 },

    secondaryBtn: {
      paddingVertical: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    secondaryBtnText: { fontWeight: font.semibold, color: c.text },

    scriptBox: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    scriptLabel: { fontSize: font.md, fontWeight: font.extrabold, color: c.text },
    scriptText: { fontSize: font.md, lineHeight: 18, color: c.textSecondary },
    scriptInput: { fontSize: font.base, lineHeight: 20, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: radii.sm, padding: spacing.md, backgroundColor: c.cardElevated, minHeight: 60, textAlignVertical: "top" },
    tipText: { fontSize: font.md, lineHeight: 18, color: c.textSecondary },
    copyBtn: {
      alignSelf: "flex-start",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: c.btnPrimary,
    },
    copyBtnText: { color: c.btnPrimaryText, fontWeight: font.extrabold, fontSize: 12 },

    exampleChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.pill,
      backgroundColor: c.tealLight,
      borderWidth: 1,
      borderColor: c.teal,
    },
    exampleChipText: { fontSize: 12, color: c.teal, fontWeight: font.semibold },
  });
