/**
 * AsyncScreen — Paired-style async partner mode
 *
 * Flow:
 * 1. Show card question (navigated from DailyCard)
 * 2. Profile A answers first (partner's answer hidden)
 * 3. Option: "What do you think they said?" prediction game
 * 4. Profile B answers
 * 5. Reveal both answers + prediction results
 *
 * Answers are stored in SQLite async_sessions (raw text — user-entered content)
 * Sensitive data note: Data from this screen is excluded from exports
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { useProfile } from "../context/ProfileContext";
import { getSetting } from "../db/sessions";
import { CARDS } from "./DailyCardScreen";
import type { DailyCard } from "./DailyCardScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Async">;

type AsyncRow = {
  id: string;
  card_id: string;
  profile_a_answer: string | null;
  profile_b_answer: string | null;
  a_prediction: string | null;
  b_prediction: string | null;
  created_at: number;
  completed_at: number | null;
};

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Step = "answer_a" | "predict_a" | "answer_b" | "predict_b" | "reveal";

export function AsyncScreen({ route }: Props) {
  const cardId = route.params?.cardId ?? CARDS[0].id;
  const { activeProfile } = useProfile();
  const myName = getSetting("myName") || "A";
  const partnerName = getSetting("partnerName") || "B";

  const card = useMemo(
    () => (cardId ? CARDS.find((c: DailyCard) => c.id === cardId) : undefined) ?? CARDS[0],
    [cardId]
  );

  const [session, setSession] = useState<AsyncRow | null>(null);
  const [step, setStep] = useState<Step>("answer_a");
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [predA, setPredA] = useState(""); // A predicts B's answer
  const [predB, setPredB] = useState(""); // B predicts A's answer

  // Load or create session for today's card
  useFocusEffect(
    useCallback(() => {
      const existing = db.getFirstSync<AsyncRow>(
        "SELECT * FROM async_sessions WHERE card_id = ? ORDER BY created_at DESC LIMIT 1",
        [cardId]
      );
      if (existing) {
        setSession(existing);
        setInputA(existing.profile_a_answer ?? "");
        setInputB(existing.profile_b_answer ?? "");
        setPredA(existing.a_prediction ?? "");
        setPredB(existing.b_prediction ?? "");
        // Determine step from saved state
        if (existing.completed_at) setStep("reveal");
        else if (existing.profile_b_answer) setStep("predict_b");
        else if (existing.a_prediction) setStep("answer_b");
        else if (existing.profile_a_answer) setStep("predict_a");
        else setStep("answer_a");
      } else {
        const newId = uuid();
        const now = Date.now();
        db.runSync(
          "INSERT INTO async_sessions(id, card_id, created_at) VALUES(?, ?, ?)",
          [newId, cardId, now]
        );
        const created = db.getFirstSync<AsyncRow>(
          "SELECT * FROM async_sessions WHERE id = ?", [newId]
        );
        setSession(created ?? null);
        setStep("answer_a");
      }
    }, [cardId])
  );

  if (!session) return null;

  function saveA() {
    if (!inputA.trim()) { Alert.alert("Please enter an answer."); return; }
    db.runSync("UPDATE async_sessions SET profile_a_answer = ? WHERE id = ?", [inputA.trim(), session!.id]);
    setStep("predict_a");
  }

  function savePredA() {
    db.runSync("UPDATE async_sessions SET a_prediction = ? WHERE id = ?", [predA.trim(), session!.id]);
    setStep("answer_b");
  }

  function saveB() {
    if (!inputB.trim()) { Alert.alert("Please enter an answer."); return; }
    db.runSync("UPDATE async_sessions SET profile_b_answer = ? WHERE id = ?", [inputB.trim(), session!.id]);
    setStep("predict_b");
  }

  function savePredB() {
    db.runSync(
      "UPDATE async_sessions SET b_prediction = ?, completed_at = ? WHERE id = ?",
      [predB.trim(), Date.now(), session!.id]
    );
    setStep("reveal");
  }

  const STEP_LABELS: Record<Step, string> = {
    answer_a:  `${myName} answers`,
    predict_a: `${myName} predicts ${partnerName}'s answer`,
    answer_b:  `${partnerName} answers`,
    predict_b: `${partnerName} predicts ${myName}'s answer`,
    reveal:    "Compare answers",
  };

  const STEPS: Step[] = ["answer_a", "predict_a", "answer_b", "predict_b", "reveal"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[styles.progressDot, i <= stepIdx && styles.progressDotActive]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>

      {/* Question */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{card.question}</Text>
        {card.intent && (
          <Text style={styles.intentText}>{card.intent}</Text>
        )}
      </View>

      {/* Step content */}
      {step === "answer_a" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{myName}, answer below. {partnerName} won't see this until they answer too.</Text>
          <TextInput
            style={styles.textInput}
            value={inputA}
            onChangeText={setInputA}
            placeholder="Your answer…"
            multiline
          />
          <Pressable style={styles.primaryBtn} onPress={saveA}>
            <Text style={styles.primaryBtnText}>Save & continue →</Text>
          </Pressable>
        </View>
      )}

      {step === "predict_a" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>
            Before seeing {partnerName}'s answer — what do you think they said?
          </Text>
          <TextInput
            style={styles.textInput}
            value={predA}
            onChangeText={setPredA}
            placeholder={`Your guess for ${partnerName}…`}
            multiline
          />
          <View style={styles.btnRow}>
            <Pressable style={styles.primaryBtn} onPress={savePredA}>
              <Text style={styles.primaryBtnText}>Save prediction →</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => { setPredA(""); savePredA(); }}>
              <Text style={styles.secondaryBtnText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "answer_b" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>{partnerName}, your turn. {myName}'s answer is hidden until you answer.</Text>
          <TextInput
            style={styles.textInput}
            value={inputB}
            onChangeText={setInputB}
            placeholder="Your answer…"
            multiline
          />
          <Pressable style={styles.primaryBtn} onPress={saveB}>
            <Text style={styles.primaryBtnText}>Save & continue →</Text>
          </Pressable>
        </View>
      )}

      {step === "predict_b" && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>
            {partnerName}, what do you think {myName} said?
          </Text>
          <TextInput
            style={styles.textInput}
            value={predB}
            onChangeText={setPredB}
            placeholder={`Your guess for ${myName}…`}
            multiline
          />
          <View style={styles.btnRow}>
            <Pressable style={styles.primaryBtn} onPress={savePredB}>
              <Text style={styles.primaryBtnText}>Reveal answers →</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => { setPredB(""); savePredB(); }}>
              <Text style={styles.secondaryBtnText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "reveal" && (
        <View style={styles.revealSection}>
          <AnswerBlock
            name={myName}
            answer={inputA}
            prediction={predB}
            predictionBy={partnerName}
          />
          <AnswerBlock
            name={partnerName}
            answer={inputB}
            prediction={predA}
            predictionBy={myName}
          />
          <View style={styles.reflectCard}>
            <Text style={styles.reflectTitle}>Reflect together</Text>
            <Text style={styles.reflectItem}>• Were any answers surprising?</Text>
            <Text style={styles.reflectItem}>• Where did your predictions match?</Text>
            <Text style={styles.reflectItem}>• Is there anything you want to talk about further?</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function AnswerBlock({
  name, answer, prediction, predictionBy,
}: {
  name: string;
  answer: string;
  prediction: string;
  predictionBy: string;
}) {
  const match = prediction && answer &&
    prediction.trim().toLowerCase().slice(0, 20) === answer.trim().toLowerCase().slice(0, 20);

  return (
    <View style={ab.card}>
      <Text style={ab.name}>{name}</Text>
      <View style={ab.answerBox}>
        <Text style={ab.answerLabel}>ANSWER</Text>
        <Text style={ab.answerText}>{answer || "—"}</Text>
      </View>
      {prediction ? (
        <View style={[ab.predBox, match && ab.predBoxMatch]}>
          <Text style={ab.predLabel}>{predictionBy}'s prediction</Text>
          <Text style={ab.predText}>{prediction}</Text>
          {match && <Text style={ab.matchBadge}>Close match 🎯</Text>}
        </View>
      ) : null}
    </View>
  );
}

const ab = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 14, gap: 10 },
  name: { fontSize: 14, fontWeight: "800" },
  answerBox: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 12, gap: 4 },
  answerLabel: { fontSize: 10, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  answerText: { fontSize: 14, lineHeight: 20 },
  predBox: { backgroundColor: "#f0f0f0", borderRadius: 10, padding: 12, gap: 4 },
  predBoxMatch: { backgroundColor: "#f0faf9", borderColor: "#2a9d8f", borderWidth: 1 },
  predLabel: { fontSize: 10, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  predText: { fontSize: 13, lineHeight: 18, opacity: 0.8 },
  matchBadge: { fontSize: 12, fontWeight: "700", color: "#2a9d8f" },
});

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },

  progressRow: { flexDirection: "row", gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#eee" },
  progressDotActive: { backgroundColor: "black" },
  stepLabel: { fontSize: 13, fontWeight: "700", opacity: 0.6 },

  questionCard: { borderWidth: 1, borderColor: "#ddd", borderRadius: 14, padding: 16, gap: 8 },
  questionText: { fontSize: 16, fontWeight: "700", lineHeight: 24 },
  intentText: { fontSize: 12, lineHeight: 18, opacity: 0.6 },

  inputSection: { gap: 12 },
  inputLabel: { fontSize: 13, lineHeight: 18, opacity: 0.7 },
  textInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12,
    padding: 14, fontSize: 14, lineHeight: 20, minHeight: 100,
    textAlignVertical: "top",
  },
  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: "black", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center" },
  secondaryBtnText: { fontWeight: "600" },

  revealSection: { gap: 14 },
  reflectCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 8 },
  reflectTitle: { fontSize: 14, fontWeight: "700" },
  reflectItem: { fontSize: 13, lineHeight: 20, opacity: 0.8 },
});
