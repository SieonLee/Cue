/**
 * ReviewScreen — Session Outcome Review
 *
 * Post-session structured review that captures data signals:
 * - Observed outcome category (5 options)
 * - Self-rated energy before/after (1-10 scale)
 * - What worked / what to change (free text)
 * - Would use this action again? (boolean)
 *
 * Feeds into the Pattern Dashboard for action effectiveness analysis.
 * NO emotion interpretation. NO comfort language. ONLY data collection.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import type { CoachContext } from "../types/models";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

type SessionRow = {
  id: string;
  created_at: number;
  context_json: string;
  ranked_json: string;
};

type FeedbackRow = {
  session_id: string;
  chosen_action: string;
  reward: number;
  created_at: number;
};

type ReviewRow = {
  id: string;
  session_id: string;
};

const REACTIONS = [
  { id: "receptive", emoji: "😊", label: "Receptive", desc: "Listened and engaged" },
  { id: "neutral", emoji: "😐", label: "Neutral", desc: "No strong reaction" },
  { id: "confused", emoji: "😕", label: "Confused", desc: "Didn't understand my point" },
  { id: "defensive", emoji: "😤", label: "Defensive", desc: "Pushed back or got upset" },
  { id: "shutdown", emoji: "😶", label: "Shut down", desc: "Withdrew or went silent" },
] as const;

type ReactionId = typeof REACTIONS[number]["id"];

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function EmotionSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={sl.container}>
      <Text style={sl.label}>{label}</Text>
      <View style={sl.track}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[
              sl.dot,
              n <= value && sl.dotActive,
              n === value && sl.dotSelected,
            ]}
          >
            <Text style={[sl.dotText, n <= value && sl.dotTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={sl.labelRow}>
        <Text style={sl.endLabel}>1 (low)</Text>
        <Text style={sl.endLabel}>10 (high)</Text>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  track: { flexDirection: "row", gap: 4 },
  dot: {
    flex: 1, aspectRatio: 1, borderRadius: 999,
    borderWidth: 1, borderColor: "#ddd",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "white",
  },
  dotActive: { backgroundColor: "#e8f5e9", borderColor: "#2a9d8f" },
  dotSelected: { backgroundColor: "#2a9d8f", borderColor: "#2a9d8f" },
  dotText: { fontSize: 11, fontWeight: "700", color: "#999" },
  dotTextActive: { color: "#2a9d8f" },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  endLabel: { fontSize: 11, opacity: 0.5 },
});

export function ReviewScreen({ navigation }: Props) {
  // Load recent sessions that have feedback but no review yet
  const [sessions, setSessions] = useState<
    (SessionRow & { feedback: FeedbackRow })[]
  >([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Review form state
  const [reaction, setReaction] = useState<ReactionId | null>(null);
  const [emotionBefore, setEmotionBefore] = useState(5);
  const [emotionAfter, setEmotionAfter] = useState(5);
  const [whatWorked, setWhatWorked] = useState("");
  const [whatToChange, setWhatToChange] = useState("");
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Stats
  const [totalReviews, setTotalReviews] = useState(0);
  const [avgEmotionShift, setAvgEmotionShift] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // Find sessions with feedback but without a review
      const feedbackSessions = db.getAllSync<SessionRow & FeedbackRow & { f_created_at: number }>(
        `SELECT s.id, s.created_at, s.context_json, s.ranked_json,
                f.session_id, f.chosen_action, f.reward, f.created_at as f_created_at
         FROM coach_sessions s
         INNER JOIN feedback f ON f.session_id = s.id
         WHERE s.id NOT IN (SELECT session_id FROM outcome_reviews)
         ORDER BY s.created_at DESC
         LIMIT 10`
      );

      const mapped = feedbackSessions.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        context_json: r.context_json,
        ranked_json: r.ranked_json,
        feedback: {
          session_id: r.session_id,
          chosen_action: r.chosen_action,
          reward: r.reward,
          created_at: r.f_created_at ?? r.created_at,
        },
      }));
      setSessions(mapped);

      // Load review stats
      const countRow = db.getFirstSync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM outcome_reviews"
      );
      setTotalReviews(countRow?.cnt ?? 0);

      const shiftRow = db.getFirstSync<{ avg_shift: number }>(
        "SELECT AVG(emotion_after - emotion_before) as avg_shift FROM outcome_reviews"
      );
      setAvgEmotionShift(shiftRow?.avg_shift ?? 0);

      setSubmitted(false);
      setReaction(null);
      setEmotionBefore(5);
      setEmotionAfter(5);
      setWhatWorked("");
      setWhatToChange("");
      setWouldUseAgain(null);
    }, [])
  );

  const current = sessions[selectedIdx];

  function submitReview() {
    if (!current || !reaction) {
      Alert.alert("Missing info", "Please select an outcome category.");
      return;
    }
    if (wouldUseAgain === null) {
      Alert.alert("Missing info", "Would you use this action again?");
      return;
    }

    const id = uuid();
    db.runSync(
      `INSERT INTO outcome_reviews (id, session_id, chosen_action, partner_reaction,
       emotion_before, emotion_after, what_worked, what_to_change, would_use_again, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        current.id,
        current.feedback.chosen_action,
        reaction,
        emotionBefore,
        emotionAfter,
        whatWorked.trim() || null,
        whatToChange.trim() || null,
        wouldUseAgain ? 1 : 0,
        Date.now(),
      ]
    );

    setSubmitted(true);
  }

  // Empty state
  if (sessions.length === 0 && !submitted) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Conversation Review</Text>

        {totalReviews > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All caught up!</Text>
            <Text style={styles.subtitle}>
              No pending sessions to review. Come back after your next coaching session.
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{totalReviews}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: avgEmotionShift >= 0 ? "#2a9d8f" : "#e63946" }]}>
                  {avgEmotionShift >= 0 ? "+" : ""}{avgEmotionShift.toFixed(1)}
                </Text>
                <Text style={styles.statLabel}>Avg energy shift</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No sessions to review yet</Text>
            <Text style={styles.subtitle}>
              Complete a coaching session and give feedback first. Then come back here to do a deeper
              review of how the conversation went.
            </Text>
          </View>
        )}

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Patterns")}>
          <Text style={styles.secondaryBtnText}>View pattern dashboard →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Submitted state
  if (submitted) {
    const shift = emotionAfter - emotionBefore;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Review saved</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review recorded</Text>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{emotionBefore} → {emotionAfter}</Text>
              <Text style={styles.statLabel}>Energy shift</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{wouldUseAgain ? "Yes" : "No"}</Text>
              <Text style={styles.statLabel}>Would use again</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            This review helps the app learn which actions work best for you in different situations.
          </Text>
        </View>

        {sessions.length > 1 && selectedIdx < sessions.length - 1 ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setSelectedIdx((i) => i + 1);
              setSubmitted(false);
              setReaction(null);
              setEmotionBefore(5);
              setEmotionAfter(5);
              setWhatWorked("");
              setWhatToChange("");
              setWouldUseAgain(null);
            }}
          >
            <Text style={styles.primaryBtnText}>Review next session →</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Patterns")}>
          <Text style={styles.secondaryBtnText}>View pattern dashboard →</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Home")}>
          <Text style={styles.secondaryBtnText}>Back to home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Review form
  const ctx: CoachContext = JSON.parse(current.context_json);
  const actionId = current.feedback.chosen_action as ActionId;
  const action = ACTIONS[actionId];
  const sessionDate = new Date(current.created_at);
  const dateStr = `${sessionDate.getMonth() + 1}/${sessionDate.getDate()} ${sessionDate.getHours()}:${String(sessionDate.getMinutes()).padStart(2, "0")}`;
  const rewardLabel = current.feedback.reward >= 0.75 ? "Good" : current.feedback.reward >= 0.25 ? "Okay" : "Bad";

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Review your conversation</Text>
      <Text style={styles.subtitle}>
        Record what happened. This data improves action ranking.
      </Text>

      {/* Session context card */}
      <View style={styles.card}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionDate}>{dateStr}</Text>
          <View style={[styles.rewardBadge, {
            backgroundColor: rewardLabel === "Good" ? "#e8f5e9" : rewardLabel === "Okay" ? "#fff3e0" : "#fce4ec",
          }]}>
            <Text style={[styles.rewardText, {
              color: rewardLabel === "Good" ? "#2a9d8f" : rewardLabel === "Okay" ? "#f4a261" : "#e63946",
            }]}>{rewardLabel}</Text>
          </View>
        </View>
        <Text style={styles.actionName}>{action?.title ?? actionId}</Text>
        <Text style={styles.actionDesc}>{action?.description ?? ""}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{ctx.intent}</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>{ctx.stage}</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>{ctx.channel}</Text></View>
          {ctx.urgency === 1 && <View style={[styles.tag, styles.tagWarn]}><Text style={styles.tagText}>urgent</Text></View>}
        </View>
      </View>

      {/* 1. Partner reaction */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What outcome did you observe?</Text>
        <View style={styles.reactionGrid}>
          {REACTIONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setReaction(r.id)}
              style={[styles.reactionCard, reaction === r.id && styles.reactionCardActive]}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactionLabel, reaction === r.id && styles.reactionLabelActive]}>
                {r.label}
              </Text>
              <Text style={[styles.reactionDesc, reaction === r.id && styles.reactionDescActive]}>
                {r.desc}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 2. Emotion before/after */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your energy level</Text>
        <EmotionSlider label="Before the session" value={emotionBefore} onChange={setEmotionBefore} />
        <EmotionSlider label="After the session" value={emotionAfter} onChange={setEmotionAfter} />
        {emotionAfter !== emotionBefore && (
          <Text style={[styles.shiftText, { color: emotionAfter > emotionBefore ? "#2a9d8f" : "#e63946" }]}>
            {emotionAfter > emotionBefore ? "+" : ""}{emotionAfter - emotionBefore} shift
          </Text>
        )}
      </View>

      {/* 3. What worked */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What worked well? (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={whatWorked}
          onChangeText={setWhatWorked}
          placeholder="e.g., Asking Yes/No first lowered the tension..."
          multiline
        />
      </View>

      {/* 4. What to change */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What would you do differently? (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={whatToChange}
          onChangeText={setWhatToChange}
          placeholder="e.g., I should have waited longer before responding..."
          multiline
        />
      </View>

      {/* 5. Would use again */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Would you use this action again in a similar situation?</Text>
        <View style={styles.boolRow}>
          <Pressable
            onPress={() => setWouldUseAgain(true)}
            style={[styles.boolBtn, wouldUseAgain === true && styles.boolBtnActiveYes]}
          >
            <Text style={[styles.boolBtnText, wouldUseAgain === true && styles.boolBtnTextActive]}>
              Yes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWouldUseAgain(false)}
            style={[styles.boolBtn, wouldUseAgain === false && styles.boolBtnActiveNo]}
          >
            <Text style={[styles.boolBtnText, wouldUseAgain === false && styles.boolBtnTextActive]}>
              No
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Submit */}
      <Pressable style={styles.primaryBtn} onPress={submitReview}>
        <Text style={styles.primaryBtnText}>Save review</Text>
      </Pressable>

      <Text style={styles.note}>
        Free-text reflections are stored on-device only and never exported.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700" },

  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionDate: { fontSize: 13, fontWeight: "600", opacity: 0.6 },
  rewardBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  rewardText: { fontSize: 12, fontWeight: "700" },

  actionName: { fontSize: 16, fontWeight: "700" },
  actionDesc: { fontSize: 13, opacity: 0.7, lineHeight: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "#f0f0f0" },
  tagWarn: { backgroundColor: "#fff3e0" },
  tagText: { fontSize: 11, fontWeight: "600", opacity: 0.7 },

  reactionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reactionCard: {
    width: "30%", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 12, padding: 10, alignItems: "center", gap: 4,
  },
  reactionCardActive: { backgroundColor: "black", borderColor: "black" },
  reactionEmoji: { fontSize: 24 },
  reactionLabel: { fontSize: 12, fontWeight: "700" },
  reactionLabelActive: { color: "white" },
  reactionDesc: { fontSize: 10, opacity: 0.6, textAlign: "center", lineHeight: 14 },
  reactionDescActive: { color: "white", opacity: 0.8 },

  shiftText: { fontSize: 14, fontWeight: "700", textAlign: "center" },

  textInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    padding: 12, fontSize: 14, lineHeight: 20, minHeight: 80,
    textAlignVertical: "top",
  },

  boolRow: { flexDirection: "row", gap: 10 },
  boolBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  boolBtnActiveYes: { backgroundColor: "#2a9d8f", borderColor: "#2a9d8f" },
  boolBtnActiveNo: { backgroundColor: "#e63946", borderColor: "#e63946" },
  boolBtnText: { fontWeight: "700", fontSize: 14 },
  boolBtnTextActive: { color: "white" },

  statRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1, alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12,
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, opacity: 0.6 },

  primaryBtn: {
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: "black", alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "700", fontSize: 15 },

  secondaryBtn: {
    paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "600", fontSize: 13 },

  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
