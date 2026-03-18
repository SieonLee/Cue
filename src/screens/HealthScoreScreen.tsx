import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";

type WeekData = {
  weekLabel: string;   // e.g. "Feb 17"
  avgReward: number;   // 0–1
  count: number;
  score: number;       // 0–100
};

type FeedbackRow = { reward: number; created_at: number };

function getWeekStart(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0=Sun
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function fmtWeek(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeWeeks(rows: FeedbackRow[]): WeekData[] {
  const byWeek: Record<number, { sum: number; count: number }> = {};
  for (const r of rows) {
    const ws = getWeekStart(r.created_at);
    if (!byWeek[ws]) byWeek[ws] = { sum: 0, count: 0 };
    byWeek[ws].sum += r.reward;
    byWeek[ws].count += 1;
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .slice(-8)
    .map(([ws, { sum, count }]) => {
      const avg = sum / count;
      return {
        weekLabel: fmtWeek(Number(ws)),
        avgReward: avg,
        count,
        score: Math.round(avg * 100),
      };
    });
}

function scoreColor(score: number): string {
  if (score >= 70) return "#2a9d8f";
  if (score >= 40) return "#f4a261";
  return "#e63946";
}

function scoreLabel(score: number): string {
  return `${score}%`;
}

function TrendBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${pct}%` as any, backgroundColor: scoreColor(score) }]} />
    </View>
  );
}

const bar = StyleSheet.create({
  track: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
});

export function HealthScoreScreen() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [overall, setOverall] = useState<number | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const rows = db.getAllSync<FeedbackRow>(
        "SELECT reward, created_at FROM feedback ORDER BY created_at ASC"
      );
      setTotalSessions(rows.length);
      if (rows.length === 0) { setWeeks([]); setOverall(null); return; }

      const w = computeWeeks(rows);
      setWeeks(w);

      // Weighted overall: recent weeks count more (linear weight)
      const weighted = w.reduce((acc, wk, i) => acc + wk.score * (i + 1), 0);
      const weightSum = w.reduce((acc, _, i) => acc + (i + 1), 0);
      setOverall(Math.round(weighted / weightSum));
    }, [])
  );

  if (totalSessions === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No data yet.</Text>
        <Text style={styles.emptySubtitle}>
          Give feedback after sessions to see outcome trends here.
        </Text>
      </View>
    );
  }

  const currentScore = weeks.length > 0 ? weeks[weeks.length - 1].score : null;
  const maxScore = weeks.length > 0 ? Math.max(...weeks.map((w) => w.score)) : 100;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Outcome trend</Text>
      <Text style={styles.subtitle}>
        Based on {totalSessions} session{totalSessions !== 1 ? "s" : ""}. Shows avg outcome percentage over time.
      </Text>

      {/* Overall score */}
      {overall !== null && (
        <View style={[styles.overallCard, { borderColor: scoreColor(overall) }]}>
          <Text style={styles.overallLabel}>OVERALL (weighted recent)</Text>
          <View style={styles.overallRow}>
            <Text style={[styles.overallScore, { color: scoreColor(overall) }]}>{overall}</Text>
            <Text style={styles.overallMax}>/100</Text>
            <View style={[styles.overallBadge, { backgroundColor: scoreColor(overall) }]}>
              <Text style={styles.overallBadgeText}>{scoreLabel(overall)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* This week */}
      {currentScore !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.weekScore, { color: scoreColor(currentScore) }]}>{currentScore}</Text>
            <Text style={styles.weekLabel}>{scoreLabel(currentScore)}</Text>
          </View>
          <TrendBar score={currentScore} max={100} />
          <Text style={styles.note}>
            {`${weeks[weeks.length - 1].count} session${weeks[weeks.length - 1].count > 1 ? "s" : ""} this week.`}
          </Text>
        </View>
      )}

      {/* Weekly trend */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly trend (last 8 weeks)</Text>
        <View style={styles.trendList}>
          {weeks.map((w, i) => (
            <View key={i} style={styles.trendRow}>
              <Text style={styles.trendWeek}>{w.weekLabel}</Text>
              <View style={styles.trendBarWrap}>
                <TrendBar score={w.score} max={maxScore} />
              </View>
              <Text style={[styles.trendScore, { color: scoreColor(w.score) }]}>{w.score}</Text>
              <Text style={styles.trendCount}>({w.count})</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Numbers in parentheses = feedback count that week.</Text>
      </View>

      <Text style={styles.disclaimer}>
        This shows session outcome averages only. It does not measure or evaluate your relationship.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, opacity: 0.6, lineHeight: 20, textAlign: "center" },

  overallCard: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 8 },
  overallLabel: { fontSize: 11, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  overallRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  overallScore: { fontSize: 52, fontWeight: "800", lineHeight: 56 },
  overallMax: { fontSize: 20, opacity: 0.4, marginBottom: 6 },
  overallBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, marginBottom: 6 },
  overallBadgeText: { color: "white", fontWeight: "800", fontSize: 13 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekScore: { fontSize: 36, fontWeight: "800" },
  weekLabel: { fontSize: 14, fontWeight: "600", opacity: 0.7 },

  trendList: { gap: 10 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendWeek: { fontSize: 12, opacity: 0.6, width: 48 },
  trendBarWrap: { flex: 1 },
  trendScore: { fontSize: 13, fontWeight: "700", width: 28, textAlign: "right" },
  trendCount: { fontSize: 12, opacity: 0.4, width: 28 },

  note: { fontSize: 12, opacity: 0.6, lineHeight: 18 },
  disclaimer: { fontSize: 12, opacity: 0.5, lineHeight: 18, fontStyle: "italic" },
});
