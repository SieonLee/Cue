import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";

type DayStats = {
  day: string; // "Mon", "Tue", etc.
  dayIndex: number;
  totalSessions: number;
  badOutcomes: number;
  avgReward: number;
  conflictRate: number; // bad / total
};

type HourStats = {
  hour: number;
  totalSessions: number;
  badOutcomes: number;
  conflictRate: number;
};

type ConflictPrediction = {
  day: string;
  probability: number;
  riskLevel: "low" | "medium" | "high";
  bestAction: ActionId | null;
  bestActionTitle: string;
};

type RadarData = {
  dayStats: DayStats[];
  hourStats: HourStats[];
  todayPrediction: ConflictPrediction;
  weeklyPredictions: ConflictPrediction[];
  topRiskFactors: string[];
  overallConflictRate: number;
  totalDataPoints: number;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function loadRadarData(): RadarData {
  type Row = {
    session_id: string;
    created_at: number;
    reward: number;
    chosen_action: string;
    context_json: string;
  };

  const rows = db.getAllSync<Row>(
    `SELECT f.session_id, f.created_at, f.reward, f.chosen_action, cs.context_json
     FROM feedback f
     JOIN coach_sessions cs ON cs.id = f.session_id
     ORDER BY f.created_at DESC`
  );

  const dayBuckets: Record<number, { total: number; bad: number; rewards: number[] }> = {};
  for (let i = 0; i < 7; i++) dayBuckets[i] = { total: 0, bad: 0, rewards: [] };

  const hourBuckets: Record<number, { total: number; bad: number }> = {};
  for (let i = 0; i < 24; i++) hourBuckets[i] = { total: 0, bad: 0 };

  const dayActions: Record<number, Record<string, { sum: number; count: number }>> = {};

  for (const row of rows) {
    const d = new Date(row.created_at);
    const dayIdx = d.getDay();
    const hour = d.getHours();

    dayBuckets[dayIdx].total++;
    dayBuckets[dayIdx].rewards.push(row.reward);
    if (row.reward < 0.5) dayBuckets[dayIdx].bad++;

    hourBuckets[hour].total++;
    if (row.reward < 0.5) hourBuckets[hour].bad++;

    if (!dayActions[dayIdx]) dayActions[dayIdx] = {};
    const a = row.chosen_action;
    if (!dayActions[dayIdx][a]) dayActions[dayIdx][a] = { sum: 0, count: 0 };
    dayActions[dayIdx][a].sum += row.reward;
    dayActions[dayIdx][a].count++;
  }

  const dayStats: DayStats[] = DAY_NAMES.map((name, i) => {
    const bucket = dayBuckets[i];
    return {
      day: name,
      dayIndex: i,
      totalSessions: bucket.total,
      badOutcomes: bucket.bad,
      avgReward: bucket.rewards.length > 0 ? bucket.rewards.reduce((a, b) => a + b, 0) / bucket.rewards.length : 0,
      conflictRate: bucket.total > 0 ? bucket.bad / bucket.total : 0,
    };
  });

  const hourStats: HourStats[] = [];
  for (let h = 0; h < 24; h++) {
    const bucket = hourBuckets[h];
    if (bucket.total > 0) {
      hourStats.push({
        hour: h,
        totalSessions: bucket.total,
        badOutcomes: bucket.bad,
        conflictRate: bucket.total > 0 ? bucket.bad / bucket.total : 0,
      });
    }
  }

  const today = new Date().getDay();
  const weeklyPredictions: ConflictPrediction[] = DAY_NAMES.map((name, i) => {
    const stats = dayStats[i];
    const probability = stats.totalSessions > 0
      ? (stats.badOutcomes + 1) / (stats.totalSessions + 2)
      : 0.3;

    let bestAction: ActionId | null = null;
    let bestReward = 0;
    const actions = dayActions[i] ?? {};
    for (const [a, s] of Object.entries(actions)) {
      const avg = s.sum / s.count;
      if (avg > bestReward) { bestReward = avg; bestAction = a as ActionId; }
    }

    return {
      day: name,
      probability,
      riskLevel: probability >= 0.5 ? "high" : probability >= 0.3 ? "medium" : "low",
      bestAction,
      bestActionTitle: bestAction ? ACTIONS[bestAction]?.title ?? bestAction : "Use Check-in (A1)",
    };
  });

  const todayPrediction = weeklyPredictions[today];

  const topRiskFactors: string[] = [];
  const highRiskDays = dayStats.filter((d) => d.conflictRate > 0.4 && d.totalSessions >= 2);
  if (highRiskDays.length > 0) {
    topRiskFactors.push(`Lower avg outcome on ${highRiskDays.map((d) => d.day).join(", ")}`);
  }

  const peakHours = hourStats.filter((h) => h.conflictRate > 0.5 && h.totalSessions >= 2);
  if (peakHours.length > 0) {
    topRiskFactors.push(`Lower outcome hours: ${peakHours.map((h) => `${h.hour}:00`).join(", ")}`);
  }

  type EscRow = { context_json: string; reward: number };
  const escRows = db.getAllSync<EscRow>(
    `SELECT cs.context_json, f.reward FROM feedback f
     JOIN coach_sessions cs ON cs.id = f.session_id`
  );
  let escTotal = 0;
  let escBad = 0;
  for (const r of escRows) {
    try {
      const ctx = JSON.parse(r.context_json);
      if (ctx.stage === "escalation") { escTotal++; if (r.reward < 0.5) escBad++; }
    } catch { /* skip */ }
  }
  if (escTotal >= 2 && escBad / escTotal > 0.5) {
    topRiskFactors.push(`Escalation situations have ${Math.round((escBad / escTotal) * 100)}% bad outcome rate`);
  }

  const overallConflictRate = rows.length > 0
    ? rows.filter((r) => r.reward < 0.5).length / rows.length
    : 0;

  return {
    dayStats, hourStats, todayPrediction, weeklyPredictions,
    topRiskFactors, overallConflictRate, totalDataPoints: rows.length,
  };
}

function riskColor(level: string): string {
  return level === "high" ? "#e76f51" : level === "medium" ? "#e9c46a" : "#2a9d8f";
}

function heatColor(rate: number): string {
  if (rate >= 0.5) return "#e76f51";
  if (rate >= 0.3) return "#f4a261";
  if (rate >= 0.15) return "#e9c46a";
  return "#2a9d8f";
}

export function ConflictRadarScreen() {
  const [data, setData] = useState<RadarData | null>(null);

  useFocusEffect(useCallback(() => { setData(loadRadarData()); }, []));

  if (!data) return null;

  const todayIdx = new Date().getDay();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Today's historical data */}
      <View style={[styles.todayCard, { borderColor: "#264653" }]}>
        <Text style={styles.todayLabel}>{DAY_NAMES_FULL[todayIdx].toUpperCase()} — PAST SESSIONS</Text>
        <View style={styles.todayRow}>
          <View style={[styles.todayCircle, { borderColor: "#264653" }]}>
            <Text style={[styles.todayPct, { color: "#264653" }]}>
              {data.dayStats[todayIdx].totalSessions}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.todayRisk, { color: "#264653" }]}>
              {data.dayStats[todayIdx].totalSessions} sessions on {DAY_NAMES[todayIdx]}s
            </Text>
            <Text style={styles.todayAdvice}>
              Most effective action: {data.weeklyPredictions[todayIdx].bestActionTitle}
            </Text>
          </View>
        </View>
      </View>

      {/* Day-of-Week Heatmap */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SESSION HEATMAP BY DAY</Text>
        <View style={styles.heatmapRow}>
          {data.dayStats.map((d, i) => (
            <View key={d.day} style={styles.heatmapCol}>
              <View style={[styles.heatCell, {
                backgroundColor: d.totalSessions > 0 ? heatColor(d.conflictRate) : "#f0f0f0",
                opacity: d.totalSessions > 0 ? 0.3 + d.conflictRate * 0.7 : 0.2,
              }, i === todayIdx && styles.heatCellToday]} />
              <Text style={[styles.heatDay, i === todayIdx && styles.heatDayToday]}>{d.day}</Text>
              <Text style={styles.heatCount}>{d.totalSessions}</Text>
            </View>
          ))}
        </View>
        <View style={styles.heatLegend}>
          <View style={[styles.heatLegendDot, { backgroundColor: "#2a9d8f" }]} />
          <Text style={styles.heatLegendText}>Low</Text>
          <View style={[styles.heatLegendDot, { backgroundColor: "#e9c46a" }]} />
          <Text style={styles.heatLegendText}>Med</Text>
          <View style={[styles.heatLegendDot, { backgroundColor: "#e76f51" }]} />
          <Text style={styles.heatLegendText}>High low-outcome</Text>
        </View>
      </View>

      {/* Weekly outcome pattern */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>OUTCOME PATTERN BY DAY</Text>
        {data.weeklyPredictions.map((p, i) => {
          const isToday = i === todayIdx;
          return (
            <View key={p.day} style={[styles.forecastRow, isToday && styles.forecastRowToday]}>
              <Text style={[styles.forecastDay, isToday && styles.forecastDayToday]}>{p.day}</Text>
              <View style={styles.forecastBarTrack}>
                <View style={[styles.forecastBarFill, {
                  width: `${Math.round(p.probability * 100)}%`,
                  backgroundColor: riskColor(p.riskLevel),
                }]} />
              </View>
              <Text style={[styles.forecastPct, { color: riskColor(p.riskLevel) }]}>
                {Math.round(p.probability * 100)}%
              </Text>
              <Text style={styles.forecastAction} numberOfLines={1}>
                {p.bestActionTitle}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Peak Hours */}
      {data.hourStats.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SESSIONS BY HOUR</Text>
          <View style={styles.hourChart}>
            {data.hourStats.map((h) => {
              const height = Math.max(8, Math.round(h.conflictRate * 60));
              return (
                <View key={h.hour} style={styles.hourCol}>
                  <View style={[styles.hourBar, {
                    height,
                    backgroundColor: heatColor(h.conflictRate),
                  }]} />
                  <Text style={styles.hourLabel}>{h.hour}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Risk Factors */}
      {data.topRiskFactors.length > 0 && (
        <View style={styles.riskCard}>
          <Text style={styles.sectionLabel}>OBSERVED PATTERNS</Text>
          {data.topRiskFactors.map((factor, i) => (
            <View key={i} style={styles.riskRow}>
              <Text style={styles.riskBullet}>!</Text>
              <Text style={styles.riskText}>{factor}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Overall Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{data.totalDataPoints}</Text>
          <Text style={styles.statLabel}>data points</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: heatColor(data.overallConflictRate) }]}>
            {Math.round(data.overallConflictRate * 100)}%
          </Text>
          <Text style={styles.statLabel}>low-outcome rate</Text>
        </View>
      </View>

      {/* Method note */}
      <View style={styles.dsNote}>
        <Text style={styles.dsLabel}>METHOD</Text>
        <Text style={styles.dsText}>
          Frequency-based estimation with Laplace smoothing: P(low_outcome|day) = (bad+1)/(total+2).
          As more data accumulates, estimates converge to true day-specific outcome rates.
          Shows historical patterns only — not predictions about future conversations.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },

  todayCard: { borderWidth: 2, borderRadius: 16, padding: 16, gap: 10, backgroundColor: "#fafafa" },
  todayLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  todayCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  todayPct: { fontSize: 22, fontWeight: "900" },
  todayRisk: { fontSize: 14, fontWeight: "900" },
  todayAdvice: { fontSize: 13, opacity: 0.6, lineHeight: 18, marginTop: 2 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, gap: 8, backgroundColor: "#fafafa" },
  sectionLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },

  heatmapRow: { flexDirection: "row", gap: 4 },
  heatmapCol: { flex: 1, alignItems: "center", gap: 4 },
  heatCell: { width: "100%", height: 40, borderRadius: 8 },
  heatCellToday: { borderWidth: 2, borderColor: "#264653" },
  heatDay: { fontSize: 10, fontWeight: "700", opacity: 0.6 },
  heatDayToday: { fontWeight: "900", color: "#264653", opacity: 1 },
  heatCount: { fontSize: 9, opacity: 0.4 },
  heatLegend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  heatLegendDot: { width: 10, height: 10, borderRadius: 5 },
  heatLegendText: { fontSize: 10, opacity: 0.5 },

  forecastRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  forecastRowToday: { backgroundColor: "#f0f4ff", borderRadius: 8, paddingHorizontal: 6 },
  forecastDay: { width: 30, fontSize: 12, fontWeight: "700" },
  forecastDayToday: { fontWeight: "900", color: "#264653" },
  forecastBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#eee" },
  forecastBarFill: { height: 8, borderRadius: 4 },
  forecastPct: { width: 36, fontSize: 12, fontWeight: "800", textAlign: "right" },
  forecastAction: { width: 90, fontSize: 10, opacity: 0.5 },

  hourChart: { flexDirection: "row", alignItems: "flex-end", gap: 3, minHeight: 70 },
  hourCol: { flex: 1, alignItems: "center", gap: 2 },
  hourBar: { width: "80%", borderRadius: 3, minWidth: 4 },
  hourLabel: { fontSize: 8, opacity: 0.5, fontWeight: "600" },

  riskCard: { borderWidth: 2, borderColor: "#f4a261", borderRadius: 12, padding: 14, gap: 6, backgroundColor: "#fffbf0" },
  riskRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  riskBullet: { fontSize: 14, fontWeight: "900", color: "#e76f51" },
  riskText: { flex: 1, fontSize: 13, lineHeight: 18 },

  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 10, opacity: 0.5, fontWeight: "600" },

  dsNote: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, gap: 4, backgroundColor: "#f8f8f8" },
  dsLabel: { fontSize: 9, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  dsText: { fontSize: 11, lineHeight: 16, opacity: 0.5, fontFamily: "monospace" },
});
