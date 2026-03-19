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
  feedback_reason: string | null;
};

type ReviewRow = {
  session_id: string;
  partner_reaction: string;
  emotion_before: number;
  emotion_after: number;
  would_use_again: number;
};

type ParsedSession = {
  id: string;
  createdAt: number;
  ctx: CoachContext;
  topAction: ActionId;
  feedback: FeedbackRow | null;
  review: ReviewRow | null;
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
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      const parsed: ParsedSession[] = rows.map((row) => {
        const ctx = JSON.parse(row.context_json) as CoachContext;
        const ranked = JSON.parse(row.ranked_json) as ActionId[];
        const feedback = db.getFirstSync<FeedbackRow>(
          "SELECT session_id, chosen_action, reward, feedback_reason FROM feedback WHERE session_id = ?",
          [row.id]
        );
        const review = db.getFirstSync<ReviewRow>(
          "SELECT session_id, partner_reaction, emotion_before, emotion_after, would_use_again FROM outcome_reviews WHERE session_id = ?",
          [row.id]
        );
        return {
          id: row.id,
          createdAt: row.created_at,
          ctx,
          topAction: ranked[0],
          feedback: feedback ?? null,
          review: review ?? null,
        };
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

      {sessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.dateText}>{formatDate(session.createdAt)}</Text>
            <View style={styles.intentBadge}>
              <Text style={styles.intentBadgeText}>
                {INTENT_LABEL[session.ctx.intent] ?? session.ctx.intent}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Tag label={session.ctx.stage} colors={colors} />
            <Tag label={session.ctx.channel} colors={colors} />
            {session.ctx.urgency === 1 && <Tag label="Urgent" highlight colors={colors} />}
            {session.ctx.tiredFlag === 1 && <Tag label="Tired" highlight colors={colors} />}
          </View>

          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>Top pick</Text>
            <Text style={styles.actionTitle}>
              {ACTIONS[session.topAction]?.title ?? session.topAction}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <StatusChip
              label={session.feedback ? "Feedback saved" : "Waiting for feedback"}
              tone={session.feedback ? "positive" : "neutral"}
              colors={colors}
            />
            <StatusChip
              label={
                session.review
                  ? "Review complete"
                  : session.feedback
                    ? "Review pending"
                    : "Review locked"
              }
              tone={session.review ? "positive" : session.feedback ? "warning" : "neutral"}
              colors={colors}
            />
          </View>

          {session.feedback ? (
            <>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackLabel}>Used:</Text>
                <Text style={styles.feedbackAction}>
                  {ACTIONS[session.feedback.chosen_action as ActionId]?.title ??
                    session.feedback.chosen_action}
                </Text>
                <View
                  style={[
                    styles.rewardBadge,
                    {
                      backgroundColor:
                        session.feedback.reward >= 0.75
                          ? colors.tealLight
                          : session.feedback.reward >= 0.25
                            ? colors.orangeLight
                            : colors.redLight,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: font.sm,
                      fontWeight: font.bold,
                      color:
                        session.feedback.reward >= 0.75
                          ? colors.teal
                          : session.feedback.reward >= 0.25
                            ? colors.orange
                            : colors.danger,
                    }}
                  >
                    {session.feedback.reward >= 0.75
                      ? "Good"
                      : session.feedback.reward >= 0.25
                        ? "Okay"
                        : "Bad"}
                  </Text>
                </View>
              </View>

              {session.feedback.feedback_reason ? (
                <Text style={styles.feedbackNote}>
                  Initial note: "{session.feedback.feedback_reason}"
                </Text>
              ) : null}

              {session.review ? (
                <View style={styles.reviewSummary}>
                  <Text style={styles.reviewTitle}>Follow-up review</Text>
                  <Text style={styles.reviewText}>
                    Reaction: {session.review.partner_reaction.replace("_", " ")} · Energy{" "}
                    {session.review.emotion_before} → {session.review.emotion_after} ·{" "}
                    {session.review.would_use_again ? "Would use again" : "Would not use again"}
                  </Text>
                </View>
              ) : (
                <Text style={styles.pendingReview}>Follow-up review still pending</Text>
              )}
            </>
          ) : (
            <Text style={styles.noFeedback}>No feedback yet</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function StatusChip({
  label,
  tone,
  colors: c,
}: {
  label: string;
  tone: "positive" | "warning" | "neutral";
  colors: ThemeColors;
}) {
  const backgroundColor =
    tone === "positive" ? c.tealLight : tone === "warning" ? c.orangeLight : c.gray100;
  const color = tone === "positive" ? c.teal : tone === "warning" ? c.orange : c.textTertiary;

  return (
    <View style={[stylesStatic.statusChip, { backgroundColor }]}>
      <Text style={[stylesStatic.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

function Tag({
  label,
  highlight = false,
  colors: c,
}: {
  label: string;
  highlight?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        stylesStatic.tag,
        {
          borderColor: highlight ? c.orange : c.border,
          backgroundColor: highlight ? c.orangeLight : c.card,
        },
      ]}
    >
      <Text
        style={[
          stylesStatic.tagText,
          { color: highlight ? c.orange : c.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: font.sm + 1,
    fontWeight: font.semibold,
  },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
  },
  statusChipText: {
    fontSize: font.xs + 1,
    fontWeight: font.bold,
  },
});

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

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: font.lg + 1, fontWeight: font.bold, color: c.text },
    emptySubtext: { fontSize: font.md, color: c.textTertiary },

    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: spacing.cardPad,
      gap: 10,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dateText: { fontSize: font.sm + 1, color: c.textTertiary },
    intentBadge: {
      backgroundColor: c.btnPrimary,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radii.pill,
    },
    intentBadgeText: { color: c.btnPrimaryText, fontSize: font.sm, fontWeight: font.bold },

    row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

    actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionLabel: { fontSize: font.sm + 1, color: c.textTertiary, fontWeight: font.bold },
    actionTitle: { fontSize: font.md, fontWeight: font.bold, color: c.text },
    statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

    feedbackRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    feedbackLabel: { fontSize: font.sm, color: c.textTertiary, fontWeight: font.semibold },
    feedbackAction: { fontSize: font.sm + 1, fontWeight: font.semibold, color: c.text, flex: 1 },
    rewardBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radii.pill },
    feedbackNote: { fontSize: font.sm, color: c.textSecondary, lineHeight: 18 },
    reviewSummary: { borderRadius: radii.lg, backgroundColor: c.gray100, padding: spacing.sm, gap: 4 },
    reviewTitle: { fontSize: font.sm, fontWeight: font.extrabold, color: c.text },
    reviewText: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 18 },
    pendingReview: { fontSize: font.sm, color: c.orange, fontWeight: font.semibold },
    noFeedback: { fontSize: font.sm, color: c.textTertiary, fontStyle: "italic" },
  });
}
