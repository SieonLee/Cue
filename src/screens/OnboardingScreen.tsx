import React, { useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { db } from "../db/db";
import { setSetting } from "../db/sessions";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

type QOption = { label: string; value: string };

type Question = {
  id: string;
  text: string;
  options: QOption[];
};

const QUESTIONS: Question[] = [
  {
    id: "pref_channel",
    text: "Which communication channel works best for you?",
    options: [
      { label: "Text / messaging", value: "text" },
      { label: "Voice / phone call", value: "call" },
      { label: "In person", value: "in_person" },
      { label: "Depends on the situation", value: "mixed" },
    ],
  },
  {
    id: "pref_message_length",
    text: "When receiving a message about something important, which do you prefer?",
    options: [
      { label: "Short and direct (1-2 sentences)", value: "short" },
      { label: "Structured with clear steps", value: "structured" },
      { label: "Detailed with context", value: "detailed" },
    ],
  },
  {
    id: "pref_question_style",
    text: "When your partner asks you something, which format is easier to respond to?",
    options: [
      { label: "Yes / No question", value: "yes_no" },
      { label: "Two specific options to pick from", value: "choice" },
      { label: "Open-ended question", value: "open" },
    ],
  },
  {
    id: "pref_notice",
    text: "When plans change, how much advance notice helps you?",
    options: [
      { label: "As much as possible", value: "max" },
      { label: "A few hours is enough", value: "hours" },
      { label: "I'm okay with last-minute changes", value: "flexible" },
    ],
  },
  {
    id: "pref_overload",
    text: "When a conversation gets overwhelming, what helps most?",
    options: [
      { label: "Take a break and come back later", value: "break" },
      { label: "Switch to text instead of talking", value: "text" },
      { label: "Get a short summary of the key point", value: "summary" },
      { label: "Move to a quieter environment", value: "quiet" },
    ],
  },
  {
    id: "pref_tone",
    text: "Which tone feels more comfortable for difficult conversations?",
    options: [
      { label: "Casual and warm", value: "casual" },
      { label: "Calm and structured", value: "formal" },
    ],
  },
  {
    id: "pref_sensory",
    text: "Do you want reduced visual effects in the app? (simplified layouts, fewer animations)",
    options: [
      { label: "Yes, keep it simple", value: "low" },
      { label: "No, standard is fine", value: "standard" },
    ],
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);
  const [phase, setPhase] = useState<"intro" | "questions" | "done">("intro");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function pickAnswer(value: string) {
    const q = QUESTIONS[qIdx];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);

    if (qIdx < QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
    } else {
      saveAndFinish(next);
    }
  }

  function saveAndFinish(finalAnswers: Record<string, string>) {
    const now = Date.now();

    for (const [key, value] of Object.entries(finalAnswers)) {
      db.runSync(
        `INSERT INTO profile_assessment(key, value_json, completed_at)
         VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, completed_at=excluded.completed_at`,
        [key, JSON.stringify({ value }), now]
      );
    }

    if (finalAnswers.pref_tone) {
      setSetting("scriptTone", finalAnswers.pref_tone === "casual" ? "casual" : "formal");
    }
    if (finalAnswers.pref_question_style === "yes_no") {
      setSetting("yesNoHelpful", "true");
    }
    if (finalAnswers.pref_channel === "text") {
      setSetting("prefersTexting", "true");
    }
    if (finalAnswers.pref_sensory === "low") {
      setSetting("lowSensory", "true");
    }

    setSetting("onboarding_completed", "true");
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Set up your preferences</Text>
          <Text style={styles.subtitle}>
            7 quick questions about how you communicate.{"\n"}
            No diagnosis. No personality tests. Just your preferences.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What this does:</Text>
            <Text style={styles.cardItem}>• Personalizes which actions the app recommends</Text>
            <Text style={styles.cardItem}>• Adjusts message templates to your style</Text>
            <Text style={styles.cardItem}>• Sets up comfort options (tone, sensory, timing)</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What this does NOT do:</Text>
            <Text style={styles.cardItem}>• No personality classification</Text>
            <Text style={styles.cardItem}>• No relationship diagnosis</Text>
            <Text style={styles.cardItem}>• No interpretation of your partner</Text>
          </View>

          <Text style={styles.note}>
            All data stays on your device. You can change these anytime in Settings.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={() => setPhase("questions")}>
            <Text style={styles.primaryBtnText}>Start setup</Text>
          </Pressable>

          <Pressable style={styles.skipBtn} onPress={() => { setSetting("onboarding_completed", "true"); navigation.replace("Home"); }}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "questions") {
    const q = QUESTIONS[qIdx];
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.progressRow}>
            {QUESTIONS.map((_, i) => (
              <View key={i} style={[styles.progressSeg, i < qIdx ? styles.progressDone : i === qIdx ? styles.progressActive : null]} />
            ))}
          </View>

          <Text style={styles.counter}>{qIdx + 1} / {QUESTIONS.length}</Text>
          <Text style={styles.questionText}>{q.text}</Text>

          <View style={styles.optionList}>
            {q.options.map((opt) => (
              <Pressable key={opt.value} style={styles.optionCard} onPress={() => pickAnswer(opt.value)}>
                <Text style={styles.optionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          {qIdx > 0 && (
            <Pressable style={styles.backBtn} onPress={() => setQIdx(qIdx - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>You're all set</Text>
        <Text style={styles.subtitle}>
          Your preferences are saved. Cue will use them to shape recommendations
          and script tone.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your preferences:</Text>
          {Object.entries(answers).map(([key, val]) => {
            const q = QUESTIONS.find((qq) => qq.id === key);
            const opt = q?.options.find((o) => o.value === val);
            return (
              <View key={key} style={styles.prefRow}>
                <Text style={styles.prefKey}>{q?.text.split(",")[0].split("?")[0] ?? key}</Text>
                <Text style={styles.prefVal}>{opt?.label ?? val}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.note}>Change these anytime in Settings.</Text>

        <Pressable style={styles.primaryBtn} onPress={() => navigation.replace("Home")}>
          <Text style={styles.primaryBtnText}>Start using the app</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    container: { flexGrow: 1, padding: spacing.page, gap: spacing.xl, paddingBottom: spacing.pageBtm },
    title: { fontSize: font.xxxl, fontWeight: font.bold, color: c.text },
    subtitle: { fontSize: font.base, color: c.textSecondary, lineHeight: 20 },

    progressRow: { flexDirection: "row", gap: 4 },
    progressSeg: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: c.gray200 },
    progressActive: { backgroundColor: c.btnPrimary },
    progressDone: { backgroundColor: c.teal },

    counter: { fontSize: font.md, color: c.textTertiary, fontWeight: font.semibold },
    questionText: { fontSize: 18, fontWeight: font.bold, lineHeight: 26, color: c.text },

    optionList: { gap: 10 },
    optionCard: { borderWidth: 2, borderColor: c.border, borderRadius: radii.xl, padding: 16 },
    optionText: { fontSize: font.lg, fontWeight: font.semibold, lineHeight: 22, color: c.text },

    card: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, padding: spacing.cardPad, gap: 6 },
    cardTitle: { fontSize: font.base, fontWeight: font.bold, color: c.text },
    cardItem: { fontSize: font.md, color: c.textSecondary, lineHeight: 20 },

    prefRow: { borderBottomWidth: 1, borderBottomColor: c.borderLight, paddingVertical: 6 },
    prefKey: { fontSize: font.sm, color: c.textTertiary, fontWeight: font.semibold },
    prefVal: { fontSize: font.base, fontWeight: font.semibold, color: c.text },

    primaryBtn: { paddingVertical: 16, borderRadius: radii.lg, backgroundColor: c.btnPrimary, alignItems: "center" },
    primaryBtnText: { color: c.btnPrimaryText, fontWeight: font.bold, fontSize: font.lg },

    skipBtn: { alignItems: "center", paddingVertical: 10 },
    skipBtnText: { fontSize: font.md, color: c.textTertiary, textDecorationLine: "underline" },

    backBtn: { alignItems: "center", paddingVertical: 10 },
    backBtnText: { fontSize: font.md, color: c.textTertiary, fontWeight: font.semibold },

    note: { fontSize: font.sm, color: c.textTertiary, lineHeight: 16, textAlign: "center" },
  });
}
