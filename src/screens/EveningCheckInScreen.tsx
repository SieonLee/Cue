import React, { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { completeEveningCheckin, getDailyLoop, recordSignal } from "../db/signals";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { font, spacing, radii } from "../theme/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "EveningCheckIn">;

type Step = "conversation" | "how" | "noConvo" | "goal" | "done";
type Went = "well" | "mixed" | "difficult";
type GoalProgress = "yes" | "partly" | "no";

export function EveningCheckInScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => themedStyles(colors), [colors]);
  const loop = useMemo(() => getDailyLoop(), []);

  const [step, setStep] = useState<Step>("conversation");
  const [hadConversation, setHadConversation] = useState(false);
  const [went, setWent] = useState<Went | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null);

  function onConversation(yes: boolean) {
    setHadConversation(yes);
    setStep(yes ? "how" : "noConvo");
  }

  function onHow(w: Went) {
    setWent(w);
    setStep(loop.goalId ? "goal" : "done");
  }

  function onNoConvoContinue() {
    setStep(loop.goalId ? "goal" : "done");
  }

  function onGoal(p: GoalProgress) {
    setGoalProgress(p);
    setStep("done");
  }

  function onDone() {
    const wentValue = hadConversation ? went : null;
    completeEveningCheckin(hadConversation, wentValue);
    recordSignal(null, "daily_checkin");
    navigation.navigate("Home");
  }

  const wentLabel: Record<Went, string> = {
    well: "Went well",
    mixed: "Mixed",
    difficult: "Difficult",
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.title}>Evening Check-In</Text>

      {step === "conversation" && (
        <View style={s.card}>
          <Text style={s.question}>
            Did you have a conversation with your partner today?
          </Text>
          <View style={s.btnRow}>
            <Pressable style={s.choiceBtn} onPress={() => onConversation(true)}>
              <Text style={s.choiceBtnText}>Yes</Text>
            </Pressable>
            <Pressable style={s.choiceBtnOutline} onPress={() => onConversation(false)}>
              <Text style={s.choiceBtnOutlineText}>No</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "how" && (
        <View style={s.card}>
          <Text style={s.question}>How did it go?</Text>
          <View style={s.optionCol}>
            {(["well", "mixed", "difficult"] as const).map((w) => (
              <Pressable key={w} style={s.optionBtn} onPress={() => onHow(w)}>
                <Text style={s.optionBtnText}>{wentLabel[w]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === "noConvo" && (
        <View style={s.card}>
          <Text style={s.encourageText}>
            That's okay. Not every day needs a conversation.
          </Text>
          <Pressable style={s.choiceBtn} onPress={onNoConvoContinue}>
            <Text style={s.choiceBtnText}>Continue</Text>
          </Pressable>
        </View>
      )}

      {step === "goal" && (
        <View style={s.card}>
          <Text style={s.goalLabel}>Today's goal</Text>
          <Text style={s.goalText}>{loop.goalId ?? "No goal set"}</Text>
          <Text style={s.question}>Did you work on this?</Text>
          <View style={s.optionCol}>
            {(["yes", "partly", "no"] as const).map((p) => (
              <Pressable key={p} style={s.optionBtn} onPress={() => onGoal(p)}>
                <Text style={s.optionBtnText}>
                  {p === "yes" ? "Yes" : p === "partly" ? "Partly" : "No"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === "done" && (
        <>
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Today's Summary</Text>
            <Text style={s.summaryRow}>
              Conversation: {hadConversation ? "Yes" : "No"}
              {went ? ` \u2014 ${wentLabel[went]}` : ""}
            </Text>
            {loop.goalId && (
              <Text style={s.summaryRow}>
                Goal progress: {goalProgress ?? "N/A"}
              </Text>
            )}
          </View>
          <Pressable style={s.primaryBtn} onPress={onDone}>
            <Text style={s.primaryBtnText}>Done</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    page: {
      flexGrow: 1,
      padding: spacing.page,
      gap: spacing.gap,
      paddingBottom: spacing.pageBtm,
    },
    title: {
      fontSize: font.xxl,
      fontWeight: font.bold,
      color: c.text,
      marginBottom: spacing.md,
    },
    card: {
      backgroundColor: c.gray100,
      borderRadius: radii.xl,
      padding: spacing.xxl,
      gap: spacing.lg,
    },
    question: {
      fontSize: font.xl,
      fontWeight: font.semibold,
      lineHeight: 24,
      color: c.text,
    },
    btnRow: {
      flexDirection: "row",
      gap: spacing.lg,
    },
    choiceBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: radii.xl,
      backgroundColor: c.btnPrimary,
      alignItems: "center",
    },
    choiceBtnText: {
      color: c.btnPrimaryText,
      fontWeight: font.bold,
      fontSize: font.lg,
    },
    choiceBtnOutline: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: radii.xl,
      borderWidth: 1.5,
      borderColor: c.gray400,
      alignItems: "center",
    },
    choiceBtnOutlineText: {
      fontWeight: font.bold,
      fontSize: font.lg,
      color: c.text,
    },
    optionCol: {
      gap: spacing.md,
    },
    optionBtn: {
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: c.gray300,
      alignItems: "center",
      backgroundColor: c.card,
    },
    optionBtnText: {
      fontWeight: font.semibold,
      fontSize: font.lg,
      color: c.text,
    },
    encourageText: {
      fontSize: font.xl,
      lineHeight: 24,
      color: c.teal,
      fontWeight: font.semibold,
    },
    goalLabel: {
      fontSize: font.sm,
      fontWeight: font.extrabold,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.gray600,
    },
    goalText: {
      fontSize: font.xl,
      fontWeight: font.bold,
      color: c.teal,
    },
    summaryCard: {
      backgroundColor: c.gray100,
      borderRadius: radii.xl,
      padding: spacing.xxl,
      gap: spacing.md,
    },
    summaryTitle: {
      fontSize: font.xl,
      fontWeight: font.bold,
      color: c.text,
      marginBottom: spacing.sm,
    },
    summaryRow: {
      fontSize: font.base,
      lineHeight: 20,
      color: c.gray800,
    },
    primaryBtn: {
      paddingVertical: 16,
      borderRadius: radii.xl,
      backgroundColor: c.btnPrimary,
      alignItems: "center",
    },
    primaryBtnText: {
      color: c.btnPrimaryText,
      fontWeight: font.bold,
      fontSize: font.lg,
    },
  });
}
