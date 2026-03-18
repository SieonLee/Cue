import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { loadBanditParams } from "../db/sessions";
import type { BetaParams } from "../bandit/thompson";
import { bucketKey } from "../bandit/thompson";
import { ruleCandidates } from "../coach/recommend";
import type { CoachContext } from "../types/models";

type SessionWithOutcome = {
  sessionId: string;
  createdAt: number;
  context: CoachContext;
  chosenAction: ActionId;
  reward: number;
  emotionBefore?: number;
  emotionAfter?: number;
};

type CounterfactualAction = {
  actionId: ActionId;
  title: string;
  estimatedSuccess: number; // 0-1 from Thompson Sampling posterior
  confidence: number; // alpha + beta (higher = more confident)
  advantage: number; // vs chosen action
};

type WhatIfAnalysis = {
  session: SessionWithOutcome;
  chosenEstimate: number;
  alternatives: CounterfactualAction[];
  bestAlternative: CounterfactualAction | null;
  regret: number; // best possible - actual
  insight: string;
};

function loadBadSessions(): SessionWithOutcome[] {
  type Row = {
    session_id: string;
    created_at: number;
    context_json: string;
    chosen_action: string;
    reward: number;
  };

  const rows = db.getAllSync<Row>(
    `SELECT f.session_id, f.created_at, cs.context_json, f.chosen_action, f.reward
     FROM feedback f
     JOIN coach_sessions cs ON cs.id = f.session_id
     WHERE f.reward < 0.8
     ORDER BY f.created_at DESC
     LIMIT 20`
  );

  return rows.map((r) => {
    const ctx = JSON.parse(r.context_json) as CoachContext;
    const review = db.getFirstSync<{ emotion_before: number; emotion_after: number }>(
      "SELECT emotion_before, emotion_after FROM outcome_reviews WHERE session_id = ?",
      [r.session_id]
    );

    return {
      sessionId: r.session_id,
      createdAt: r.created_at,
      context: ctx,
      chosenAction: r.chosen_action as ActionId,
      reward: r.reward,
      emotionBefore: review?.emotion_before,
      emotionAfter: review?.emotion_after,
    };
  });
}

function computeCounterfactual(session: SessionWithOutcome): WhatIfAnalysis {
  const params = loadBanditParams();
  const key = bucketKey(session.context);
  const table: Record<string, BetaParams> = params[key] ?? {};
  const candidates = ruleCandidates(session.context);

  const chosenParams = table[session.chosenAction] ?? { alpha: 1, beta: 1 };
  const chosenEstimate = chosenParams.alpha / (chosenParams.alpha + chosenParams.beta);

  const alternatives: CounterfactualAction[] = candidates
    .filter((id) => id !== session.chosenAction)
    .map((id) => {
      const p = table[id] ?? { alpha: 1, beta: 1 };
      const estimatedSuccess = p.alpha / (p.alpha + p.beta);
      const confidence = p.alpha + p.beta;
      const advantage = estimatedSuccess - chosenEstimate;
      return {
        actionId: id,
        title: ACTIONS[id].title,
        estimatedSuccess,
        confidence,
        advantage,
      };
    })
    .sort((a, b) => b.estimatedSuccess - a.estimatedSuccess);

  const bestAlternative = alternatives.length > 0 ? alternatives[0] : null;
  const regret = bestAlternative
    ? Math.max(0, bestAlternative.estimatedSuccess - session.reward)
    : 0;

  let insight = "";
  if (bestAlternative && bestAlternative.advantage > 0.15) {
    insight = `Next time in this situation, try "${bestAlternative.title}" — the model estimates ${Math.round(bestAlternative.estimatedSuccess * 100)}% success (vs ${Math.round(chosenEstimate * 100)}% for your choice).`;
  } else if (bestAlternative && bestAlternative.advantage > 0) {
    insight = `Your choice was close to optimal. "${bestAlternative.title}" might be slightly better (${Math.round(bestAlternative.estimatedSuccess * 100)}% vs ${Math.round(chosenEstimate * 100)}%).`;
  } else {
    insight = "Based on current data, your action was the best available choice. The outcome may have been influenced by factors outside the model.";
  }

  return { session, chosenEstimate, alternatives, bestAlternative, regret, insight };
}

function rewardLabel(r: number): string {
  if (r >= 0.8) return "Good";
  if (r >= 0.4) return "Okay";
  return "Bad";
}

function rewardColor(r: number): string {
  if (r >= 0.8) return "#2a9d8f";
  if (r >= 0.4) return "#e9c46a";
  return "#e76f51";
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function WhatIfScreen() {
  const [sessions, setSessions] = useState<SessionWithOutcome[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [comparison, setComparison] = useState<WhatIfAnalysis | null>(null);

  useFocusEffect(useCallback(() => {
    const loaded = loadBadSessions();
    setSessions(loaded);
    setSelectedIdx(null);
    setComparison(null);
  }, []));

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    setComparison(computeCounterfactual(sessions[idx]));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        Look back at lower-scoring sessions and compare them with other options
        the model would have considered in the same situation.
      </Text>

      {sessions.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing to compare yet</Text>
          <Text style={styles.emptyDesc}>
            Finish a few sessions and leave feedback first.
            Sessions with lower outcomes will show up here automatically.
          </Text>
        </View>
      )}

      {/* Session List */}
      {sessions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Recent sessions</Text>
          {sessions.slice(0, 10).map((s, i) => (
            <Pressable
              key={s.sessionId}
              style={[styles.sessionRow, selectedIdx === i && styles.sessionRowActive]}
              onPress={() => handleSelect(i)}
            >
              <View style={[styles.rewardDot, { backgroundColor: rewardColor(s.reward) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionAction}>{ACTIONS[s.chosenAction]?.title ?? s.chosenAction}</Text>
                <Text style={styles.sessionMeta}>
                  {s.context.intent} / {s.context.stage} / {s.context.channel} — {formatDate(s.createdAt)}
                </Text>
              </View>
              <Text style={[styles.sessionReward, { color: rewardColor(s.reward) }]}>
                {rewardLabel(s.reward)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Counterfactual Analysis */}
      {comparison && (
        <View style={styles.analysisSection}>
          {/* What you chose */}
          <View style={styles.chosenCard}>
            <Text style={styles.sectionLabel}>Chosen action</Text>
            <View style={styles.chosenRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chosenAction}>{ACTIONS[comparison.session.chosenAction]?.title}</Text>
                <Text style={styles.chosenDesc}>{ACTIONS[comparison.session.chosenAction]?.description}</Text>
              </View>
              <View style={styles.chosenStats}>
                <Text style={[styles.chosenReward, { color: rewardColor(comparison.session.reward) }]}>
                  {rewardLabel(comparison.session.reward)}
                </Text>
                <Text style={styles.chosenEstimate}>
                  Model estimate {Math.round(comparison.chosenEstimate * 100)}%
                </Text>
              </View>
            </View>
            {comparison.session.emotionBefore !== undefined && (
              <Text style={styles.emotionShift}>
                Emotion: {comparison.session.emotionBefore} {">"} {comparison.session.emotionAfter}
                {(comparison.session.emotionAfter ?? 0) > (comparison.session.emotionBefore ?? 0) ? " (improved)" : " (worsened)"}
              </Text>
            )}
          </View>

          {/* Alternatives */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Other options</Text>
            {comparison.alternatives.map((alt) => (
              <View key={alt.actionId} style={styles.altRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.altTitle}>{alt.title}</Text>
                  <View style={styles.altBarTrack}>
                    <View style={[styles.altBarFill, {
                      width: `${Math.round(alt.estimatedSuccess * 100)}%`,
                      backgroundColor: alt.advantage > 0.1 ? "#2a9d8f" : alt.advantage > 0 ? "#e9c46a" : "#ccc",
                    }]} />
                  </View>
                </View>
                <View style={styles.altStats}>
                  <Text style={styles.altPct}>{Math.round(alt.estimatedSuccess * 100)}%</Text>
                  <Text style={[styles.altAdv, {
                    color: alt.advantage > 0 ? "#2a9d8f" : alt.advantage < 0 ? "#e76f51" : "#888",
                  }]}>
                    {alt.advantage > 0 ? "+" : ""}{Math.round(alt.advantage * 100)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Regret Score */}
          <View style={styles.regretCard}>
            <Text style={styles.sectionLabel}>Estimated gap</Text>
            <View style={styles.regretRow}>
              <Text style={[styles.regretValue, {
                color: comparison.regret > 0.3 ? "#e76f51" : comparison.regret > 0.1 ? "#e9c46a" : "#2a9d8f",
              }]}>
                {Math.round(comparison.regret * 100)}%
              </Text>
              <Text style={styles.regretDesc}>
                {comparison.regret > 0.3
                  ? "High regret — a different action likely would have helped more."
                  : comparison.regret > 0.1
                  ? "Moderate regret — there was a slightly better option."
                  : "Low regret — your choice was close to optimal."}
              </Text>
            </View>
          </View>

          {/* Insight */}
          <View style={styles.insightCard}>
            <Text style={styles.sectionLabel}>Takeaway</Text>
            <Text style={styles.insightText}>{comparison.insight}</Text>
          </View>
        </View>
      )}

      <View style={styles.methodBox}>
        <Text style={styles.methodLabel}>Method</Text>
        <Text style={styles.methodText}>
          These comparisons use the current Thompson Sampling estimates for the
          same context. They are directional, not guarantees.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },
  subtitle: { fontSize: 13, opacity: 0.6, lineHeight: 18 },

  emptyCard: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 20, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyDesc: { fontSize: 13, opacity: 0.6, textAlign: "center", lineHeight: 18 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, gap: 8, backgroundColor: "#fafafa" },
  sectionLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },

  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  sessionRowActive: { backgroundColor: "#f0f4ff", borderRadius: 8, paddingHorizontal: 8 },
  rewardDot: { width: 10, height: 10, borderRadius: 5 },
  sessionAction: { fontSize: 14, fontWeight: "700" },
  sessionMeta: { fontSize: 11, opacity: 0.5 },
  sessionReward: { fontSize: 12, fontWeight: "800" },

  analysisSection: { gap: 12 },

  chosenCard: { borderWidth: 2, borderColor: "#264653", borderRadius: 12, padding: 14, gap: 8, backgroundColor: "#f0f4f5" },
  chosenRow: { flexDirection: "row", gap: 12 },
  chosenAction: { fontSize: 16, fontWeight: "800" },
  chosenDesc: { fontSize: 12, opacity: 0.6, lineHeight: 16 },
  chosenStats: { alignItems: "flex-end", gap: 2 },
  chosenReward: { fontSize: 14, fontWeight: "800" },
  chosenEstimate: { fontSize: 11, opacity: 0.6 },
  emotionShift: { fontSize: 12, opacity: 0.6, fontStyle: "italic" },

  altRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  altTitle: { fontSize: 13, fontWeight: "700" },
  altBarTrack: { height: 6, borderRadius: 3, backgroundColor: "#eee", marginTop: 2 },
  altBarFill: { height: 6, borderRadius: 3 },
  altStats: { alignItems: "flex-end", width: 50 },
  altPct: { fontSize: 14, fontWeight: "800" },
  altAdv: { fontSize: 10, fontWeight: "700" },

  regretCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 8, backgroundColor: "#fafafa" },
  regretRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  regretValue: { fontSize: 32, fontWeight: "900" },
  regretDesc: { flex: 1, fontSize: 12, lineHeight: 18, opacity: 0.7 },

  insightCard: { borderWidth: 2, borderColor: "#2a9d8f", borderRadius: 12, padding: 14, gap: 6, backgroundColor: "#f0faf9" },
  insightText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },

  methodBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, gap: 4, backgroundColor: "#f8f8f8" },
  methodLabel: { fontSize: 11, fontWeight: "700", opacity: 0.6 },
  methodText: { fontSize: 11, lineHeight: 16, opacity: 0.6 },
});
