import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";

type MilestoneCategory = "communication" | "growth" | "consistency" | "emotional";

type MilestoneDef = {
  id: string;
  category: MilestoneCategory;
  emoji: string;
  title: string;
  description: string;
  check: () => { achieved: boolean; achievedAt?: number; progress: number; progressLabel: string };
};

type MilestoneState = {
  id: string;
  category: MilestoneCategory;
  emoji: string;
  title: string;
  description: string;
  achieved: boolean;
  achievedAt?: number;
  progress: number;
  progressLabel: string;
};

function countQuery(sql: string, params: any[] = []): number {
  const row = db.getFirstSync<{ cnt: number }>(sql, params);
  return row?.cnt ?? 0;
}

function minTimestamp(sql: string, params: any[] = []): number | undefined {
  const row = db.getFirstSync<{ ts: number | null }>(sql, params);
  return row?.ts ?? undefined;
}

function avgQuery(sql: string, params: any[] = []): number {
  const row = db.getFirstSync<{ avg_val: number | null }>(sql, params);
  return row?.avg_val ?? 0;
}

const MILESTONES: MilestoneDef[] = [
  {
    id: "first_session", category: "communication", emoji: "\uD83C\uDFAF",
    title: "First Conversation",
    description: "Complete your first coaching session",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM feedback");
      const ts = minTimestamp("SELECT MIN(created_at) as ts FROM feedback");
      return { achieved: cnt >= 1, achievedAt: ts, progress: Math.min(cnt, 1), progressLabel: `${Math.min(cnt, 1)}/1 sessions` };
    },
  },
  {
    id: "ten_sessions", category: "communication", emoji: "\u2B50",
    title: "Regular Communicator",
    description: "Complete 10 coaching sessions",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM feedback");
      return { achieved: cnt >= 10, achievedAt: cnt >= 10 ? minTimestamp("SELECT created_at as ts FROM feedback ORDER BY created_at LIMIT 1 OFFSET 9") : undefined, progress: Math.min(cnt / 10, 1), progressLabel: `${Math.min(cnt, 10)}/10 sessions` };
    },
  },
  {
    id: "fifty_sessions", category: "communication", emoji: "\uD83D\uDC8E",
    title: "Communication Expert",
    description: "Complete 50 coaching sessions",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM feedback");
      return { achieved: cnt >= 50, achievedAt: cnt >= 50 ? minTimestamp("SELECT created_at as ts FROM feedback ORDER BY created_at LIMIT 1 OFFSET 49") : undefined, progress: Math.min(cnt / 50, 1), progressLabel: `${Math.min(cnt, 50)}/50 sessions` };
    },
  },
  {
    id: "first_good_outcome", category: "communication", emoji: "\uD83D\uDC4D",
    title: "First Win",
    description: "Get your first positive outcome (reward >= 0.75)",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM feedback WHERE reward >= 0.75");
      const ts = minTimestamp("SELECT MIN(created_at) as ts FROM feedback WHERE reward >= 0.75");
      return { achieved: cnt >= 1, achievedAt: ts, progress: Math.min(cnt, 1), progressLabel: cnt >= 1 ? "Achieved!" : "0/1 positive outcomes" };
    },
  },
  {
    id: "five_positive_streak", category: "communication", emoji: "\uD83D\uDD25",
    title: "Hot Streak",
    description: "Get 5 positive outcomes in a row",
    check: () => {
      type Row = { reward: number };
      const rows = db.getAllSync<Row>("SELECT reward FROM feedback ORDER BY created_at DESC");
      let streak = 0;
      let maxStreak = 0;
      for (const r of rows) {
        if (r.reward >= 0.75) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      return { achieved: maxStreak >= 5, progress: Math.min(maxStreak / 5, 1), progressLabel: `${Math.min(maxStreak, 5)}/5 in a row` };
    },
  },
  // ── Growth ────────────────────────────────────────────────────────────
  {
    id: "all_actions", category: "growth", emoji: "\uD83C\uDFA8",
    title: "Full Toolkit",
    description: "Try all 9 communication actions at least once",
    check: () => {
      const cnt = countQuery("SELECT COUNT(DISTINCT chosen_action) as cnt FROM feedback");
      return { achieved: cnt >= 9, progress: cnt / 9, progressLabel: `${cnt}/9 actions used` };
    },
  },
  {
    id: "first_lesson", category: "growth", emoji: "\uD83D\uDCDA",
    title: "Student",
    description: "Complete your first lesson",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM lesson_progress WHERE completed = 1");
      const ts = minTimestamp("SELECT MIN(completed_at) as ts FROM lesson_progress WHERE completed = 1");
      return { achieved: cnt >= 1, achievedAt: ts, progress: Math.min(cnt, 1), progressLabel: cnt >= 1 ? "Achieved!" : "0/1 lessons" };
    },
  },
  {
    id: "all_lessons", category: "growth", emoji: "\uD83C\uDF93",
    title: "Graduate",
    description: "Complete all 8 guided lessons",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM lesson_progress WHERE completed = 1");
      return { achieved: cnt >= 8, progress: Math.min(cnt / 8, 1), progressLabel: `${Math.min(cnt, 8)}/8 lessons` };
    },
  },
  {
    id: "perfect_lessons", category: "growth", emoji: "\uD83C\uDFC6",
    title: "Perfect Scholar",
    description: "Get a perfect score on all lessons",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM lesson_progress WHERE completed = 1 AND score = 1");
      return { achieved: cnt >= 8, progress: Math.min(cnt / 8, 1), progressLabel: `${cnt}/8 perfect` };
    },
  },
  {
    id: "first_review", category: "growth", emoji: "\uD83D\uDCDD",
    title: "Self-Aware",
    description: "Submit your first conversation review",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM outcome_reviews");
      const ts = minTimestamp("SELECT MIN(created_at) as ts FROM outcome_reviews");
      return { achieved: cnt >= 1, achievedAt: ts, progress: Math.min(cnt, 1), progressLabel: cnt >= 1 ? "Achieved!" : "0/1 reviews" };
    },
  },
  // ── Consistency ───────────────────────────────────────────────────────
  {
    id: "streak_7", category: "consistency", emoji: "\uD83D\uDD25",
    title: "Weekly Warrior",
    description: "Maintain a 7-day usage streak",
    check: () => {
      const earned = db.getFirstSync<{ badge_id: string }>("SELECT badge_id FROM badges WHERE badge_id = 'streak_7'");
      return { achieved: !!earned, progress: earned ? 1 : 0, progressLabel: earned ? "Achieved!" : "Keep using daily!" };
    },
  },
  {
    id: "streak_30", category: "consistency", emoji: "\uD83C\uDF1F",
    title: "Monthly Master",
    description: "Maintain a 30-day usage streak",
    check: () => {
      const earned = db.getFirstSync<{ badge_id: string }>("SELECT badge_id FROM badges WHERE badge_id = 'streak_30'");
      return { achieved: !!earned, progress: earned ? 1 : 0, progressLabel: earned ? "Achieved!" : "Keep the streak!" };
    },
  },
  {
    id: "week_goal_4", category: "consistency", emoji: "\uD83D\uDCC5",
    title: "Goal Crusher",
    description: "Hit your weekly session goal 4 weeks in a row",
    check: () => {
      // Check last 4 weeks
      let weeksHit = 0;
      for (let w = 0; w < 4; w++) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7) - w * 7);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 7);

        const cnt = countQuery(
          "SELECT COUNT(*) as cnt FROM feedback WHERE created_at >= ? AND created_at < ?",
          [monday.getTime(), sunday.getTime()]
        );
        if (cnt >= 3) weeksHit++;
      }
      return { achieved: weeksHit >= 4, progress: weeksHit / 4, progressLabel: `${weeksHit}/4 weeks` };
    },
  },
  // ── Emotional ─────────────────────────────────────────────────────────
  {
    id: "emotion_improve", category: "emotional", emoji: "\uD83D\uDE0A",
    title: "Mood Lifter",
    description: "Average positive emotion change across 5+ reviews",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM outcome_reviews");
      if (cnt < 5) return { achieved: false, progress: cnt / 5, progressLabel: `${cnt}/5 reviews needed` };
      const avg = avgQuery("SELECT AVG(emotion_after - emotion_before) as avg_val FROM outcome_reviews");
      return { achieved: avg > 0, progress: avg > 0 ? 1 : 0.5, progressLabel: avg > 0 ? `+${avg.toFixed(1)} avg improvement` : "Keep working on it!" };
    },
  },
  {
    id: "receptive_partner", category: "emotional", emoji: "\u2764\uFE0F",
    title: "Open Hearts",
    description: "Get 'receptive' partner reaction 5 times",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM outcome_reviews WHERE partner_reaction = 'receptive'");
      return { achieved: cnt >= 5, progress: Math.min(cnt / 5, 1), progressLabel: `${Math.min(cnt, 5)}/5 receptive reactions` };
    },
  },
  {
    id: "would_reuse", category: "emotional", emoji: "\uD83D\uDD01",
    title: "Reliable Methods",
    description: "Mark 'would use again' on 10 different sessions",
    check: () => {
      const cnt = countQuery("SELECT COUNT(*) as cnt FROM outcome_reviews WHERE would_use_again = 1");
      return { achieved: cnt >= 10, progress: Math.min(cnt / 10, 1), progressLabel: `${Math.min(cnt, 10)}/10 reusable actions` };
    },
  },
];

const CATEGORY_META: Record<MilestoneCategory, { label: string; color: string }> = {
  communication: { label: "Communication", color: "#264653" },
  growth: { label: "Growth", color: "#2a9d8f" },
  consistency: { label: "Consistency", color: "#e9c46a" },
  emotional: { label: "Emotional", color: "#e76f51" },
};

export function MilestoneScreen() {
  const [milestones, setMilestones] = useState<MilestoneState[]>([]);

  useFocusEffect(
    useCallback(() => {
      const states: MilestoneState[] = MILESTONES.map((m) => {
        const result = m.check();
        return {
          id: m.id, category: m.category, emoji: m.emoji,
          title: m.title, description: m.description,
          ...result,
        };
      });
      setMilestones(states);
    }, [])
  );

  const achieved = milestones.filter((m) => m.achieved);
  const upcoming = milestones.filter((m) => !m.achieved);

  achieved.sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0));

  upcoming.sort((a, b) => b.progress - a.progress);

  function formatDate(ts?: number): string {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Milestones</Text>
      <Text style={styles.subtitle}>
        Track your relationship communication journey. Milestones are automatically
        detected as you use the app.
      </Text>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{achieved.length}</Text>
          <Text style={styles.summaryLabel}>Achieved</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{upcoming.length}</Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{Math.round((achieved.length / milestones.length) * 100)}%</Text>
          <Text style={styles.summaryLabel}>Complete</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round((achieved.length / milestones.length) * 100)}%` as any }]} />
      </View>

      {/* Next up */}
      {upcoming.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Next up</Text>
          {upcoming.slice(0, 3).map((m) => (
            <View key={m.id} style={styles.milestoneCard}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.milestoneName}>{m.title}</Text>
                  <Text style={styles.milestoneDesc}>{m.description}</Text>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_META[m.category].color + "22" }]}>
                  <Text style={[styles.categoryText, { color: CATEGORY_META[m.category].color }]}>
                    {CATEGORY_META[m.category].label}
                  </Text>
                </View>
              </View>
              <View style={styles.milestoneProgress}>
                <View style={styles.milestoneTrack}>
                  <View style={[styles.milestoneFill, { width: `${Math.round(m.progress * 100)}%` as any }]} />
                </View>
                <Text style={styles.milestoneProgressText}>{m.progressLabel}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Achieved timeline */}
      {achieved.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Achieved</Text>
          {achieved.map((m, idx) => (
            <View key={m.id} style={styles.timelineRow}>
              <View style={styles.timelineLine}>
                <View style={styles.timelineDot} />
                {idx < achieved.length - 1 && <View style={styles.timelineConnector} />}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineEmoji}>{m.emoji}</Text>
                  <Text style={styles.timelineName}>{m.title}</Text>
                </View>
                <Text style={styles.timelineDesc}>{m.description}</Text>
                {m.achievedAt && (
                  <Text style={styles.timelineDate}>{formatDate(m.achievedAt)}</Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      {/* All milestones by category */}
      <Text style={styles.sectionTitle}>All milestones</Text>
      {(Object.keys(CATEGORY_META) as MilestoneCategory[]).map((cat) => {
        const catMilestones = milestones.filter((m) => m.category === cat);
        const catAchieved = catMilestones.filter((m) => m.achieved).length;
        return (
          <View key={cat} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_META[cat].color }]} />
              <Text style={styles.categoryName}>{CATEGORY_META[cat].label}</Text>
              <Text style={styles.categoryCount}>{catAchieved}/{catMilestones.length}</Text>
            </View>
            {catMilestones.map((m) => (
              <View key={m.id} style={styles.miniRow}>
                <Text style={styles.miniEmoji}>{m.achieved ? m.emoji : "\uD83D\uDD12"}</Text>
                <Text style={[styles.miniName, !m.achieved && styles.miniNameLocked]}>{m.title}</Text>
                {!m.achieved && m.progress > 0 && (
                  <Text style={styles.miniProgress}>{Math.round(m.progress * 100)}%</Text>
                )}
                {m.achieved && <Text style={styles.miniCheck}>{"\u2713"}</Text>}
              </View>
            ))}
          </View>
        );
      })}

      <Text style={styles.note}>
        Keep using the app to unlock milestones automatically!
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },

  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, opacity: 0.7, lineHeight: 20 },

  summaryRow: { flexDirection: "row", gap: 10 },
  summaryBox: {
    flex: 1, alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: "#eee", borderRadius: 12, paddingVertical: 14,
  },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { fontSize: 11, fontWeight: "600", opacity: 0.5 },

  progressTrack: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#2a9d8f", borderRadius: 999 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },

  milestoneCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 10 },
  milestoneHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  milestoneEmoji: { fontSize: 24 },
  milestoneName: { fontSize: 15, fontWeight: "700" },
  milestoneDesc: { fontSize: 12, opacity: 0.6, lineHeight: 16 },
  milestoneProgress: { gap: 4 },
  milestoneTrack: { height: 6, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  milestoneFill: { height: "100%", backgroundColor: "#2a9d8f", borderRadius: 999 },
  milestoneProgressText: { fontSize: 11, opacity: 0.5, fontWeight: "600" },

  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 10, fontWeight: "700" },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineLine: { width: 20, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 999, backgroundColor: "#2a9d8f" },
  timelineConnector: { width: 2, flex: 1, backgroundColor: "#e0e0e0", marginTop: 4 },
  timelineContent: { flex: 1, gap: 2, paddingBottom: 16 },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineEmoji: { fontSize: 18 },
  timelineName: { fontSize: 14, fontWeight: "700" },
  timelineDesc: { fontSize: 12, opacity: 0.6 },
  timelineDate: { fontSize: 11, opacity: 0.4, fontWeight: "600" },

  // Category section
  categoryCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, gap: 8 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryDot: { width: 10, height: 10, borderRadius: 999 },
  categoryName: { fontSize: 14, fontWeight: "700", flex: 1 },
  categoryCount: { fontSize: 12, fontWeight: "600", opacity: 0.5 },

  miniRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#f5f5f5" },
  miniEmoji: { fontSize: 16, width: 24, textAlign: "center" },
  miniName: { fontSize: 13, fontWeight: "600", flex: 1 },
  miniNameLocked: { opacity: 0.4 },
  miniProgress: { fontSize: 11, fontWeight: "700", color: "#2a9d8f" },
  miniCheck: { fontSize: 14, fontWeight: "800", color: "#2a9d8f" },

  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
