import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { detectSignals } from "../nlp/sentiment";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { loadBanditParams, getSetting } from "../db/sessions";
import { rankActionsTS } from "../bandit/thompson";
import { ruleCandidates } from "../coach/recommend";
import type { CoachContext } from "../types/models";

type ActionGuide = { actionId: ActionId; title: string; template: string };
type SuggestionSet = {
  urgencyDetected: boolean;
  urgencyPatterns: string[];
  actions: ActionGuide[];
};

const TEMPLATES: Record<ActionId, string> = {
  A1: "Is now an okay time to talk about this?",
  A2: "Can we take a 15-minute break and come back to this?",
  A3: "Here's what I'm hearing: ___. Did I get that right?",
  A4: "Would you prefer to talk about this now, or find a better time?",
  A5: "The one thing I'd like to ask is: ___",
  A6: "I'm sorry about ___. Going forward, I'll ___.",
  A7: "I need ___. This isn't about blame \u2014 it's what I need right now.",
  A8: "I appreciate that you ___. It meant a lot.",
  A9: "So we're on the same page: we agreed to ___. Sound right?",
  A10: "I feel ___ when ___. I'm sharing, not blaming.",
  A11: "So what you're saying is ___. Did I get that right?",
  A12: "Can we set a time to talk about this? How about ___?",
  A13: "My energy right now is ___/10.",
  A14: "Let's focus on just one thing: ___.",
  A15: "First, I want to say ___. And I also want to bring up ___.",
  A16: "Can we take a short walk and continue talking?",
  A17: "I'll express this better in writing. Can I send you a note?",
  A18: "Instead of replaying what happened, let's focus on next time.",
  A19: "I understand why you feel that way. I also want to share: ___.",
  A20: "Remember when we handled ___ well? We can do it again.",
};

function inferIntent(text: string): CoachContext["intent"] {
  const lower = text.toLowerCase();
  if (/sorry|apolog|미안|잘못/i.test(lower)) return "apology";
  if (/boundar|stop|don't|하지\s*마|경계/i.test(lower)) return "boundary";
  if (/schedul|plan|time|cancel|시간|약속|취소/i.test(lower)) return "schedule_change";
  if (/fix|repair|make up|화해|풀자/i.test(lower)) return "repair";
  return "request";
}

function analyzeAndRecommend(text: string): SuggestionSet {
  if (!text.trim()) return { urgencyDetected: false, urgencyPatterns: [], actions: [] };

  const signals = detectSignals(text);
  const intent = inferIntent(text);
  const stage = signals.hasUrgency ? "escalation" as const : "start" as const;
  const prefText = getSetting("prefersTexting") === "true" ? 1 : 0;
  const prefYesNo = getSetting("yesNoHelpful") === "true" ? 1 : 0;
  const tone = (getSetting("scriptTone") as "casual" | "formal") || "casual";

  const ctx: CoachContext = {
    intent, stage, channel: "text", urgency: stage === "escalation" ? 1 : 0,
    tiredFlag: 0, prefText: prefText as 0 | 1, prefYesNo: prefYesNo as 0 | 1,
    noticeHours: 0, tone,
  };

  const candidates = ruleCandidates(ctx);
  const params = loadBanditParams();
  const ranked = rankActionsTS(ctx, candidates, params);

  return {
    urgencyDetected: signals.hasUrgency,
    urgencyPatterns: signals.urgencySignals,
    actions: ranked.slice(0, 3).map((id) => ({
      actionId: id, title: ACTIONS[id].title, template: TEMPLATES[id],
    })),
  };
}

export function LiveCoachScreen() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionSet | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleAnalyze = () => {
    if (!input.trim()) return;
    setSuggestions(analyzeAndRecommend(input));
    setCopiedIdx(null);
  };

  const copyTemplate = async (text: string, idx: number) => {
    await Clipboard.setStringAsync(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        Describe what's happening or paste the message you're working on.{"\n"}
        Cue will suggest a few actions and give you a draft to start from.
      </Text>

      <TextInput
        style={styles.input} multiline value={input} onChangeText={setInput}
        placeholder="What's happening right now?" placeholderTextColor="#aaa"
      />
      <Pressable style={styles.analyzeBtn} onPress={handleAnalyze}>
        <Text style={styles.analyzeBtnText}>Get suggestions</Text>
      </Pressable>

      {suggestions && suggestions.actions.length > 0 && (
        <View style={styles.results}>
          {suggestions.urgencyDetected && (
            <View style={styles.urgencyCard}>
              <Text style={styles.urgencyLabel}>Urgency came up</Text>
              <Text style={styles.urgencyDesc}>
                It may help to pause first and reset the tone before replying.
              </Text>
              {suggestions.urgencyPatterns.map((p, i) => (
                <Text key={i} style={styles.urgencyPattern}>"{p}"</Text>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>Suggested actions</Text>
          {suggestions.actions.map((action, idx) => (
            <View key={action.actionId} style={styles.actionCard}>
              <View style={styles.actionHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDesc}>{ACTIONS[action.actionId].description}</Text>
                </View>
              </View>
              <View style={styles.templateBox}>
                <Text style={styles.templateLabel}>Draft reply</Text>
                <Pressable onPress={() => copyTemplate(action.template, idx)}>
                  <Text style={styles.templateText}>{action.template}</Text>
                </Pressable>
                <Pressable
                  style={[styles.copyBtn, copiedIdx === idx && styles.copyBtnDone]}
                  onPress={() => copyTemplate(action.template, idx)}
                >
                  <Text style={styles.copyBtnText}>{copiedIdx === idx ? "Copied" : "Copy"}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text style={styles.note}>
            These suggestions get better as you leave feedback.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },
  subtitle: { fontSize: 13, opacity: 0.6, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: "top", backgroundColor: "#fafafa" },
  analyzeBtn: { backgroundColor: "black", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  analyzeBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  results: { gap: 12 },
  urgencyCard: { borderWidth: 1, borderColor: "#f4a261", borderRadius: 12, padding: 12, gap: 4, backgroundColor: "#fffbf0" },
  urgencyLabel: { fontSize: 10, fontWeight: "800", color: "#e76f51", letterSpacing: 1 },
  urgencyDesc: { fontSize: 13, lineHeight: 18 },
  urgencyPattern: { fontSize: 12, fontStyle: "italic", opacity: 0.6 },
  sectionLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },
  actionCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10, backgroundColor: "#fafafa" },
  actionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#2a9d8f", alignItems: "center", justifyContent: "center" },
  rankText: { color: "white", fontSize: 12, fontWeight: "800" },
  actionTitle: { fontSize: 15, fontWeight: "700" },
  actionDesc: { fontSize: 12, opacity: 0.6, lineHeight: 16 },
  templateBox: { backgroundColor: "#f0faf9", borderWidth: 1, borderColor: "#2a9d8f", borderRadius: 10, padding: 12, gap: 6 },
  templateLabel: { fontSize: 9, fontWeight: "800", color: "#2a9d8f", letterSpacing: 1 },
  templateText: { fontSize: 14, lineHeight: 20 },
  copyBtn: { alignSelf: "flex-start", backgroundColor: "#2a9d8f", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  copyBtnDone: { backgroundColor: "#264653" },
  copyBtnText: { color: "white", fontWeight: "700", fontSize: 12 },
  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
