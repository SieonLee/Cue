import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getSetting } from "../db/sessions";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { credibleInterval } from "../bandit/thompson";

type WeekSnapshot = {
  weekKey: string;
  actions: Record<string, { alpha: number; beta: number }>;
};

type ActionTimeline = {
  actionId: ActionId;
  title: string;
  points: { week: string; mean: number; ciWidth: number; pulls: number }[];
  currentMean: number;
  trend: "improving" | "declining" | "stable";
};

function loadHistory(): { snapshots: WeekSnapshot[]; timelines: ActionTimeline[] } {
  const raw = getSetting("model_history") ?? "{}";
  const history = JSON.parse(raw) as Record<string, Record<string, { alpha: number; beta: number }>>;

  const snapshots: WeekSnapshot[] = Object.entries(history)
    .map(([weekKey, actions]) => ({ weekKey, actions }))
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  const allActionIds = Object.keys(ACTIONS) as ActionId[];
  const timelines: ActionTimeline[] = allActionIds.map((id) => {
    const points = snapshots.map((snap) => {
      const p = snap.actions[id] ?? { alpha: 1, beta: 1 };
      const mean = p.alpha / (p.alpha + p.beta);
      const ci = credibleInterval(p.alpha, p.beta);
      const ciWidth = ci[1] - ci[0];
      const pulls = Math.max(0, Math.round(p.alpha + p.beta - 2));
      return { week: snap.weekKey, mean, ciWidth, pulls };
    }).filter((pt) => pt.pulls > 0);

    const currentMean = points.length > 0 ? points[points.length - 1].mean : 0.5;

    let trend: "improving" | "declining" | "stable" = "stable";
    if (points.length >= 4) {
      const mid = Math.floor(points.length / 2);
      const firstHalf = points.slice(0, mid).reduce((s, p) => s + p.mean, 0) / mid;
      const secondHalf = points.slice(mid).reduce((s, p) => s + p.mean, 0) / (points.length - mid);
      if (secondHalf - firstHalf > 0.05) trend = "improving";
      else if (firstHalf - secondHalf > 0.05) trend = "declining";
    }

    return { actionId: id, title: ACTIONS[id].title, points, currentMean, trend };
  }).filter((t) => t.points.length > 0)
    .sort((a, b) => b.currentMean - a.currentMean);

  return { snapshots, timelines };
}

function MiniChart({ points, color }: { points: { mean: number }[]; color: string }) {
  if (points.length < 2) return null;
  const maxH = 32;
  return (
    <View style={mc.container}>
      {points.map((p, i) => (
        <View key={i} style={mc.col}>
          <View style={[mc.bar, {
            height: Math.max(2, p.mean * maxH),
            backgroundColor: color,
          }]} />
        </View>
      ))}
    </View>
  );
}

const mc = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 36 },
  col: { flex: 1, alignItems: "center" },
  bar: { width: "80%", borderRadius: 2, minWidth: 3 },
});

function trendIcon(trend: "improving" | "declining" | "stable"): string {
  return trend === "improving" ? "\u2197" : trend === "declining" ? "\u2198" : "\u2192";
}

function trendColor(trend: "improving" | "declining" | "stable"): string {
  return trend === "improving" ? "#2a9d8f" : trend === "declining" ? "#e63946" : "#999";
}

export function ModelHistoryScreen() {
  const [data, setData] = useState<ReturnType<typeof loadHistory> | null>(null);

  useFocusEffect(useCallback(() => { setData(loadHistory()); }, []));

  if (!data) return null;

  if (data.snapshots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No model history yet</Text>
        <Text style={styles.emptySubtext}>
          Weekly snapshots are saved automatically as you use the app.
          Come back after a few sessions to see how the model evolves.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Model evolution</Text>
      <Text style={styles.subtitle}>
        {data.snapshots.length} weekly snapshot{data.snapshots.length !== 1 ? "s" : ""} recorded.
        Shows how action effectiveness estimates change over time.
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{data.timelines.length}</Text>
          <Text style={styles.summaryLabel}>actions</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{data.snapshots.length}</Text>
          <Text style={styles.summaryLabel}>weeks saved</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryValue, { color: "#2a9d8f" }]}>
            {data.timelines.filter((t) => t.trend === "improving").length}
          </Text>
          <Text style={styles.summaryLabel}>trending up</Text>
        </View>
      </View>

      {data.timelines.map((t) => (
        <View key={t.actionId} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t.title}</Text>
              <Text style={styles.actionMeta}>
                Current avg outcome: {Math.round(t.currentMean * 100)}%
              </Text>
            </View>
            <Text style={[styles.trendBadge, { color: trendColor(t.trend) }]}>
              {trendIcon(t.trend)} {t.trend}
            </Text>
          </View>

          <MiniChart
            points={t.points}
            color={trendColor(t.trend)}
          />

          {t.points.length >= 2 && (
            <View style={styles.convergenceRow}>
              <Text style={styles.convergenceLabel}>CI width:</Text>
              <Text style={styles.convergenceValue}>
                {Math.round(t.points[0].ciWidth * 100)}% → {Math.round(t.points[t.points.length - 1].ciWidth * 100)}%
              </Text>
              <Text style={styles.convergenceNote}>
                ({t.points[t.points.length - 1].ciWidth < t.points[0].ciWidth ? "converging" : "widening"})
              </Text>
            </View>
          )}

          <Text style={styles.dataPoints}>
            {t.points.reduce((s, p) => s + p.pulls, 0)} total observations across {t.points.length} weeks
          </Text>
        </View>
      ))}

      <View style={styles.methodBox}>
        <Text style={styles.methodLabel}>Method</Text>
        <Text style={styles.methodText}>
          Each week stores the running Beta parameters for every action.
          The chart shows how the average estimate and uncertainty change over time.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptySubtext: { fontSize: 13, opacity: 0.6, textAlign: "center", lineHeight: 20 },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: { flex: 1, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 10, opacity: 0.5, fontWeight: "600" },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  actionTitle: { fontSize: 14, fontWeight: "700" },
  actionMeta: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  trendBadge: { fontSize: 12, fontWeight: "700" },

  convergenceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  convergenceLabel: { fontSize: 11, opacity: 0.5 },
  convergenceValue: { fontSize: 11, fontWeight: "700", fontFamily: "monospace" },
  convergenceNote: { fontSize: 10, opacity: 0.5 },

  dataPoints: { fontSize: 10, opacity: 0.4 },

  methodBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, gap: 4, backgroundColor: "#f8f8f8" },
  methodLabel: { fontSize: 11, fontWeight: "700", opacity: 0.6 },
  methodText: { fontSize: 11, lineHeight: 16, opacity: 0.6 },
});
