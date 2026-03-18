import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { loadBanditParams } from "../db/sessions";
import { db } from "../db/db";
import { getAlgorithmStats } from "../db/signals";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { credibleInterval, computePBest } from "../bandit/thompson";
import type { BetaParams } from "../bandit/thompson";

// ── Calendar helpers ───────────────────────────────────────────────────────────
type DayData = { dateStr: string; avgReward: number; count: number };

function getCalendarData(): DayData[] {
  type Row = { created_at: number; reward: number };
  const rows = db.getAllSync<Row>(
    "SELECT created_at, reward FROM feedback ORDER BY created_at ASC"
  );

  const byDay: Record<string, { sum: number; count: number }> = {};
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDay[key]) byDay[key] = { sum: 0, count: 0 };
    byDay[key].sum += r.reward;
    byDay[key].count += 1;
  }

  return Object.entries(byDay)
    .map(([dateStr, { sum, count }]) => ({ dateStr, avgReward: sum / count, count }))
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
    .slice(-30); // last 30 days with data
}

function rewardColor(avg: number): string {
  if (avg >= 0.75) return "#2a9d8f";
  if (avg >= 0.4)  return "#f4a261";
  return "#e63946";
}

type ActionStat = {
  actionId: ActionId;
  alpha: number;
  beta: number;
  mean: number;        // alpha / (alpha + beta)
  pulls: number;       // alpha + beta - 2 (subtract priors)
  ci: [number, number]; // 90% credible interval
  pBest: number;       // P(this action is best)
};

function parseStats(params: Record<string, Record<ActionId, BetaParams>>): ActionStat[] {
  // Aggregate across all buckets
  const totals: Record<string, { alpha: number; beta: number }> = {};

  for (const bucket of Object.values(params)) {
    for (const [actionId, bp] of Object.entries(bucket)) {
      if (!totals[actionId]) totals[actionId] = { alpha: 0, beta: 0 };
      totals[actionId].alpha += bp.alpha;
      totals[actionId].beta += bp.beta;
    }
  }

  const actionStats = (Object.keys(ACTIONS) as ActionId[]).map((id) => {
    const t = totals[id] ?? { alpha: 1, beta: 1 };
    const mean = t.alpha / (t.alpha + t.beta);
    const pulls = Math.max(0, Math.round(t.alpha + t.beta - 2));
    const ci = credibleInterval(t.alpha, t.beta);
    return { actionId: id, alpha: t.alpha, beta: t.beta, mean, pulls, ci, pBest: 0 };
  }).sort((a, b) => b.mean - a.mean);

  // Compute P(best) across all actions with data
  const candidates = actionStats.filter((s) => s.pulls > 0).map((s) => s.actionId);
  if (candidates.length > 0) {
    const pBestTable: Record<string, BetaParams> = {};
    for (const s of actionStats) pBestTable[s.actionId] = { alpha: s.alpha, beta: s.beta };
    const pBest = computePBest(candidates, pBestTable);
    for (const s of actionStats) s.pBest = pBest[s.actionId] ?? 0;
  }

  return actionStats;
}

function Bar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%` as any }]} />
      <Text style={styles.barLabel}>{pct}%</Text>
    </View>
  );
}

type Tab = "stats" | "calendar";

export function StatsScreen() {
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<ActionStat[]>([]);
  const [totalBuckets, setTotalBuckets] = useState(0);
  const [calData, setCalData] = useState<DayData[]>([]);
  const [abStats, setAbStats] = useState<{ thompson: { count: number; avgReward: number }; linucb: { count: number; avgReward: number } }>({ thompson: { count: 0, avgReward: 0 }, linucb: { count: 0, avgReward: 0 } });

  useFocusEffect(
    useCallback(() => {
      const params = loadBanditParams() as Record<string, Record<ActionId, BetaParams>>;
      setTotalBuckets(Object.keys(params).length);
      setStats(parseStats(params));
      setCalData(getCalendarData());
      try { setAbStats(getAlgorithmStats()); } catch { /* */ }
    }, [])
  );

  if (stats.every((s) => s.pulls === 0) && calData.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No feedback yet.</Text>
        <Text style={styles.emptySubtext}>Give feedback after a session to see stats here.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabRow}>
        {(["stats", "calendar"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "stats" ? "Action stats" : "Reward calendar"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "calendar" && (
        <>
          <Text style={styles.title}>Reward calendar</Text>
          <Text style={styles.subtitle}>
            Average feedback score per day (last 30 active days).{"\n"}
            Green = mostly Good · Orange = mixed · Red = mostly Bad
          </Text>
          {calData.length === 0 ? (
            <Text style={styles.subtitle}>No feedback data yet.</Text>
          ) : (
            <View style={styles.calGrid}>
              {calData.map((d) => (
                <View key={d.dateStr} style={styles.calCell}>
                  <View style={[styles.calDot, { backgroundColor: rewardColor(d.avgReward) }]} />
                  <Text style={styles.calDate}>{d.dateStr.slice(5)}</Text>
                  <Text style={styles.calCount}>{d.count}x</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {tab === "stats" && (
        <>
      <Text style={styles.title}>Bandit stats</Text>
      <Text style={styles.subtitle}>
        Estimated success rate per action (aggregated across all contexts).{"\n"}
        Buckets with data: {totalBuckets}
      </Text>

      {stats.map((s, idx) => (
        <View key={s.actionId} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{ACTIONS[s.actionId].title}</Text>
              <Text style={styles.actionDesc}>{ACTIONS[s.actionId].description}</Text>
            </View>
            <Text style={styles.pullsText}>{s.pulls} feedback{s.pulls !== 1 ? "s" : ""}</Text>
          </View>

          <Bar value={s.mean} />

          {/* CI visualization */}
          {s.pulls > 0 && (
            <View style={styles.ciRow}>
              <View style={styles.ciTrack}>
                <View style={[styles.ciRange, {
                  left: `${Math.round(s.ci[0] * 100)}%` as any,
                  width: `${Math.max(2, Math.round((s.ci[1] - s.ci[0]) * 100))}%` as any,
                }]} />
                <View style={[styles.ciMean, {
                  left: `${Math.round(s.mean * 100)}%` as any,
                }]} />
              </View>
              <Text style={styles.ciText}>
                90% CI: [{Math.round(s.ci[0] * 100)}%, {Math.round(s.ci[1] * 100)}%]
              </Text>
            </View>
          )}

          <View style={styles.statsMetaRow}>
            <Text style={styles.paramsText}>
              α={s.alpha.toFixed(1)}  β={s.beta.toFixed(1)}
            </Text>
            {s.pulls > 0 && (
              <Text style={styles.pBestText}>
                P(best) = {Math.round(s.pBest * 100)}%
              </Text>
            )}
          </View>
        </View>
      ))}

      <Text style={styles.note}>
        Mean = α/(α+β). CI = 90% Bayesian credible interval via Beta quantiles.
        P(best) = Monte Carlo probability this action has the highest true success rate.
        All values update after each feedback submission.
      </Text>
        </>
      )}
      {/* A/B Test: TS vs LinUCB */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>A/B Test: TS vs LinUCB</Text>
        <Text style={{ fontSize: 12, opacity: 0.6, lineHeight: 16 }}>
          Each session is randomly assigned Thompson Sampling or LinUCB.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <View style={{ flex: 1, borderWidth: 1.5, borderColor: "#2a9d8f", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#2a9d8f", letterSpacing: 1 }}>THOMPSON</Text>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>{abStats.thompson.count}</Text>
            <Text style={{ fontSize: 11, opacity: 0.5 }}>sessions</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#2a9d8f" }}>
              {abStats.thompson.count > 0 ? `${Math.round(abStats.thompson.avgReward * 100)}%` : "—"}
            </Text>
            <Text style={{ fontSize: 10, opacity: 0.5 }}>avg reward</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1.5, borderColor: "#457b9d", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#457b9d", letterSpacing: 1 }}>LINUCB</Text>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>{abStats.linucb.count}</Text>
            <Text style={{ fontSize: 11, opacity: 0.5 }}>sessions</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#457b9d" }}>
              {abStats.linucb.count > 0 ? `${Math.round(abStats.linucb.avgReward * 100)}%` : "—"}
            </Text>
            <Text style={{ fontSize: 10, opacity: 0.5 }}>avg reward</Text>
          </View>
        </View>
        {abStats.thompson.count > 0 && abStats.linucb.count > 0 && (
          <View style={{ marginTop: 6, padding: 10, backgroundColor: "#f5f5f5", borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center" }}>
              {abStats.thompson.avgReward > abStats.linucb.avgReward
                ? `Thompson Sampling leads by ${Math.round((abStats.thompson.avgReward - abStats.linucb.avgReward) * 100)}pp`
                : abStats.linucb.avgReward > abStats.thompson.avgReward
                ? `LinUCB leads by ${Math.round((abStats.linucb.avgReward - abStats.thompson.avgReward) * 100)}pp`
                : "Both algorithms are tied"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 12, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "black", borderColor: "black" },
  tabBtnText: { fontWeight: "700", fontSize: 13 },
  tabBtnTextActive: { color: "white" },

  calGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  calCell: { alignItems: "center", gap: 4, width: 44 },
  calDot: { width: 28, height: 28, borderRadius: 999 },
  calDate: { fontSize: 10, opacity: 0.6 },
  calCount: { fontSize: 10, fontWeight: "700", opacity: 0.7 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptySubtext: { fontSize: 13, opacity: 0.6 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rankBadge: {
    width: 28, height: 28, borderRadius: 999,
    backgroundColor: "black", alignItems: "center", justifyContent: "center",
  },
  rankText: { color: "white", fontSize: 12, fontWeight: "800" },
  actionTitle: { fontSize: 14, fontWeight: "700" },
  actionDesc: { fontSize: 12, opacity: 0.65, lineHeight: 16, marginTop: 2 },
  pullsText: { fontSize: 12, opacity: 0.5, marginTop: 2 },

  barTrack: {
    height: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  barFill: { height: "100%", backgroundColor: "#2a9d8f", borderRadius: 999 },
  barLabel: {
    position: "absolute",
    right: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
  },

  ciRow: { gap: 4 },
  ciTrack: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, position: "relative" as const },
  ciRange: { position: "absolute" as const, height: 8, backgroundColor: "#c8e6c9", borderRadius: 4 },
  ciMean: { position: "absolute" as const, width: 3, height: 12, top: -2, backgroundColor: "#2a9d8f", borderRadius: 1 },
  ciText: { fontSize: 10, opacity: 0.5, fontFamily: "monospace" },

  statsMetaRow: { flexDirection: "row" as const, justifyContent: "space-between" as const },
  paramsText: { fontSize: 11, opacity: 0.45, fontFamily: "monospace" },
  pBestText: { fontSize: 11, opacity: 0.6, fontWeight: "700" as const, color: "#2a9d8f" },

  note: { fontSize: 12, opacity: 0.6, lineHeight: 18, marginTop: 4 },
});
