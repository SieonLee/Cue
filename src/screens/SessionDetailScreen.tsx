import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { db } from "../db/db";
import type { CoachContext } from "../types/models";
import type { ActionId } from "../coach/actions";
import { ACTIONS } from "../coach/actions";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "SessionDetail">;

type SessionRow = {
  id: string;
  created_at: number;
  context_json: string;
  ranked_json: string;
};

type FeedbackRow = {
  chosen_action: string;
  reward: number;
  feedback_reason: string | null;
};

type ReviewRow = {
  partner_reaction: string;
  emotion_before: number;
  emotion_after: number;
  what_worked: string | null;
  what_to_change: string | null;
  would_use_again: number;
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
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rewardLabel(reward: number): "Good" | "Okay" | "Bad" {
  if (reward >= 0.75) return "Good";
  if (reward >= 0.25) return "Okay";
  return "Bad";
}

export function SessionDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);
  const { sessionId } = route.params;

  const session = db.getFirstSync<SessionRow>(
    "SELECT id, created_at, context_json, ranked_json FROM coach_sessions WHERE id = ?",
    [sessionId]
  );

  if (!session) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Session not found</Text>
        <Text style={styles.emptyText}>This session may have been deleted from local history.</Text>
      </View>
    );
  }

  const context = JSON.parse(session.context_json) as CoachContext;
  const ranked = JSON.parse(session.ranked_json) as ActionId[];
  const feedback = db.getFirstSync<FeedbackRow>(
    "SELECT chosen_action, reward, feedback_reason FROM feedback WHERE session_id = ?",
    [sessionId]
  );
  const review = db.getFirstSync<ReviewRow>(
    `SELECT partner_reaction, emotion_before, emotion_after, what_worked, what_to_change, would_use_again
     FROM outcome_reviews WHERE session_id = ?`,
    [sessionId]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Session detail</Text>
      <Text style={styles.subtitle}>{formatDate(session.created_at)}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Context</Text>
        <View style={styles.tagRow}>
          <Tag label={INTENT_LABEL[context.intent] ?? context.intent} colors={colors} />
          <Tag label={context.stage} colors={colors} />
          <Tag label={context.channel} colors={colors} />
          {context.urgency === 1 && <Tag label="Urgent" highlight colors={colors} />}
          {context.tiredFlag === 1 && <Tag label="Tired" highlight colors={colors} />}
        </View>
        <Text style={styles.contextText}>
          Preferences used: {context.prefText ? "text-friendly" : "open format"},{" "}
          {context.prefYesNo ? "simple prompts" : "broader prompts"}, tone {context.tone}.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recommendation</Text>
        {ranked.slice(0, 3).map((actionId, index) => (
          <View key={actionId} style={styles.rankRow}>
            <Text style={styles.rankIndex}>#{index + 1}</Text>
            <View style={styles.rankBody}>
              <Text style={styles.rankTitle}>{ACTIONS[actionId]?.title ?? actionId}</Text>
              <Text style={styles.rankText}>{ACTIONS[actionId]?.description ?? ""}</Text>
            </View>
          </View>
        ))}
      </View>

      {feedback ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feedback</Text>
          <View style={styles.feedbackHeader}>
            <Text style={styles.rankTitle}>
              {ACTIONS[feedback.chosen_action as ActionId]?.title ?? feedback.chosen_action}
            </Text>
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardText}>{rewardLabel(feedback.reward)}</Text>
            </View>
          </View>
          {feedback.feedback_reason ? (
            <Text style={styles.contextText}>Initial note: "{feedback.feedback_reason}"</Text>
          ) : (
            <Text style={styles.contextText}>No quick note was saved with the first feedback.</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feedback</Text>
          <Text style={styles.contextText}>No feedback saved for this session yet.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Follow-up review</Text>
        {review ? (
          <>
            <Text style={styles.contextText}>
              Reaction: {review.partner_reaction.replace("_", " ")} · Energy {review.emotion_before} → {review.emotion_after} ·{" "}
              {review.would_use_again ? "Would use again" : "Would not use again"}
            </Text>
            {review.what_worked ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>What worked</Text>
                <Text style={styles.noteText}>{review.what_worked}</Text>
              </View>
            ) : null}
            {review.what_to_change ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>What to change</Text>
                <Text style={styles.noteText}>{review.what_to_change}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.contextText}>No follow-up review yet. This session is still waiting for a deeper outcome check.</Text>
        )}
      </View>
    </ScrollView>
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
      <Text style={[stylesStatic.tagText, { color: highlight ? c.orange : c.textSecondary }]}>
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
    subtitle: { fontSize: font.md, color: c.textSecondary },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: spacing.cardPad,
      gap: 10,
    },
    cardTitle: { fontSize: font.md, fontWeight: font.extrabold, color: c.text },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    contextText: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 20 },
    rankRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    rankIndex: { fontSize: font.sm, fontWeight: font.extrabold, color: c.textTertiary, paddingTop: 2 },
    rankBody: { flex: 1, gap: 2 },
    rankTitle: { fontSize: font.md, fontWeight: font.bold, color: c.text },
    rankText: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 18 },
    feedbackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    rewardBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: c.gray100 },
    rewardText: { fontSize: font.sm, fontWeight: font.bold, color: c.text },
    noteBlock: { borderRadius: radii.lg, backgroundColor: c.gray100, padding: spacing.sm, gap: 4 },
    noteLabel: { fontSize: font.sm, fontWeight: font.extrabold, color: c.text },
    noteText: { fontSize: font.sm + 1, color: c.textSecondary, lineHeight: 18 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyTitle: { fontSize: font.lg + 2, fontWeight: font.bold, color: c.text },
    emptyText: { fontSize: font.md, color: c.textTertiary, textAlign: "center" },
  });
}
