/**
 * AlignmentScreen — Action Effectiveness Dashboard
 *
 * Shows which actions work best based on session data.
 * NO psychological profiles. NO compatibility scores.
 * NO relationship diagnosis. ONLY action success data.
 */

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";

type ActionStat = {
  actionId: ActionId;
  title: string;
  uses: number;
  avgReward: number;
  wouldUseAgain: number; // -1 = no data
};

type ContextStat = {
  intent: string;
  channel: string;
  count: number;
  avgReward: number;
  topAction: string;
};

type DashboardData = {
  actionStats: ActionStat[];
  contextStats: ContextStat[];
  totalSessions: number;
  totalReviews: number;
};

function loadDashboard(): DashboardData {
  // Action effectiveness
  type ActionRow = { chosen_action: string; avg_r: number; cnt: number; wua: number };
  const actionRows = db.getAllSync<ActionRow>(
    `SELECT f.chosen_action, AVG(f.reward) as avg_r, COUNT(*) as cnt,
       COALESCE((SELECT AVG(CAST(r.would_use_again AS REAL)) * 100
         FROM outcome_reviews r WHERE r.chosen_action = f.chosen_action), -1) as wua
     FROM feedback f GROUP BY f.chosen_action ORDER BY avg_r DESC`
  );

  const actionStats: ActionStat[] = actionRows.map((r) => ({
    actionId: r.chosen_action as ActionId,
    title: ACTIONS[r.chosen_action as ActionId]?.title ?? r.chosen_action,
    uses: r.cnt,
    avgReward: r.avg_r,
    wouldUseAgain: r.wua,
  }));

  // Context breakdown
  type CtxRow = { intent: string; channel: string; cnt: number; avg_r: number; top_action: string };
  const ctxRows = db.getAllSync<CtxRow>(
    `SELECT
       json_extract(s.context_json, '$.intent') as intent,
       json_extract(s.context_json, '$.channel') as channel,
       COUNT(*) as cnt,
       AVG(f.reward) as avg_r,
       (SELECT f2.chosen_action FROM feedback f2
        JOIN coach_sessions s2 ON s2.id = f2.session_id
        WHERE json_extract(s2.context_json, '$.intent') = json_extract(s.context_json, '$.intent')
        GROUP BY f2.chosen_action ORDER BY AVG(f2.reward) DESC LIMIT 1) as top_action
     FROM feedback f
     JOIN coach_sessions s ON s.id = f.session_id
     GROUP BY intent, channel
     ORDER BY cnt DESC LIMIT 10`
  );

  const contextStats: ContextStat[] = ctxRows.map((r) => ({
    intent: r.intent, channel: r.channel, count: r.cnt, avgReward: r.avg_r,
    topAction: ACTIONS[r.top_action as ActionId]?.title ?? r.top_action ?? "—",
  }));

  const sessRow = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM feedback");
  const revRow = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM outcome_reviews");

  return {
    actionStats, contextStats,
    totalSessions: sessRow?.cnt ?? 0,
    totalReviews: revRow?.cnt ?? 0,
  };
}

function rewardColor(r: number): string {
  if (r >= 0.7) return "#2a9d8f";
  if (r >= 0.4) return "#e9c46a";
  return "#e76f51";
}

export function AlignmentScreen() {
  const [data, setData] = useState<DashboardData | null>(null);

  useFocusEffect(useCallback(() => { setData(loadDashboard()); }, []));

  if (!data) return null;

  if (data.totalSessions === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptyDesc}>
          Complete coaching sessions and provide feedback to see action effectiveness data here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.totalSessions}</Text>
          <Text style={styles.statLabel}>sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.totalReviews}</Text>
          <Text style={styles.statLabel}>reviews</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.actionStats.length}</Text>
          <Text style={styles.statLabel}>actions tried</Text>
        </View>
      </View>

      {/* Action Effectiveness */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ACTION EFFECTIVENESS (by avg outcome)</Text>
        {data.actionStats.map((a, idx) => (
          <View key={a.actionId} style={styles.actionRow}>
            <Text style={styles.actionRank}>#{idx + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{a.title}</Text>
              <Text style={styles.actionMeta}>
                {a.uses} use{a.uses > 1 ? "s" : ""}
                {a.wouldUseAgain >= 0 ? ` · ${Math.round(a.wouldUseAgain)}% reuse` : ""}
              </Text>
            </View>
            <View style={styles.actionBarWrap}>
              <View style={[styles.actionBar, {
                width: `${Math.round(a.avgReward * 100)}%`,
                backgroundColor: rewardColor(a.avgReward),
              }]} />
            </View>
            <Text style={[styles.actionPct, { color: rewardColor(a.avgReward) }]}>
              {Math.round(a.avgReward * 100)}%
            </Text>
          </View>
        ))}
      </View>

      {/* Context Breakdown */}
      {data.contextStats.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BY CONTEXT (intent + channel)</Text>
          {data.contextStats.map((c, i) => (
            <View key={i} style={styles.ctxRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctxTitle}>{c.intent} / {c.channel}</Text>
                <Text style={styles.ctxMeta}>{c.count} sessions · best action: {c.topAction}</Text>
              </View>
              <Text style={[styles.ctxPct, { color: rewardColor(c.avgReward) }]}>
                {Math.round(c.avgReward * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyDesc: { fontSize: 13, opacity: 0.6, textAlign: "center", lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, opacity: 0.5, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, gap: 8, backgroundColor: "#fafafa" },
  sectionLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  actionRank: { fontSize: 13, fontWeight: "900", color: "#2a9d8f", width: 26 },
  actionTitle: { fontSize: 13, fontWeight: "700" },
  actionMeta: { fontSize: 10, opacity: 0.5 },
  actionBarWrap: { width: 60, height: 8, borderRadius: 4, backgroundColor: "#eee" },
  actionBar: { height: 8, borderRadius: 4 },
  actionPct: { width: 36, fontSize: 13, fontWeight: "800", textAlign: "right" },
  ctxRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  ctxTitle: { fontSize: 13, fontWeight: "700" },
  ctxMeta: { fontSize: 10, opacity: 0.5 },
  ctxPct: { fontSize: 14, fontWeight: "800" },
});
