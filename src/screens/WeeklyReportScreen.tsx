import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type WeekData = {
  sessions: number;
  reviews: number;
  avgReward: number;
  topAction: { id: string; count: number; avgReward: number } | null;
  topChannel: { channel: string; count: number; avgReward: number } | null;
  prevSessions: number;
  prevAvgReward: number;
  activeDays: number;
  observation: string;
  reviewCoverage: number;
  pendingReviews: number;
  nextFocus: string;
  reminderTiming: string | null;
};

function getWeeklyReviewReminder(pendingReviews: number, oldestPendingHours: number | null): string | null {
  if (!pendingReviews || oldestPendingHours == null) return null;
  if (oldestPendingHours <= 6) return "You still have a same-day follow-up waiting. Review it while the reaction is easy to remember.";
  if (oldestPendingHours <= 24) return "Try to close out today's pending review before the end of the day.";
  return "At least one follow-up review is more than a day old. Clearing it will make next week's summary more reliable.";
}

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

  type ChannelRow = { channel: string; cnt: number; avg_r: number };
  const topChannels = db.getAllSync<ChannelRow>(
    `SELECT json_extract(s.context_json, '$.channel') as channel, COUNT(*) as cnt, AVG(f.reward) as avg_r
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     WHERE f.created_at >= ? AND f.created_at < ?
     GROUP BY channel
     HAVING COUNT(*) >= 1
     ORDER BY avg_r DESC, cnt DESC
     LIMIT 1`,
    [thisWeek.start, thisWeek.end]
  );
  const topChannel = topChannels.length > 0
    ? { channel: topChannels[0].channel, count: topChannels[0].cnt, avgReward: topChannels[0].avg_r }
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
  const reviewCoverage = sessions > 0 ? reviews / sessions : 0;
  const pendingReviews = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt
     FROM feedback
     WHERE created_at >= ? AND created_at < ?
       AND session_id NOT IN (SELECT session_id FROM outcome_reviews)`,
    [thisWeek.start, thisWeek.end]
  )?.cnt ?? 0;
  const oldestPendingCreatedAt = db.getFirstSync<{ created_at: number }>(
    `SELECT created_at
     FROM feedback
     WHERE created_at >= ? AND created_at < ?
       AND session_id NOT IN (SELECT session_id FROM outcome_reviews)
     ORDER BY created_at ASC
     LIMIT 1`,
    [thisWeek.start, thisWeek.end]
  )?.created_at;
  const oldestPendingHours = oldestPendingCreatedAt
    ? Math.max(1, Math.round((Date.now() - oldestPendingCreatedAt) / 3_600_000))
    : null;

  const observation = generateObservation(sessions, avgReward, reviews, activeDays);
  const nextFocus = generateNextFocus({
    sessions,
    reviews,
    avgReward,
    topAction,
    topChannel,
    pendingReviews,
  });

  const reminderTiming = getWeeklyReviewReminder(pendingReviews, oldestPendingHours);

  return {
    sessions, reviews, avgReward, topAction,
    topChannel,
    prevSessions, prevAvgReward,
    activeDays, observation, reviewCoverage, pendingReviews, nextFocus, reminderTiming,
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

function generateNextFocus({
  sessions,
  reviews,
  avgReward,
  topAction,
  topChannel,
  pendingReviews,
}: {
  sessions: number;
  reviews: number;
  avgReward: number;
  topAction: WeekData["topAction"];
  topChannel: WeekData["topChannel"];
  pendingReviews: number;
}): string {
  if (pendingReviews > 0) {
    return `Complete ${pendingReviews} follow-up review${pendingReviews === 1 ? "" : "s"} to give the model stronger outcome data.`;
  }
  if (sessions > 0 && reviews === 0) {
    return "Add a follow-up review after your next session so Cue can learn from the full conversation outcome.";
  }
  if (avgReward < 0.5 && topAction) {
    return `Try a different opening than ${getActionLabel(topAction.id)} next week to compare outcomes.`;
  }
  if (topChannel) {
    return `${topChannel.channel} is your strongest channel this week. Use it first when a conversation can wait.`;
  }
  return "Keep logging sessions and reviews so weekly patterns become more stable.";
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
  const { colors } = useTheme();
  const styles = React.useMemo(() => themedStyles(colors), [colors]);
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

      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.round(data.reviewCoverage * 100)}%</Text>
          <Text style={styles.statLabel}>Review coverage</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.pendingReviews}</Text>
          <Text style={styles.statLabel}>Pending reviews</Text>
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

      {data.topChannel && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Strongest channel this week</Text>
          <Text style={styles.topActionName}>{data.topChannel.channel}</Text>
          <Text style={styles.topActionDetail}>
            {data.topChannel.count} session{data.topChannel.count === 1 ? "" : "s"} — avg outcome {Math.round(data.topChannel.avgReward * 100)}%
          </Text>
        </View>
      )}

      {/* Observation */}
      <View style={styles.recCard}>
        <Text style={styles.recLabel}>This week</Text>
        <Text style={styles.recText}>{data.observation}</Text>
      </View>

      {data.reminderTiming && (
        <View style={styles.reminderCard}>
          <Text style={styles.reminderLabel}>Review timing</Text>
          <Text style={styles.reminderText}>{data.reminderTiming}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next focus</Text>
        <Text style={styles.topActionDetail}>{data.nextFocus}</Text>
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

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: spacing.page,
      gap: spacing.gap,
      paddingBottom: spacing.pageBtm,
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
    },
    title: { fontSize: font.xxl, fontWeight: font.bold, color: c.text },

    grid: { flexDirection: "row", gap: spacing.sm },
    statBox: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      paddingVertical: spacing.md + 2,
      backgroundColor: c.gray100,
    },
    statValue: { fontSize: font.xxxl, fontWeight: font.extrabold, color: c.text },
    statLabel: { fontSize: font.sm, fontWeight: font.semibold, color: c.textTertiary },
    delta: { fontSize: font.xs + 1, fontWeight: font.semibold, marginTop: 2 },
    deltaPos: { color: c.teal },
    deltaNeg: { color: c.danger },

    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: spacing.cardPad,
      gap: 6,
      backgroundColor: c.card,
    },
    cardTitle: { fontSize: font.md, fontWeight: font.extrabold, color: c.text },

    topActionName: { fontSize: font.lg + 1, fontWeight: font.extrabold, color: c.text },
    topActionDetail: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 18 },

    recCard: {
      borderWidth: 1.5,
      borderColor: c.tealBorder,
      borderRadius: radii.lg,
      padding: spacing.cardPad,
      gap: 6,
      backgroundColor: c.tealLight,
    },
    recLabel: { fontSize: font.xs + 1, fontWeight: font.extrabold, color: c.teal, letterSpacing: 1 },
    recText: { fontSize: font.md, lineHeight: 22, color: c.text },
    reminderCard: {
      borderWidth: 1,
      borderColor: c.orange,
      borderRadius: radii.lg,
      padding: spacing.cardPad,
      gap: 6,
      backgroundColor: c.orangeLight,
    },
    reminderLabel: { fontSize: font.xs + 1, fontWeight: font.extrabold, color: c.orange, letterSpacing: 1 },
    reminderText: { fontSize: font.sm + 1, lineHeight: 20, color: c.textSecondary },

    emptyNote: { fontSize: font.sm + 1, color: c.textTertiary, textAlign: "center", lineHeight: 20, paddingVertical: 10 },
    footer: { fontSize: font.xs + 1, color: c.textTertiary, lineHeight: 16, textAlign: "center" },
  });
}
