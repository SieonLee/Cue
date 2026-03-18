import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../db/db";
import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";
import { ACTIONS } from "../coach/actions";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type SessionRow = {
  id: string;
  created_at: number;
  context_json: string;
  ranked_json: string;
};

type FeedbackRow = {
  session_id: string;
  chosen_action: string;
  reward: number;
};

type ParsedSession = {
  id: string;
  createdAt: number;
  ctx: CoachContext;
  topAction: ActionId;
  feedback: FeedbackRow | null;
};

const INTENT_LABEL: Record<string, string> = {
  schedule_change: "Schedule change",
  apology: "Apology",
  request: "Request",
  repair: "Repair",
  boundary: "Boundary",
  checkin: "Check-in",
  positive: "Positive",
  logistics: "Logistics",
  support: "Support",
  recurring: "Recurring",
  decision: "Decision",
  gratitude: "Gratitude",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);
  const [sessions, setSessions] = useState<ParsedSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      const rows = db.getAllSync<SessionRow>(
        "SELECT id, created_at, context_json, ranked_json FROM coach_sessions ORDER BY created_at DESC LIMIT 100"
      );
      const parsed: ParsedSession[] = rows.map((r) => {
        const ctx = JSON.parse(r.context_json) as CoachContext;
        const ranked = JSON.parse(r.ranked_json) as ActionId[];
        const fb = db.getFirstSync<FeedbackRow>(
          "SELECT session_id, chosen_action, reward FROM feedback WHERE session_id = ?",
          [r.id]
        );
        return { id: r.id, createdAt: r.created_at, ctx, topAction: ranked[0], feedback: fb ?? null };
      });
      setSessions(parsed);
    }, [])
  );

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No sessions yet.</Text>
        <Text style={styles.emptySubtext}>Start coaching to see history here.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Session history</Text>
      <Text style={styles.subtitle}>Last 100 sessions. No message content is stored.</Text>

      {sessions.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.dateText}>{formatDate(s.createdAt)}</Text>
            <View style={styles.intentBadge}>
              <Text style={styles.intentBadgeText}>{INTENT_LABEL[s.ctx.intent] ?? s.ctx.intent}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Tag label={s.ctx.stage} colors={colors} />
            <Tag label={s.ctx.channel} colors={colors} />
            {s.ctx.urgency === 1 && <Tag label="Urgent" highlight colors={colors} />}
            {s.ctx.tiredFlag === 1 && <Tag label="Tired" highlight colors={colors} />}
          </View>

          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>Top pick</Text>
            <Text style={styles.actionTitle}>{ACTIONS[s.topAction]?.title ?? s.topAction}</Text>
          </View>

          {s.feedback ? (
            <View style={styles.feedbackRow}>
              <Text style={styles.feedbackLabel}>Used:</Text>
              <Text style={styles.feedbackAction}>{ACTIONS[s.feedback.chosen_action as ActionId]?.title ?? s.feedback.chosen_action}</Text>
              <View style={[styles.rewardBadge, {
                backgroundColor: s.feedback.reward >= 0.75 ? colors.tealLight : s.feedback.reward >= 0.25 ? colors.orangeLight : colors.redLight,
              }]}>
                <Text style={{
                  fontSize: font.sm, fontWeight: font.bold,
                  color: s.feedback.reward >= 0.75 ? colors.teal : s.feedback.reward >= 0.25 ? colors.orange : colors.danger,
                }}>
                  {s.feedback.reward >= 0.75 ? "Good" : s.feedback.reward >= 0.25 ? "Okay" : "Bad"}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noFeedback}>No feedback yet</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Tag({ label, highlight = false, colors: c }: { label: string; highlight?: boolean; colors: ThemeColors }) {
  return (
    <View style={[{
      paddingVertical: 4, paddingHorizontal: 8, borderRadius: radii.pill, borderWidth: 1,
      borderColor: highlight ? c.orange : c.border,
      backgroundColor: highlight ? c.orangeLight : c.card,
    }]}>
      <Text style={{
        fontSize: font.sm + 1, fontWeight: font.semibold,
        color: highlight ? c.orange : c.textSecondary,
      }}>
        {label}
      </Text>
    </View>
  );
}

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.page, gap: spacing.gap, paddingBottom: spacing.pageBtm },
    title: { fontSize: font.xxl, fontWeight: font.bold, color: c.text },
    subtitle: { fontSize: font.md, color: c.textSecondary, lineHeight: 18 },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: font.lg + 1, fontWeight: font.bold, color: c.text },
    emptySubtext: { fontSize: font.md, color: c.textTertiary },

    card: { borderWidth: 1, borderColor: c.border, borderRadius: radii.lg, padding: spacing.cardPad, gap: 10 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dateText: { fontSize: font.sm + 1, color: c.textTertiary },
    intentBadge: { backgroundColor: c.btnPrimary, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radii.pill },
    intentBadgeText: { color: c.btnPrimaryText, fontSize: font.sm, fontWeight: font.bold },

    row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

    actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionLabel: { fontSize: font.sm + 1, color: c.textTertiary, fontWeight: font.bold },
    actionTitle: { fontSize: font.md, fontWeight: font.bold, color: c.text },

    feedbackRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    feedbackLabel: { fontSize: font.sm, color: c.textTertiary, fontWeight: font.semibold },
    feedbackAction: { fontSize: font.sm + 1, fontWeight: font.semibold, color: c.text, flex: 1 },
    rewardBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radii.pill },
    noFeedback: { fontSize: font.sm, color: c.textTertiary, fontStyle: "italic" },
  });
}
