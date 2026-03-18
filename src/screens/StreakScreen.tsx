import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";

type BadgeDef = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  check: () => boolean;
};

function hasBadge(id: string): boolean {
  const row = db.getFirstSync<{ badge_id: string }>(
    "SELECT badge_id FROM badges WHERE badge_id = ?", [id]
  );
  return !!row;
}

function earnBadge(id: string) {
  if (hasBadge(id)) return;
  db.runSync(
    "INSERT OR IGNORE INTO badges(badge_id, earned_at) VALUES(?, ?)",
    [id, Date.now()]
  );
}

function getTotalFeedback(): number {
  const row = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM feedback");
  return row?.cnt ?? 0;
}

function getTotalReviews(): number {
  const row = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM outcome_reviews");
  return row?.cnt ?? 0;
}

function getDistinctActions(): number {
  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(DISTINCT chosen_action) as cnt FROM feedback"
  );
  return row?.cnt ?? 0;
}

function getGoodFeedbackCount(): number {
  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE reward >= 0.75"
  );
  return row?.cnt ?? 0;
}

const BADGE_DEFS: BadgeDef[] = [
  { id: "first_session", emoji: "🎯", title: "First Steps", desc: "Complete your first coaching session", check: () => getTotalFeedback() >= 1 },
  { id: "five_sessions", emoji: "🔥", title: "Getting Started", desc: "Complete 5 coaching sessions", check: () => getTotalFeedback() >= 5 },
  { id: "ten_sessions", emoji: "⭐", title: "Dedicated", desc: "Complete 10 coaching sessions", check: () => getTotalFeedback() >= 10 },
  { id: "twenty_five", emoji: "💎", title: "Committed", desc: "Complete 25 coaching sessions", check: () => getTotalFeedback() >= 25 },
  { id: "first_review", emoji: "📝", title: "Reflector", desc: "Submit your first conversation review", check: () => getTotalReviews() >= 1 },
  { id: "five_reviews", emoji: "🔍", title: "Deep Thinker", desc: "Submit 5 conversation reviews", check: () => getTotalReviews() >= 5 },
  { id: "all_actions", emoji: "🎨", title: "Full Palette", desc: "Try all 9 communication actions", check: () => getDistinctActions() >= 9 },
  { id: "first_good", emoji: "👍", title: "It Worked!", desc: "Get your first 'Good' feedback", check: () => getGoodFeedbackCount() >= 1 },
  { id: "ten_good", emoji: "🏆", title: "Master Communicator", desc: "Get 10 'Good' outcomes", check: () => getGoodFeedbackCount() >= 10 },
  { id: "streak_7", emoji: "🔥", title: "Weekly Warrior", desc: "Maintain a 7-day streak", check: () => false }, // checked separately
  { id: "streak_30", emoji: "🌟", title: "Monthly Champion", desc: "Maintain a 30-day streak", check: () => false },
];

type DayActivity = { dateKey: string; active: boolean };

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recordTodayEngagement() {
  const today = getDateKey(new Date());
  db.runSync(
    `INSERT INTO daily_engagement(date_key, sessions, reviews, cards, goals_completed, checkins)
     VALUES(?, 0, 0, 0, 0, 0)
     ON CONFLICT(date_key) DO NOTHING`,
    [today]
  );
}

function computeStreaks(): { current: number; longest: number; last28: DayActivity[] } {
  type Row = { date_key: string };

  const feedbackDays = db.getAllSync<{ dk: string }>(
    `SELECT DISTINCT date(created_at / 1000, 'unixepoch') as dk FROM feedback ORDER BY dk`
  );
  const reviewDays = db.getAllSync<{ dk: string }>(
    `SELECT DISTINCT date(created_at / 1000, 'unixepoch') as dk FROM outcome_reviews ORDER BY dk`
  );
  const sessionDays = db.getAllSync<{ dk: string }>(
    `SELECT DISTINCT date(created_at / 1000, 'unixepoch') as dk FROM coach_sessions ORDER BY dk`
  );
  const engagementDays = db.getAllSync<Row>(
    `SELECT date_key FROM daily_engagement`
  );

  const activeDaySet = new Set<string>();
  for (const r of feedbackDays) activeDaySet.add(r.dk);
  for (const r of reviewDays) activeDaySet.add(r.dk);
  for (const r of sessionDays) activeDaySet.add(r.dk);
  for (const r of engagementDays) activeDaySet.add(r.date_key);

  // Compute current streak (counting backwards from today)
  const today = new Date();
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if (activeDaySet.has(key)) {
      current++;
    } else {
      break;
    }
  }

  // Compute longest streak
  const sortedDays = Array.from(activeDaySet).sort();
  let longest = 0;
  let streak = 0;
  let prev = "";
  for (const day of sortedDays) {
    if (prev) {
      const prevDate = new Date(prev);
      const curDate = new Date(day);
      const diff = (curDate.getTime() - prevDate.getTime()) / 86_400_000;
      if (Math.round(diff) === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    longest = Math.max(longest, streak);
    prev = day;
  }

  // Last 28 days
  const last28: DayActivity[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    last28.push({ dateKey: key, active: activeDaySet.has(key) });
  }

  return { current, longest, last28 };
}

function getWeekSessionCount(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM feedback WHERE created_at >= ?",
    [monday.getTime()]
  );
  return row?.cnt ?? 0;
}

const WEEKLY_GOAL = 3;

export function StreakScreen() {
  const [streaks, setStreaks] = useState({ current: 0, longest: 0, last28: [] as DayActivity[] });
  const [weekSessions, setWeekSessions] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [newBadges, setNewBadges] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      recordTodayEngagement();

      const s = computeStreaks();
      setStreaks(s);
      setWeekSessions(getWeekSessionCount());

      const earned = new Set<string>();
      const justEarned: string[] = [];

      for (const badge of BADGE_DEFS) {
        if (badge.id === "streak_7" && s.current >= 7 && !hasBadge("streak_7")) {
          earnBadge("streak_7");
          justEarned.push("streak_7");
        }
        if (badge.id === "streak_30" && s.current >= 30 && !hasBadge("streak_30")) {
          earnBadge("streak_30");
          justEarned.push("streak_30");
        }
        if (badge.id !== "streak_7" && badge.id !== "streak_30" && badge.check()) {
          if (!hasBadge(badge.id)) {
            earnBadge(badge.id);
            justEarned.push(badge.id);
          }
        }
        if (hasBadge(badge.id)) {
          earned.add(badge.id);
        }
      }

      setEarnedBadges(earned);
      setNewBadges(justEarned);
    }, [])
  );

  const weekProgress = Math.min(weekSessions / WEEKLY_GOAL, 1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Streak display */}
      <View style={styles.streakRow}>
        <View style={styles.streakBox}>
          <Text style={styles.streakValue}>{streaks.current}</Text>
          <Text style={styles.streakLabel}>Current streak</Text>
          <Text style={styles.streakUnit}>days</Text>
        </View>
        <View style={styles.streakBox}>
          <Text style={styles.streakValue}>{streaks.longest}</Text>
          <Text style={styles.streakLabel}>Longest streak</Text>
          <Text style={styles.streakUnit}>days</Text>
        </View>
      </View>

      {/* Weekly goal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly goal</Text>
        <Text style={styles.weekText}>
          {weekSessions} / {WEEKLY_GOAL} sessions this week
        </Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.round(weekProgress * 100)}%` as any }]} />
        </View>
        {weekSessions >= WEEKLY_GOAL ? (
          <Text style={styles.goalDone}>Goal reached! Great work this week.</Text>
        ) : (
          <Text style={styles.goalRemaining}>
            {WEEKLY_GOAL - weekSessions} more session{WEEKLY_GOAL - weekSessions !== 1 ? "s" : ""} to go
          </Text>
        )}
      </View>

      {/* Activity heatmap */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 28 days</Text>
        <View style={styles.heatmap}>
          {streaks.last28.map((d) => (
            <View
              key={d.dateKey}
              style={[styles.heatCell, d.active ? styles.heatActive : styles.heatInactive]}
            />
          ))}
        </View>
        <View style={styles.heatLegend}>
          <Text style={styles.heatLegendText}>4 weeks ago</Text>
          <Text style={styles.heatLegendText}>today</Text>
        </View>
      </View>

      {/* New badges alert */}
      {newBadges.length > 0 && (
        <View style={styles.newBadgeCard}>
          <Text style={styles.newBadgeTitle}>New badge{newBadges.length > 1 ? "s" : ""} earned!</Text>
          {newBadges.map((id) => {
            const badge = BADGE_DEFS.find((b) => b.id === id);
            return badge ? (
              <View key={id} style={styles.badgeRow}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <View>
                  <Text style={styles.badgeName}>{badge.title}</Text>
                  <Text style={styles.badgeDesc}>{badge.desc}</Text>
                </View>
              </View>
            ) : null;
          })}
        </View>
      )}

      {/* All badges */}
      <Text style={styles.sectionTitle}>
        Badges ({earnedBadges.size} / {BADGE_DEFS.length})
      </Text>
      <View style={styles.badgeGrid}>
        {BADGE_DEFS.map((badge) => {
          const earned = earnedBadges.has(badge.id);
          return (
            <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
              <Text style={[styles.badgeCardEmoji, !earned && styles.badgeCardEmojiLocked]}>
                {earned ? badge.emoji : "🔒"}
              </Text>
              <Text style={[styles.badgeCardTitle, !earned && styles.badgeCardTitleLocked]}>
                {badge.title}
              </Text>
              <Text style={styles.badgeCardDesc}>{badge.desc}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        Use the app daily to build your streak. Every session, review, or check-in counts.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },

  streakRow: { flexDirection: "row", gap: 10 },
  streakBox: {
    flex: 1, alignItems: "center", gap: 2,
    borderWidth: 2, borderColor: "#eee", borderRadius: 14, paddingVertical: 20,
  },
  streakValue: { fontSize: 36, fontWeight: "800" },
  streakLabel: { fontSize: 12, fontWeight: "600", opacity: 0.6 },
  streakUnit: { fontSize: 11, opacity: 0.4 },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "700" },

  weekText: { fontSize: 15, fontWeight: "600" },
  goalTrack: { height: 12, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  goalFill: { height: "100%", backgroundColor: "#2a9d8f", borderRadius: 999 },
  goalDone: { fontSize: 13, color: "#2a9d8f", fontWeight: "600" },
  goalRemaining: { fontSize: 13, opacity: 0.6 },

  heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  heatCell: { width: 20, height: 20, borderRadius: 4 },
  heatActive: { backgroundColor: "#2a9d8f" },
  heatInactive: { backgroundColor: "#f0f0f0" },
  heatLegend: { flexDirection: "row", justifyContent: "space-between" },
  heatLegendText: { fontSize: 10, opacity: 0.4 },

  newBadgeCard: {
    borderWidth: 2, borderColor: "#f4a261", borderRadius: 14, padding: 14, gap: 10,
    backgroundColor: "#fffbf0",
  },
  newBadgeTitle: { fontSize: 15, fontWeight: "800", color: "#f4a261" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: 14, fontWeight: "700" },
  badgeDesc: { fontSize: 12, opacity: 0.6 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeCard: {
    width: "47%", borderWidth: 1, borderColor: "#eee",
    borderRadius: 12, padding: 12, gap: 4, alignItems: "center",
  },
  badgeCardLocked: { opacity: 0.5, backgroundColor: "#fafafa" },
  badgeCardEmoji: { fontSize: 28 },
  badgeCardEmojiLocked: { opacity: 0.3 },
  badgeCardTitle: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  badgeCardTitleLocked: { opacity: 0.6 },
  badgeCardDesc: { fontSize: 10, opacity: 0.5, textAlign: "center", lineHeight: 14 },

  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
