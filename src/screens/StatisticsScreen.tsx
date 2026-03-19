import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { getAlgorithmStats } from "../db/signals";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type ActionStat = {
  action: ActionId;
  title: string;
  count: number;
  avgReward: number;
};

type InsightCard = {
  title: string;
  body: string;
  tone: "positive" | "neutral";
};

type PolicyStat = {
  count: number;
  avgReward: number;
};

type DashData = {
  totalSessions: number;
  totalFeedback: number;
  avgReward: number;
  last7Sessions: number;
  last7AvgReward: number;
  actionStats: ActionStat[];
  rewardDistribution: { good: number; okay: number; bad: number };
  insights: InsightCard[];
  policyStats: { thompson: PolicyStat; linucb: PolicyStat };
  topChoiceRate: number;
  recentRewardDelta: number | null;
  bestContextAction: string | null;
};

function loadStats(): DashData {
  const totalSessions = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM coach_sessions"
  )?.cnt ?? 0;

  const totalFeedback = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback"
  )?.cnt ?? 0;

  const avgRow = db.getFirstSync<{ avg_r: number }>(
    "SELECT AVG(reward) as avg_r FROM feedback"
  );
  const avgReward = avgRow?.avg_r ?? 0;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const last7Sessions = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM coach_sessions WHERE created_at > ?",
    [sevenDaysAgo]
  )?.cnt ?? 0;

  const last7Avg = db.getFirstSync<{ avg_r: number }>(
    "SELECT AVG(reward) as avg_r FROM feedback WHERE created_at > ?",
    [sevenDaysAgo]
  );
  const last7AvgReward = last7Avg?.avg_r ?? 0;

  type AR = { chosen_action: string; cnt: number; avg_r: number };
  const actionRows = db.getAllSync<AR>(
    "SELECT chosen_action, COUNT(*) as cnt, AVG(reward) as avg_r FROM feedback GROUP BY chosen_action ORDER BY avg_r DESC"
  );
  const actionStats: ActionStat[] = actionRows.map((r) => ({
    action: r.chosen_action as ActionId,
    title: ACTIONS[r.chosen_action as ActionId]?.title ?? r.chosen_action,
    count: r.cnt,
    avgReward: r.avg_r,
  }));

  const good = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE reward >= 0.75"
  )?.cnt ?? 0;
  const okay = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE reward >= 0.25 AND reward < 0.75"
  )?.cnt ?? 0;
  const bad = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE reward < 0.25"
  )?.cnt ?? 0;

  const insights: InsightCard[] = [];
  const policyStats = getAlgorithmStats();
  const topChoiceCount = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     WHERE json_extract(s.ranked_json, '$[0]') = f.chosen_action`
  )?.cnt ?? 0;
  const topChoiceRate = totalFeedback > 0 ? topChoiceCount / totalFeedback : 0;
  const recentRewardDelta =
    totalFeedback > 0 && last7Sessions > 0 ? last7AvgReward - avgReward : null;

  const bestAction = actionStats.find((action) => action.count >= 2);
  if (bestAction) {
    insights.push({
      title: "Best action lately",
      body: `${bestAction.title} is your strongest action so far at ${Math.round(bestAction.avgReward * 100)}% average reward across ${bestAction.count} uses.`,
      tone: "positive",
    });
  }

  type ChannelRow = { channel: string; cnt: number; avg_r: number };
  const bestChannel = db.getFirstSync<ChannelRow>(
    `SELECT json_extract(s.context_json, '$.channel') as channel, COUNT(*) as cnt, AVG(f.reward) as avg_r
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     GROUP BY channel
     HAVING COUNT(*) >= 2
     ORDER BY avg_r DESC
     LIMIT 1`
  );
  if (bestChannel?.channel) {
    insights.push({
      title: "Channel pattern",
      body: `${bestChannel.channel} conversations are averaging ${Math.round(bestChannel.avg_r * 100)}% reward across ${bestChannel.cnt} sessions.`,
      tone: "neutral",
    });
  }

  type ContextRow = { intent: string; cnt: number; avg_r: number };
  const bestContext = db.getFirstSync<ContextRow>(
    `SELECT json_extract(s.context_json, '$.intent') as intent, COUNT(*) as cnt, AVG(f.reward) as avg_r
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     GROUP BY intent
     HAVING COUNT(*) >= 2
     ORDER BY avg_r DESC
     LIMIT 1`
  );
  if (bestContext?.intent) {
    insights.push({
      title: "Context trend",
      body: `${bestContext.intent.replace("_", " ")} situations are going best right now at ${Math.round(bestContext.avg_r * 100)}% average reward.`,
      tone: "positive",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "More data will sharpen this",
      body: "Finish a few more sessions and leave feedback to unlock action, channel, and context insights.",
      tone: "neutral",
    });
  }

  type BestContextActionRow = { intent: string; chosen_action: string; cnt: number; avg_r: number };
  const bestContextActionRow = db.getFirstSync<BestContextActionRow>(
    `SELECT json_extract(s.context_json, '$.intent') as intent, f.chosen_action, COUNT(*) as cnt, AVG(f.reward) as avg_r
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     GROUP BY intent, f.chosen_action
     HAVING COUNT(*) >= 2
     ORDER BY avg_r DESC, cnt DESC
     LIMIT 1`
  );
  const bestContextAction = bestContextActionRow
    ? `${bestContextActionRow.intent.replace("_", " ")} works best with ${ACTIONS[bestContextActionRow.chosen_action as ActionId]?.title ?? bestContextActionRow.chosen_action}.`
    : null;

  return {
    totalSessions,
    totalFeedback,
    avgReward,
    last7Sessions,
    last7AvgReward,
    actionStats,
    rewardDistribution: { good, okay, bad },
    insights,
    policyStats,
    topChoiceRate,
    recentRewardDelta,
    bestContextAction,
  };
}

export function StatisticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);
  const [data, setData] = useState<DashData>({
    totalSessions: 0,
    totalFeedback: 0,
    avgReward: 0,
    last7Sessions: 0,
    last7AvgReward: 0,
    actionStats: [],
    rewardDistribution: { good: 0, okay: 0, bad: 0 },
    insights: [],
    policyStats: {
      thompson: { count: 0, avgReward: 0 },
      linucb: { count: 0, avgReward: 0 },
    },
    topChoiceRate: 0,
    recentRewardDelta: null,
    bestContextAction: null,
  });

  useFocusEffect(
    useCallback(() => {
      setData(loadStats());
    }, [])
  );

  const totalFb = data.rewardDistribution.good + data.rewardDistribution.okay + data.rewardDistribution.bad;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>A quick look at sessions, feedback, and which actions have worked best so far.</Text>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{data.totalSessions}</Text>
          <Text style={styles.statLbl}>sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{data.totalFeedback}</Text>
          <Text style={styles.statLbl}>feedback</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{data.avgReward > 0 ? `${Math.round(data.avgReward * 100)}%` : "-"}</Text>
          <Text style={styles.statLbl}>avg reward</Text>
        </View>
      </View>

      {/* 7-day vs All-time */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Recent activity</Text>
        <View style={styles.trendRow}>
          <View style={styles.trendItem}>
            <Text style={styles.trendValue}>{data.last7Sessions}</Text>
            <Text style={styles.trendSubtext}>sessions (7d)</Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendValue}>{data.last7AvgReward > 0 ? `${Math.round(data.last7AvgReward * 100)}%` : "-"}</Text>
            <Text style={styles.trendSubtext}>avg reward (7d)</Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendValue}>{data.avgReward > 0 ? `${Math.round(data.avgReward * 100)}%` : "-"}</Text>
            <Text style={styles.trendSubtext}>avg reward (all)</Text>
          </View>
        </View>
      </View>

      {data.totalFeedback > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Evaluation snapshot</Text>
          <View style={styles.policyRow}>
            <View style={styles.policyCard}>
              <Text style={styles.policyName}>Thompson</Text>
              <Text style={styles.policyValue}>
                {data.policyStats.thompson.count > 0
                  ? `${Math.round(data.policyStats.thompson.avgReward * 100)}%`
                  : "-"}
              </Text>
              <Text style={styles.policyMeta}>
                {data.policyStats.thompson.count} rated sessions
              </Text>
            </View>
            <View style={styles.policyCard}>
              <Text style={styles.policyName}>LinUCB</Text>
              <Text style={styles.policyValue}>
                {data.policyStats.linucb.count > 0
                  ? `${Math.round(data.policyStats.linucb.avgReward * 100)}%`
                  : "-"}
              </Text>
              <Text style={styles.policyMeta}>
                {data.policyStats.linucb.count} rated sessions
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Top-ranked action chosen</Text>
            <Text style={styles.metricValue}>{Math.round(data.topChoiceRate * 100)}%</Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Recent reward trend</Text>
            <Text
              style={[
                styles.metricValue,
                data.recentRewardDelta != null && data.recentRewardDelta >= 0
                  ? styles.metricValuePositive
                  : data.recentRewardDelta != null
                    ? styles.metricValueNegative
                    : null,
              ]}
            >
              {data.recentRewardDelta == null
                ? "Need more recent data"
                : `${data.recentRewardDelta >= 0 ? "+" : ""}${Math.round(data.recentRewardDelta * 100)} pts vs all-time`}
            </Text>
          </View>

          {data.bestContextAction && (
            <View style={styles.evalNote}>
              <Text style={styles.evalNoteTitle}>Best-performing pattern</Text>
              <Text style={styles.evalNoteBody}>{data.bestContextAction}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>What to try next</Text>
        {data.insights.map((insight, idx) => (
          <View
            key={`${insight.title}-${idx}`}
            style={[
              styles.insightRow,
              insight.tone === "positive" ? styles.insightRowPositive : styles.insightRowNeutral,
            ]}
          >
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
          </View>
        ))}
      </View>

      {/* Reward distribution */}
      {totalFb > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Feedback mix</Text>
          {([
            { label: "Good", count: data.rewardDistribution.good, color: colors.teal },
            { label: "Okay", count: data.rewardDistribution.okay, color: colors.orange },
            { label: "Bad", count: data.rewardDistribution.bad, color: colors.danger },
          ]).map((item) => (
            <View key={item.label} style={styles.barRow}>
              <Text style={styles.barLabel}>{item.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round((item.count / totalFb) * 100)}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={styles.barCount}>{item.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action performance */}
      {data.actionStats.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Action results</Text>
          {data.actionStats.slice(0, 10).map((a) => (
            <View key={a.action} style={styles.actionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionSub}>{a.count} uses</Text>
              </View>
              <View style={styles.actionBarWrap}>
                <View style={[styles.actionBar, { width: `${Math.round(a.avgReward * 100)}%`, backgroundColor: a.avgReward >= 0.7 ? colors.teal : a.avgReward >= 0.4 ? colors.orange : colors.danger }]} />
              </View>
              <Text style={styles.actionPct}>{Math.round(a.avgReward * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      {data.totalFeedback === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No stats yet</Text>
          <Text style={styles.emptySubtext}>Finish a session and leave feedback to start filling this in.</Text>
        </View>
      )}
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
    subtitle: { fontSize: font.md, color: c.textSecondary, lineHeight: 18 },

    statsRow: { flexDirection: "row", gap: 6 },
    statBox: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radii.lg, backgroundColor: c.gray100 },
    statVal: { fontSize: font.xl, fontWeight: font.extrabold, color: c.text },
    statLbl: { fontSize: font.xs, color: c.textTertiary, fontWeight: font.bold, textTransform: "uppercase" },

    card: { borderWidth: 1, borderColor: c.border, borderRadius: radii.xl, padding: spacing.cardPad, gap: 10 },
    cardLabel: { fontSize: font.xs + 1, fontWeight: font.extrabold, color: c.textTertiary, letterSpacing: 1, textTransform: "uppercase" },

    trendRow: { flexDirection: "row", justifyContent: "space-between" },
    trendItem: { alignItems: "center", flex: 1 },
    trendValue: { fontSize: font.xl, fontWeight: font.extrabold, color: c.text },
    trendSubtext: { fontSize: font.xs, color: c.textTertiary, fontWeight: font.semibold },
    policyRow: { flexDirection: "row", gap: spacing.sm },
    policyCard: { flex: 1, borderRadius: radii.lg, backgroundColor: c.gray100, padding: spacing.md, gap: 4 },
    policyName: { fontSize: font.sm, fontWeight: font.extrabold, color: c.text },
    policyValue: { fontSize: font.xl, fontWeight: font.extrabold, color: c.text },
    policyMeta: { fontSize: font.xs, color: c.textTertiary },
    metricRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm,
    },
    metricLabel: { fontSize: font.sm, color: c.textSecondary, fontWeight: font.semibold },
    metricValue: { fontSize: font.sm, color: c.text, fontWeight: font.extrabold, textAlign: "right" },
    metricValuePositive: { color: c.teal },
    metricValueNegative: { color: c.danger },
    evalNote: { borderRadius: radii.lg, backgroundColor: c.tealLight, padding: spacing.md, gap: 4 },
    evalNoteTitle: { fontSize: font.sm, fontWeight: font.extrabold, color: c.text },
    evalNoteBody: { fontSize: font.md, lineHeight: 18, color: c.textSecondary },
    insightRow: { borderRadius: radii.lg, padding: spacing.md, gap: 4 },
    insightRowPositive: { backgroundColor: c.tealLight },
    insightRowNeutral: { backgroundColor: c.gray100 },
    insightTitle: { fontSize: font.sm, fontWeight: font.extrabold, color: c.text },
    insightBody: { fontSize: font.md, lineHeight: 18, color: c.textSecondary },

    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    barLabel: { width: 40, fontSize: font.sm, fontWeight: font.semibold, color: c.textSecondary },
    barTrack: { flex: 1, height: 8, backgroundColor: c.gray100, borderRadius: radii.pill },
    barFill: { height: 8, borderRadius: radii.pill },
    barCount: { width: 30, fontSize: font.sm, fontWeight: font.bold, color: c.text, textAlign: "right" },

    actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
    actionTitle: { fontSize: font.md, fontWeight: font.semibold, color: c.text },
    actionSub: { fontSize: font.xs, color: c.textTertiary },
    actionBarWrap: { width: 60, height: 6, backgroundColor: c.gray100, borderRadius: radii.pill },
    actionBar: { height: 6, borderRadius: radii.pill },
    actionPct: { width: 36, fontSize: font.sm, fontWeight: font.bold, color: c.text, textAlign: "right" },

    emptyCard: { borderWidth: 1, borderColor: c.border, borderRadius: radii.xl, padding: 24, alignItems: "center", gap: 6 },
    emptyText: { fontSize: font.lg, fontWeight: font.bold, color: c.text },
    emptySubtext: { fontSize: font.md, color: c.textTertiary, textAlign: "center", lineHeight: 20 },
  });
}
