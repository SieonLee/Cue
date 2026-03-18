import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";

type WeekData = {
  sessions: number;
  reviews: number;
  avgReward: number;
  topAction: { id: string; count: number; avgReward: number } | null;
  prevSessions: number;
  prevAvgReward: number;
  activeDays: number;
  observation: string;
};

function getWeekBounds(weeksAgo: number): { start: number; end: number } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7) - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  sunday.setHours(0, 0, 0, 0);
  return { start: monday.getTime(), end: sunday.getTime() };
}

function computeWeekData(): WeekData {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);

  const sessionRow = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE created_at >= ? AND created_at < ?",
    [thisWeek.start, thisWeek.end]
  );
  const sessions = sessionRow?.cnt ?? 0;

  const reviewRow = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM outcome_reviews WHERE created_at >= ? AND created_at < ?",
    [thisWeek.start, thisWeek.end]
  );
  const reviews = reviewRow?.cnt ?? 0;

  const rewardRow = db.getFirstSync<{ avg_r: number | null }>(
    "SELECT AVG(reward) as avg_r FROM feedback WHERE created_at >= ? AND created_at < ?",
    [thisWeek.start, thisWeek.end]
  );
  const avgReward = rewardRow?.avg_r ?? 0;

  type ActionRow = { chosen_action: string; cnt: number; avg_r: number };
  const topActions = db.getAllSync<ActionRow>(
    `SELECT chosen_action, COUNT(*) as cnt, AVG(reward) as avg_r
     FROM feedback WHERE created_at >= ? AND created_at < ?
     GROUP BY chosen_action ORDER BY cnt DESC LIMIT 1`,
    [thisWeek.start, thisWeek.end]
  );
  const topAction = topActions.length > 0
    ? { id: topActions[0].chosen_action, count: topActions[0].cnt, avgReward: topActions[0].avg_r }
    : null;

  const prevSessionRow = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE created_at >= ? AND created_at < ?",
    [lastWeek.start, lastWeek.end]
  );
  const prevSessions = prevSessionRow?.cnt ?? 0;

  const prevRewardRow = db.getFirstSync<{ avg_r: number | null }>(
    "SELECT AVG(reward) as avg_r FROM feedback WHERE created_at >= ? AND created_at < ?",
    [lastWeek.start, lastWeek.end]
  );
  const prevAvgReward = prevRewardRow?.avg_r ?? 0;

  const activeDayRow = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT date(created_at / 1000, 'unixepoch')) as cnt
     FROM feedback WHERE created_at >= ? AND created_at < ?`,
    [thisWeek.start, thisWeek.end]
  );
  const activeDays = activeDayRow?.cnt ?? 0;

  const observation = generateObservation(sessions, avgReward, reviews, activeDays);

  return {
    sessions, reviews, avgReward, topAction,
    prevSessions, prevAvgReward,
    activeDays, observation,
  };
}

function generateObservation(
  sessions: number, avgReward: number, reviews: number, activeDays: number,
): string {
  if (sessions === 0) {
    return "No sessions this week. Use the coach to get action recommendations.";
  }
  if (reviews === 0 && sessions >= 2) {
    return `${sessions} sessions completed, 0 reviews. Reviews provide additional data for better action ranking.`;
  }
  if (avgReward < 0.4) {
    return `Avg outcome ${Math.round(avgReward * 100)}% — below 40%. Consider trying a different action next session.`;
  }
  if (activeDays <= 2 && sessions >= 2) {
    return `${sessions} sessions across ${activeDays} day${activeDays !== 1 ? "s" : ""}. More spread = more varied training data.`;
  }
  if (avgReward >= 0.7) {
    return `Avg outcome ${Math.round(avgReward * 100)}% — current actions are performing well.`;
  }
  return `${sessions} session${sessions !== 1 ? "s" : ""} across ${activeDays} day${activeDays !== 1 ? "s" : ""}. More data improves action ranking.`;
}

function formatDelta(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0 && current === 0) return { text: "—", positive: true };
  if (previous === 0) return { text: `+${current}`, positive: true };
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (diff > 0) return { text: `+${pct}%`, positive: true };
  if (diff < 0) return { text: `${pct}%`, positive: false };
  return { text: "Same", positive: true };
}

function getActionLabel(id: string): string {
  const action = ACTIONS[id as ActionId];
  return action?.title ?? id;
}

export function WeeklyReportScreen() {
  const [data, setData] = useState<WeekData | null>(null);

  useFocusEffect(
    useCallback(() => {
      setData(computeWeekData());
    }, [])
  );

  if (!data) return null;

  const sessionDelta = formatDelta(data.sessions, data.prevSessions);
  const rewardDelta = formatDelta(
    Math.round(data.avgReward * 100),
    Math.round(data.prevAvgReward * 100),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>This week's summary</Text>

      {/* Overview grid */}
      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.sessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
          <Text style={[styles.delta, sessionDelta.positive ? styles.deltaPos : styles.deltaNeg]}>
            {sessionDelta.text} vs last week
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.round(data.avgReward * 100)}%</Text>
          <Text style={styles.statLabel}>Avg outcome</Text>
          <Text style={[styles.delta, rewardDelta.positive ? styles.deltaPos : styles.deltaNeg]}>
            {rewardDelta.text} vs last week
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.reviews}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.activeDays}</Text>
          <Text style={styles.statLabel}>Active days</Text>
        </View>
      </View>

      {/* Top action */}
      {data.topAction && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Most used this week</Text>
          <Text style={styles.topActionName}>
            {getActionLabel(data.topAction.id)}
          </Text>
          <Text style={styles.topActionDetail}>
            Used {data.topAction.count}x — avg outcome {Math.round(data.topAction.avgReward * 100)}%
          </Text>
        </View>
      )}

      {/* Observation */}
      <View style={styles.recCard}>
        <Text style={styles.recLabel}>This week</Text>
        <Text style={styles.recText}>{data.observation}</Text>
      </View>

      {data.sessions === 0 && (
        <Text style={styles.emptyNote}>
          No sessions yet this week. Start one and this summary will update here.
        </Text>
      )}

      <Text style={styles.footer}>
        Report resets each Monday. Data is on-device only.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "700" },

  grid: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1, alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: "#eee", borderRadius: 14, paddingVertical: 16,
  },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "600", opacity: 0.6 },
  delta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  deltaPos: { color: "#2a9d8f" },
  deltaNeg: { color: "#e76f51" },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "700" },

  topActionName: { fontSize: 18, fontWeight: "800" },
  topActionDetail: { fontSize: 13, opacity: 0.6 },

  recCard: {
    borderWidth: 2, borderColor: "#2a9d8f", borderRadius: 14, padding: 16, gap: 6,
    backgroundColor: "#f0faf9",
  },
  recLabel: { fontSize: 11, fontWeight: "800", color: "#2a9d8f", letterSpacing: 1 },
  recText: { fontSize: 14, lineHeight: 22 },

  emptyNote: { fontSize: 13, opacity: 0.5, textAlign: "center", lineHeight: 20, paddingVertical: 10 },
  footer: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
