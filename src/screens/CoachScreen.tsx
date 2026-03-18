import React, { useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { Channel, CoachContext, Intent, Stage, Tone } from "../types/models";
import { getSetting, loadBanditParams, loadLinUCBBanditParams } from "../db/sessions";
import { ruleCandidates } from "../coach/recommend";
import { rankActionsTS } from "../bandit/thompson";
import { rankActionsLinUCB, loadLinUCBParams } from "../bandit/linucb";
import { ALL_ACTION_IDS } from "../coach/actions";
import { assignAlgorithm } from "../db/signals";
import { db } from "../db/db";
import { useSensoryStyles } from "../hooks/useSensoryStyles";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, radii, spacing } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Coach">;

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Scenario cards ──────────────────────────────────────────────────────────

type Scenario = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  intent: Intent;
  stage: Stage;
};

const SCENARIOS: Scenario[] = [
  { id: "s1", emoji: "\uD83D\uDE14", title: "I need to apologize", subtitle: "I said or did something hurtful", intent: "apology", stage: "repair" },
  { id: "s2", emoji: "\uD83D\uDE24", title: "We're in an argument", subtitle: "The conversation is escalating", intent: "repair", stage: "escalation" },
  { id: "s3", emoji: "\uD83D\uDE4F", title: "I have a request", subtitle: "I need something from my partner", intent: "request", stage: "start" },
  { id: "s4", emoji: "\uD83D\uDEE1\uFE0F", title: "I need to set a boundary", subtitle: "Something is crossing my limits", intent: "boundary", stage: "start" },
  { id: "s5", emoji: "\uD83D\uDCC5", title: "Plans changed", subtitle: "Schedule or logistics to discuss", intent: "schedule_change", stage: "start" },
  { id: "s6", emoji: "\uD83D\uDD27", title: "Fixing after a fight", subtitle: "We need to repair and reconnect", intent: "repair", stage: "repair" },
  { id: "s7", emoji: "\uD83D\uDCAC", title: "Daily check-in", subtitle: "Just want to connect and see how they're doing", intent: "checkin", stage: "start" },
  { id: "s8", emoji: "\uD83C\uDF89", title: "Sharing good news", subtitle: "Something positive I want to share", intent: "positive", stage: "start" },
  { id: "s9", emoji: "\uD83D\uDCB8", title: "Money or logistics", subtitle: "Budget, bills, or household decisions", intent: "logistics", stage: "start" },
  { id: "s10", emoji: "\uD83D\uDE30", title: "I'm stressed or overwhelmed", subtitle: "I need support, not solutions", intent: "support", stage: "start" },
  { id: "s11", emoji: "\uD83D\uDD01", title: "Same fight, again", subtitle: "A recurring pattern we keep falling into", intent: "recurring", stage: "escalation" },
  { id: "s12", emoji: "\uD83E\uDD1D", title: "Making a decision together", subtitle: "We need to agree on something", intent: "decision", stage: "start" },
  { id: "s13", emoji: "\uD83D\uDE4F", title: "Expressing gratitude", subtitle: "I want to thank or appreciate my partner", intent: "gratitude", stage: "start" },
];

export function CoachScreen({ navigation }: Props) {
  const { ls, lsStyles } = useSensoryStyles();
  const { colors } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [channel, setChannel] = useState<Channel>("text");
  const [tiredFlag, setTiredFlag] = useState<0 | 1>(0);

  const [prefs, setPrefs] = useState<{ prefText: 0 | 1; prefYesNo: 0 | 1; noticeHours: number; tone: Tone }>({
    prefText: 1, prefYesNo: 1, noticeHours: 2, tone: "casual",
  });

  useFocusEffect(
    useCallback(() => {
      const prefText = (getSetting("prefText") ?? "1") === "1" ? 1 : 0;
      const prefYesNo = (getSetting("prefYesNo") ?? "1") === "1" ? 1 : 0;
      const noticeHours = parseInt(getSetting("noticeHours") ?? "2", 10) || 0;
      const toneRaw = getSetting("tone");
      const tone: Tone = toneRaw === "formal" ? "formal" : "casual";
      setPrefs({ prefText: prefText as 0 | 1, prefYesNo: prefYesNo as 0 | 1, noticeHours, tone });
    }, [])
  );

  function createSession() {
    if (!selected) return;

    const ctx: CoachContext = {
      intent: selected.intent,
      stage: selected.stage,
      channel,
      urgency: selected.stage === "escalation" ? 1 : 0,
      tiredFlag,
      prefText: prefs.prefText,
      prefYesNo: prefs.prefYesNo,
      noticeHours: prefs.noticeHours,
      tone: prefs.tone,
    };

    const candidates = ruleCandidates(ctx);
    const sessionId = uuid();

    // A/B test: randomly assign Thompson Sampling or LinUCB
    const algo = assignAlgorithm(sessionId);
    let ranked: string[];

    if (algo === "linucb") {
      const linParams = loadLinUCBParams(loadLinUCBBanditParams(), ALL_ACTION_IDS);
      ranked = rankActionsLinUCB(ctx, candidates, linParams);
    } else {
      const params = loadBanditParams();
      ranked = rankActionsTS(ctx, candidates, params);
    }

    db.runSync(
      "INSERT INTO coach_sessions(id, created_at, context_json, candidates_json, ranked_json) VALUES(?, ?, ?, ?, ?)",
      [sessionId, Date.now(), JSON.stringify(ctx), JSON.stringify(candidates), JSON.stringify(ranked)]
    );

    navigation.navigate("Result", { sessionId });
  }

  // Step 1: Choose scenario
  if (!selected) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>What's happening?</Text>
        <Text style={styles.subtitle}>Pick the scenario that best fits your situation right now.</Text>

        {SCENARIOS.map((s) => (
          <Pressable key={s.id} style={styles.scenarioCard} onPress={() => setSelected(s)}
            accessibilityRole="button" accessibilityLabel={`${s.title}: ${s.subtitle}`}>
            <Text style={[styles.scenarioEmoji, ls && lsStyles?.emoji]}>{s.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioTitle}>{s.title}</Text>
              <Text style={styles.scenarioSub}>{s.subtitle}</Text>
            </View>
            <Text style={styles.arrow}>{"\u203A"}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  // Step 2: Quick follow-up (channel + tired flag)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => setSelected(null)}
        accessibilityRole="button" accessibilityLabel="Change situation">
        <Text style={styles.backLink}>{"\u2190"} Change situation</Text>
      </Pressable>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedEmoji}>{selected.emoji}</Text>
        <Text style={styles.selectedTitle}>{selected.title}</Text>
      </View>

      <Text style={styles.questionTitle}>How are you communicating?</Text>
      <View style={styles.chipRow}>
        {([["text", "Text"], ["call", "Call"], ["in_person", "In person"]] as [Channel, string][]).map(([k, label]) => (
          <Pressable key={k} onPress={() => setChannel(k)}
            style={[styles.chip, channel === k ? [styles.chipActive, ls && lsStyles?.chipActive] : styles.chipInactive]}
            accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: channel === k }}>
            <Text style={[styles.chipText, channel === k ? styles.chipTextActive : styles.chipTextInactive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.questionTitle}>Do you think they may be tired or busy?</Text>
      <View style={styles.chipRow}>
        <Pressable onPress={() => setTiredFlag(0)}
          style={[styles.chip, tiredFlag === 0 ? [styles.chipActive, ls && lsStyles?.chipActive] : styles.chipInactive]}
          accessibilityRole="radio" accessibilityLabel="Partner is not tired or busy" accessibilityState={{ selected: tiredFlag === 0 }}>
          <Text style={[styles.chipText, tiredFlag === 0 ? styles.chipTextActive : styles.chipTextInactive]}>No</Text>
        </Pressable>
        <Pressable onPress={() => setTiredFlag(1)}
          style={[styles.chip, tiredFlag === 1 ? [styles.chipActive, ls && lsStyles?.chipActive] : styles.chipInactive]}
          accessibilityRole="radio" accessibilityLabel="Partner may be tired or busy" accessibilityState={{ selected: tiredFlag === 1 }}>
          <Text style={[styles.chipText, tiredFlag === 1 ? styles.chipTextActive : styles.chipTextInactive]}>Yes</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.primaryBtn, ls && lsStyles?.primaryBtn]} onPress={createSession}
        accessibilityRole="button" accessibilityLabel="Get action recommendation">
        <Text style={styles.primaryBtnText}>Get recommendation</Text>
      </Pressable>

      <Text style={styles.note}>
        Your profile and past feedback are used to personalize recommendations.
      </Text>
    </ScrollView>
  );
}

const themedStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.page, gap: spacing.cardPad, paddingBottom: 28 },
    title: { fontSize: 22, fontWeight: "700", color: c.text },
    subtitle: { fontSize: 14, color: c.text, opacity: 0.7, lineHeight: 20 },

    scenarioCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      borderWidth: 1, borderColor: c.border, borderRadius: radii.xl, padding: 16,
      backgroundColor: c.cardElevated,
    },
    scenarioEmoji: { fontSize: 28 },
    scenarioTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    scenarioSub: { fontSize: 12, color: c.textTertiary, lineHeight: 16 },
    arrow: { fontSize: 22, color: c.textTertiary, opacity: 0.3, fontWeight: "300" },

    backLink: { fontSize: 14, color: c.teal, fontWeight: "600" },

    selectedCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      borderWidth: 2, borderColor: c.text, borderRadius: radii.xl, padding: 16,
      backgroundColor: c.cardElevated,
    },
    selectedEmoji: { fontSize: 28 },
    selectedTitle: { fontSize: 17, fontWeight: "800", color: c.text },

    questionTitle: { fontSize: 15, fontWeight: "700", marginTop: 4, color: c.text },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1 },
    chipActive: { backgroundColor: c.chipActive, borderColor: c.chipActiveBorder },
    chipInactive: { backgroundColor: c.chipInactive, borderColor: c.chipInactiveBorder },
    chipText: { fontSize: 14, fontWeight: "600" },
    chipTextActive: { color: c.chipActiveText },
    chipTextInactive: { color: c.chipInactiveText },

    primaryBtn: { marginTop: 8, paddingVertical: 16, borderRadius: radii.lg, backgroundColor: c.btnPrimary, alignItems: "center" },
    primaryBtnText: { color: c.btnPrimaryText, fontWeight: "700", fontSize: 16 },

    note: { fontSize: 12, color: c.textTertiary, lineHeight: 18, textAlign: "center" },
  });
