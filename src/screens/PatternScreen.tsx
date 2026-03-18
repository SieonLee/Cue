/**
 * PatternScreen — Action & Session Data Dashboard
 *
 * Aggregates coaching sessions and feedback to surface
 * factual data about action usage:
 *
 * 1. Action Effectiveness: Success rate per action, broken down by context
 * 2. Channel Analysis: Which communication channels correlate with better outcomes
 * 3. Time Patterns: Day-of-week trends
 * 4. Reward Trend: Weekly outcome averages
 * 5. Top Observations: Auto-generated plain-language data summaries
 *
 * NO psychological interpretation. NO partner analysis.
 * ONLY action usage data and outcome statistics.
 */

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";

// ── Types ────────────────────────────────────────────────────────────────────

type ActionEffectiveness = {
  actionId: ActionId;
  title: string;
  totalUses: number;
  avgReward: number;
  wouldUseAgainPct: number;
  topContext: string;  // Most common context for this action
};

type ChannelStat = {
  channel: string;
  count: number;
  avgReward: number;
};

type DayOfWeekStat = {
  day: string;
  dayNum: number;
  count: number;
  avgReward: number;
};

type Observation = {
  text: string;
  type: "positive" | "neutral" | "warning";
};

// ── Data loaders ─────────────────────────────────────────────────────────────

function loadActionEffectiveness(): ActionEffectiveness[] {
  type Row = {
    chosen_action: string;
    avg_reward: number;
    cnt: number;
    would_use_pct: number;
  };

  // Join feedback with outcome_reviews for richer stats
  const rows = db.getAllSync<Row>(
    `SELECT
       f.chosen_action,
       AVG(f.reward) as avg_reward,
       COUNT(*) as cnt,
       COALESCE(
         (SELECT AVG(CAST(r.would_use_again AS REAL)) * 100
          FROM outcome_reviews r WHERE r.chosen_action = f.chosen_action),
         -1
       ) as would_use_pct
     FROM feedback f
     GROUP BY f.chosen_action
     ORDER BY avg_reward DESC`
  );

  return rows.map((r) => {
    const actionId = r.chosen_action as ActionId;
    // Find most common context
    const ctxRow = db.getFirstSync<{ intent: string }>(
      `SELECT json_extract(s.context_json, '$.intent') as intent
       FROM feedback f
       INNER JOIN coach_sessions s ON s.id = f.session_id
       WHERE f.chosen_action = ?
       GROUP BY intent
       ORDER BY COUNT(*) DESC LIMIT 1`,
      [actionId]
    );
    return {
      actionId,
      title: ACTIONS[actionId]?.title ?? actionId,
      totalUses: r.cnt,
      avgReward: r.avg_reward,
      wouldUseAgainPct: r.would_use_pct,
      topContext: ctxRow?.intent ?? "—",
    };
  });
}

function loadChannelStats(): ChannelStat[] {
  type Row = { channel: string; cnt: number; avg_reward: number };
  const rows = db.getAllSync<Row>(
    `SELECT
       json_extract(s.context_json, '$.channel') as channel,
       COUNT(*) as cnt,
       AVG(f.reward) as avg_reward
     FROM feedback f
     INNER JOIN coach_sessions s ON s.id = f.session_id
     GROUP BY channel
     ORDER BY avg_reward DESC`
  );

  return rows.map((r) => ({
    channel: r.channel,
    count: r.cnt,
    avgReward: r.avg_reward,
  }));
}

function loadDayOfWeekStats(): DayOfWeekStat[] {
  type Row = { day_num: number; cnt: number; avg_reward: number };
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const rows = db.getAllSync<Row>(
    `SELECT
       CAST(strftime('%w', f.created_at / 1000, 'unixepoch') AS INTEGER) as day_num,
       COUNT(*) as cnt,
       AVG(f.reward) as avg_reward
     FROM feedback f
     GROUP BY day_num
     ORDER BY day_num`
  );

  return days.map((day, i) => {
    const r = rows.find((row) => row.day_num === i);
    return {
      day,
      dayNum: i,
      count: r?.cnt ?? 0,
      avgReward: r?.avg_reward ?? 0,
    };
  });
}

function generateObservations(
  actions: ActionEffectiveness[],
  channels: ChannelStat[],
  dayStats: DayOfWeekStat[],
): Observation[] {
  const observations: Observation[] = [];

  // Highest avg reward action
  if (actions.length > 0 && actions[0].totalUses >= 2) {
    const best = actions[0];
    const pct = Math.round(best.avgReward * 100);
    observations.push({
      text: `"${best.title}" has the highest avg outcome: ${pct}% across ${best.totalUses} uses.`,
      type: "positive",
    });
  }

  // Lowest avg reward action with enough data
  const worst = [...actions].reverse().find((a) => a.totalUses >= 2);
  if (worst && worst.avgReward < 0.4) {
    observations.push({
      text: `"${worst.title}" has ${Math.round(worst.avgReward * 100)}% avg outcome. Try an alternative in "${worst.topContext}" situations.`,
      type: "warning",
    });
  }

  // Best channel
  if (channels.length > 1) {
    const bestCh = channels[0];
    observations.push({
      text: `"${bestCh.channel}" channel: ${Math.round(bestCh.avgReward * 100)}% avg outcome across ${bestCh.count} sessions.`,
      type: "positive",
    });
  }

  // Day of week pattern
  const activeDays = dayStats.filter((d) => d.count > 0);
  if (activeDays.length > 0) {
    const bestDay = activeDays.reduce((a, b) => a.avgReward > b.avgReward ? a : b);
    if (bestDay.avgReward > 0.6) {
      observations.push({
        text: `${bestDay.day} sessions average ${Math.round(bestDay.avgReward * 100)}% outcome — highest day.`,
        type: "neutral",
      });
    }
  }

  // Would use again
  const actionWithWUA = actions.filter((a) => a.wouldUseAgainPct >= 0 && a.totalUses >= 2);
  if (actionWithWUA.length > 0) {
    const highReuse = actionWithWUA.find((a) => a.wouldUseAgainPct >= 80);
    if (highReuse) {
      observations.push({
        text: `"${highReuse.title}" reuse rate: ${Math.round(highReuse.wouldUseAgainPct)}%.`,
        type: "positive",
      });
    }
  }

  if (observations.length === 0) {
    observations.push({
      text: "Not enough data yet. More sessions will reveal usage patterns.",
      type: "neutral",
    });
  }

  return observations;
}

// ── Visualization components ─────────────────────────────────────────────────

function HorizontalBar({ value, maxValue, color }: { value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <View style={hb.track}>
      <View style={[hb.fill, { width: `${Math.max(2, pct)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const hb = StyleSheet.create({
  track: { height: 14, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
});

function DayOfWeekChart({ data }: { data: DayOfWeekStat[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <View style={dow.container}>
      {data.map((d) => (
        <View key={d.day} style={dow.col}>
          <View style={dow.barContainer}>
            <View
              style={[
                dow.bar,
                {
                  height: `${Math.max(4, (d.count / maxCount) * 100)}%` as any,
                  backgroundColor: d.count === 0 ? "#eee" : rewardToColor(d.avgReward),
                },
              ]}
            />
          </View>
          <Text style={dow.dayLabel}>{d.day}</Text>
          <Text style={dow.countLabel}>{d.count}</Text>
        </View>
      ))}
    </View>
  );
}

const dow = StyleSheet.create({
  container: { flexDirection: "row", gap: 6, height: 100, alignItems: "flex-end" },
  col: { flex: 1, alignItems: "center", gap: 4 },
  barContainer: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, minHeight: 4 },
  dayLabel: { fontSize: 10, fontWeight: "700", opacity: 0.6 },
  countLabel: { fontSize: 9, opacity: 0.4 },
});

function rewardToColor(avg: number): string {
  if (avg >= 0.75) return "#2a9d8f";
  if (avg >= 0.4) return "#f4a261";
  return "#e63946";
}

// ── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "observations" | "actions" | "trends";

// ── Main screen ──────────────────────────────────────────────────────────────

export function PatternScreen() {
  const [tab, setTab] = useState<Tab>("observations");
  const [actions, setActions] = useState<ActionEffectiveness[]>([]);
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [dayStats, setDayStats] = useState<DayOfWeekStat[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const acts = loadActionEffectiveness();
      const chs = loadChannelStats();
      const dows = loadDayOfWeekStats();
      const obs = generateObservations(acts, chs, dows);

      setActions(acts);
      setChannels(chs);
      setDayStats(dows);
      setObservations(obs);

      const sessRow = db.getFirstSync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM feedback"
      );
      setTotalSessions(sessRow?.cnt ?? 0);

      const revRow = db.getFirstSync<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM outcome_reviews"
      );
      setTotalReviews(revRow?.cnt ?? 0);
    }, [])
  );

  // Empty state
  if (totalSessions === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data yet</Text>
        <Text style={styles.emptySubtext}>
          Complete coaching sessions and give feedback to see patterns emerge here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Summary header */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totalSessions}</Text>
          <Text style={styles.summaryLabel}>Sessions</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totalReviews}</Text>
          <Text style={styles.summaryLabel}>Reviews</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{actions.length}</Text>
          <Text style={styles.summaryLabel}>Actions used</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {(["observations", "actions", "trends"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "observations" ? "Data" : t === "actions" ? "Actions" : "Trends"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Observations tab */}
      {tab === "observations" && (
        <>
          <Text style={styles.sectionTitle}>Data observations</Text>
          {observations.map((obs, i) => (
            <View
              key={i}
              style={[
                styles.insightCard,
                obs.type === "positive" && styles.insightPositive,
                obs.type === "warning" && styles.insightWarning,
              ]}
            >
              <Text style={styles.insightText}>{obs.text}</Text>
            </View>
          ))}
        </>
      )}

      {/* Actions tab */}
      {tab === "actions" && (
        <>
          <Text style={styles.sectionTitle}>Action effectiveness</Text>
          {actions.map((a, idx) => (
            <View key={a.actionId} style={styles.card}>
              <View style={styles.actionHeader}>
                <View style={[styles.rankBadge, {
                  backgroundColor: idx === 0 ? "#2a9d8f" : idx === 1 ? "#f4a261" : "#ddd",
                }]}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionMeta}>
                    {a.totalUses} use{a.totalUses !== 1 ? "s" : ""} · Top context: {a.topContext}
                  </Text>
                </View>
              </View>
              <View style={styles.actionStats}>
                <View style={styles.actionStatItem}>
                  <Text style={styles.actionStatValue}>{Math.round(a.avgReward * 100)}%</Text>
                  <Text style={styles.actionStatLabel}>Success</Text>
                </View>
                {a.wouldUseAgainPct >= 0 && (
                  <View style={styles.actionStatItem}>
                    <Text style={styles.actionStatValue}>{Math.round(a.wouldUseAgainPct)}%</Text>
                    <Text style={styles.actionStatLabel}>Reuse</Text>
                  </View>
                )}
              </View>
              <HorizontalBar
                value={a.avgReward}
                maxValue={1}
                color={rewardToColor(a.avgReward)}
              />
            </View>
          ))}

          {/* Channel breakdown */}
          {channels.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>By channel</Text>
              <View style={styles.card}>
                {channels.map((ch) => (
                  <View key={ch.channel} style={styles.channelRow}>
                    <Text style={styles.channelIcon}>
                      {ch.channel === "text" ? "💬" : ch.channel === "call" ? "📞" : "🤝"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.channelName}>{ch.channel}</Text>
                      <Text style={styles.channelMeta}>
                        {ch.count} session{ch.count !== 1 ? "s" : ""} · {Math.round(ch.avgReward * 100)}% avg outcome
                      </Text>
                    </View>
                    <HorizontalBar value={ch.avgReward} maxValue={1} color={rewardToColor(ch.avgReward)} />
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}

      {/* Trends tab */}
      {tab === "trends" && (
        <>
          {/* Day of week */}
          <Text style={styles.sectionTitle}>Day of week</Text>
          <View style={styles.card}>
            <Text style={styles.chartSubtitle}>Sessions by day (color = avg reward)</Text>
            <DayOfWeekChart data={dayStats} />
          </View>

          {/* Effectiveness over time */}
          <Text style={styles.sectionTitle}>Outcome trend</Text>
          <View style={styles.card}>
            {(() => {
              type Row = { week_start: string; avg_reward: number; cnt: number };
              const weeks = db.getAllSync<Row>(
                `SELECT
                   date(created_at / 1000, 'unixepoch', 'weekday 0', '-6 days') as week_start,
                   AVG(reward) as avg_reward,
                   COUNT(*) as cnt
                 FROM feedback
                 GROUP BY week_start
                 ORDER BY week_start DESC
                 LIMIT 8`
              ).reverse();

              if (weeks.length === 0) {
                return <Text style={styles.emptySubtext}>Not enough data yet.</Text>;
              }

              const maxReward = 1;
              return (
                <View style={dow.container}>
                  {weeks.map((w, i) => (
                    <View key={i} style={dow.col}>
                      <View style={dow.barContainer}>
                        <View
                          style={[
                            dow.bar,
                            {
                              height: `${Math.max(4, (w.avg_reward / maxReward) * 100)}%` as any,
                              backgroundColor: rewardToColor(w.avg_reward),
                            },
                          ]}
                        />
                      </View>
                      <Text style={dow.dayLabel}>{w.week_start.slice(5)}</Text>
                      <Text style={dow.countLabel}>{Math.round(w.avg_reward * 100)}%</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        </>
      )}

      <Text style={styles.note}>
        Computed from on-device data only. More sessions = more accurate statistics.
      </Text>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 12, paddingBottom: 32 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptySubtext: { fontSize: 13, opacity: 0.6, textAlign: "center" },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: {
    flex: 1, alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#eee", borderRadius: 10, paddingVertical: 12,
  },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 11, opacity: 0.5 },

  tabRow: { flexDirection: "row", gap: 6 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "black", borderColor: "black" },
  tabText: { fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "white" },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  chartSubtitle: { fontSize: 12, opacity: 0.6, lineHeight: 16 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10 },

  insightCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14,
  },
  insightPositive: { borderColor: "#c8e6c9", backgroundColor: "#f1f8e9" },
  insightWarning: { borderColor: "#ffcdd2", backgroundColor: "#fce4ec" },
  insightText: { flex: 1, fontSize: 13, lineHeight: 20 },

  actionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rankBadge: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: "white", fontSize: 12, fontWeight: "800" },
  actionTitle: { fontSize: 14, fontWeight: "700" },
  actionMeta: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  actionStats: { flexDirection: "row", gap: 16 },
  actionStatItem: { alignItems: "center" },
  actionStatValue: { fontSize: 18, fontWeight: "800" },
  actionStatLabel: { fontSize: 10, opacity: 0.5 },

  channelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  channelIcon: { fontSize: 20 },
  channelName: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  channelMeta: { fontSize: 11, opacity: 0.6 },

  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center", marginTop: 4 },
});
