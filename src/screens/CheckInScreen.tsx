import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useSensory } from "../context/SensoryContext";

type Props = NativeStackScreenProps<RootStackParamList, "CheckIn">;

type Answer = "yes" | "no" | null;

const QUESTIONS: { id: string; text: string; safeAnswer: Answer }[] = [
  {
    id: "q1",
    text: "My body feels calm enough to have a conversation.",
    safeAnswer: "yes",
  },
  {
    id: "q2",
    text: "I can hear what they say without immediately reacting.",
    safeAnswer: "yes",
  },
  {
    id: "q3",
    text: "I have at least 10 minutes without interruption.",
    safeAnswer: "yes",
  },
];

function readiness(answers: Record<string, Answer>): {
  level: "ready" | "caution" | "not_ready";
  message: string;
} {
  const yesCount = Object.values(answers).filter((a) => a === "yes").length;
  const answered = Object.values(answers).filter((a) => a !== null).length;
  if (answered < QUESTIONS.length) return { level: "caution", message: "Answer all questions first." };
  if (yesCount === QUESTIONS.length) return { level: "ready", message: "Good to go. Start the conversation." };
  if (yesCount >= 2) return { level: "caution", message: "Proceed with care. Consider texting instead." };
  return { level: "not_ready", message: "Not the best time. Try a timeout first (A2)." };
}

export function CheckInScreen({ navigation }: Props) {
  const { lowSensory } = useSensory();
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, null]))
  );

  const { level, message } = readiness(answers);

  function answer(id: string, val: Answer) {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  }

  const levelColor = level === "ready" ? "#2a9d8f" : level === "caution" ? "#f4a261" : "#e63946";

  return (
    <ScrollView contentContainerStyle={[styles.container, lowSensory && styles.containerLow]}>
      <Text style={styles.title}>Before you talk</Text>
      {!lowSensory && (
        <Text style={styles.subtitle}>
          3 quick questions. Answer honestly — no right or wrong.
        </Text>
      )}

      {QUESTIONS.map((q) => (
        <View key={q.id} style={[styles.card, lowSensory && styles.cardLow]}>
          <Text style={styles.questionText}>{q.text}</Text>
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => answer(q.id, "yes")}
              style={[styles.answerBtn, answers[q.id] === "yes" && styles.answerBtnActive]}
            >
              <Text style={[styles.answerBtnText, answers[q.id] === "yes" && styles.answerBtnTextActive]}>
                Yes
              </Text>
            </Pressable>
            <Pressable
              onPress={() => answer(q.id, "no")}
              style={[styles.answerBtn, answers[q.id] === "no" && styles.answerBtnNo]}
            >
              <Text style={[styles.answerBtnText, answers[q.id] === "no" && styles.answerBtnTextActive]}>
                No
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={[styles.resultCard, { borderColor: levelColor }]}>
        <Text style={[styles.resultText, { color: levelColor }]}>{message}</Text>
      </View>

      <View style={styles.actionRow}>
        {level === "ready" && (
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Coach")}>
            <Text style={styles.primaryBtnText}>Start coaching →</Text>
          </Pressable>
        )}
        {level === "not_ready" && (
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Timer")}>
            <Text style={styles.secondaryBtnText}>Start timeout timer</Text>
          </Pressable>
        )}
        {level === "caution" && (
          <>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Coach")}>
              <Text style={styles.primaryBtnText}>Continue anyway</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Timer")}>
              <Text style={styles.secondaryBtnText}>Take a timeout first</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },
  containerLow: { backgroundColor: "#f9f9f9" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 12 },
  cardLow: { borderRadius: 6, borderColor: "#ccc" },
  questionText: { fontSize: 15, lineHeight: 22 },

  btnRow: { flexDirection: "row", gap: 10 },
  answerBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  answerBtnActive: { backgroundColor: "#2a9d8f", borderColor: "#2a9d8f" },
  answerBtnNo: { backgroundColor: "#e63946", borderColor: "#e63946" },
  answerBtnText: { fontWeight: "700", fontSize: 14 },
  answerBtnTextActive: { color: "white" },

  resultCard: {
    borderWidth: 2, borderRadius: 12, padding: 14,
  },
  resultText: { fontSize: 15, fontWeight: "700", lineHeight: 22 },

  actionRow: { gap: 10 },
  primaryBtn: { paddingVertical: 14, borderRadius: 10, backgroundColor: "black", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  secondaryBtnText: { fontWeight: "600" },
});
