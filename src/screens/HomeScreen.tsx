import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useProfile } from "../context/ProfileContext";
import { useSensoryStyles } from "../hooks/useSensoryStyles";
import { useTheme } from "../theme";
import type { ThemeColors } from "../theme";
import { getSetting } from "../db/sessions";
import { db } from "../db/db";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";
import { getDailyLoop, setMorningGoal, getCoupleFingerprint } from "../db/signals";
import type { FingerprintInsight } from "../db/signals";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const MICRO_GOALS = [
  { id: "g1",  text: "Express one specific appreciation to your partner", cat: "appreciation" },
  { id: "g2",  text: "Ask a Yes/No check-in before starting a topic", cat: "connection" },
  { id: "g3",  text: "Summarize your main point in two sentences", cat: "clarity" },
  { id: "g4",  text: "Offer your partner a choice instead of deciding alone", cat: "autonomy" },
  { id: "g5",  text: "Make one clear request instead of hinting", cat: "clarity" },
  { id: "g6",  text: "Take a timeout if energy drops below 4/10", cat: "self-care" },
  { id: "g7",  text: "Mirror back what your partner says before responding", cat: "listening" },
  { id: "g8",  text: "Use an 'I feel ___' statement instead of 'You always ___'", cat: "expression" },
  { id: "g9",  text: "Schedule a specific time for an important conversation", cat: "structure" },
  { id: "g10", text: "Share your energy level (1-10) before talking", cat: "awareness" },
  { id: "g11", text: "Start a difficult topic with something positive first", cat: "connection" },
  { id: "g12", text: "Write down your thoughts before a conversation", cat: "clarity" },
  { id: "g13", text: "Focus on 'next time' instead of 'what went wrong'", cat: "forward" },
  { id: "g14", text: "Validate your partner's point before sharing yours", cat: "listening" },
  { id: "g15", text: "Recall one recent conversation that went well", cat: "positive" },
  { id: "g16", text: "Keep today's conversations to one topic each", cat: "structure" },
  { id: "g17", text: "Acknowledge one thing your partner did right today", cat: "appreciation" },
  { id: "g18", text: "If a conversation escalates, pause for 15 minutes", cat: "self-care" },
  { id: "g19", text: "End your next conversation with one clear next step", cat: "closure" },
  { id: "g20", text: "Send a short text summary instead of a long explanation", cat: "clarity" },
  { id: "g21", text: "Ask 'Is now a good time?' before starting a topic", cat: "connection" },
  { id: "g22", text: "Replace one complaint with a request today", cat: "expression" },
  { id: "g23", text: "Take a short walk together instead of talking at home", cat: "sensory" },
  { id: "g24", text: "Let your partner finish speaking before responding", cat: "listening" },
  { id: "g25", text: "Share something you're grateful for at end of today", cat: "appreciation" },
  { id: "g26", text: "If energy is low, suggest texting instead of talking", cat: "self-care" },
  { id: "g27", text: "Avoid using 'always' and 'never' in conversations", cat: "clarity" },
  { id: "g28", text: "Restate one boundary without blame", cat: "boundary" },
  { id: "g29", text: "Give your partner two options to choose from", cat: "autonomy" },
  { id: "g30", text: "Thank your partner for listening, even after a hard talk", cat: "positive" },
];

function getTodayGoal() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return MICRO_GOALS[dayIndex % MICRO_GOALS.length];
}

const DAILY_TIPS = [
  "Ask one question at a time. Fewer questions = lower pressure.",
  "Yes/No questions are easier to answer than open-ended ones.",
  "A timeout is not avoidance\u2014it protects the conversation.",
  "State facts, not interpretations. \u2018You were late\u2019 > \u2018You don\u2019t care.\u2019",
  "One request per conversation. More than one gets lost.",
  "Offer a choice when possible. It restores a sense of control.",
  "Check in before launching into a topic: \u2018Is now okay?\u2019",
  "Specific appreciation lands better than generic thanks.",
  "Restating a boundary is not a complaint\u2014it\u2019s information.",
  "A short text summary after a hard talk prevents misunderstanding.",
  "Separate the person from the behavior when making a request.",
  "If energy is low, texting > calling > in-person.",
  "Mirror back what you heard before responding.",
  "How you start a conversation predicts how it ends.",
  "Validation doesn\u2019t mean agreement\u2014it means acknowledgment.",
  "Writing thoughts down first helps organize them.",
  "Focus on \u2018next time\u2019 instead of replaying the past.",
  "Naming your energy level (1-10) prevents misunderstandings.",
  "One concrete next step is better than vague promises.",
  "Changing locations can break a negative communication cycle.",
  "Sarcasm registers as hostility even when you don\u2019t mean it.",
  "Timing matters: a good message at a bad time still fails.",
  "Your partner\u2019s silence might mean processing, not ignoring.",
  "Gratitude after a hard conversation reinforces repair.",
  "Low energy \u2260 low interest. Name it and it loses its power.",
  "Asking \u2018what do you need?\u2019 beats guessing.",
  "Two sentences is the max for a text about something serious.",
  "A 15-minute pause feels long but saves hours of conflict.",
  "Replace \u2018you always\u2019 with \u2018I noticed that sometimes...\u2019",
  "End the day with one positive observation about your partner.",
];

function getDailyTip() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return DAILY_TIPS[dayIndex % DAILY_TIPS.length];
}

type DashboardData = {
  streak: number;
  totalSessions: number;
  pendingReviews: number;
  topAction: { id: ActionId; title: string; avgReward: number } | null;
  lessonsCompleted: number;
  fingerprint: FingerprintInsight;
};

function loadDashboard(): DashboardData {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const row = db.getFirstSync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM feedback WHERE date(created_at / 1000, 'unixepoch') = ?", [key]
    );
    if ((row?.cnt ?? 0) > 0) streak++; else break;
  }

  const totalSessions = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM feedback")?.cnt ?? 0;
  const pendingReviews = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM feedback f LEFT JOIN outcome_reviews o ON o.session_id = f.session_id WHERE o.id IS NULL`
  )?.cnt ?? 0;

  type AR = { chosen_action: string; avg_r: number };
  const topActions = db.getAllSync<AR>(
    "SELECT chosen_action, AVG(reward) as avg_r FROM feedback GROUP BY chosen_action HAVING COUNT(*) >= 2 ORDER BY avg_r DESC LIMIT 1"
  );
  const topAction = topActions.length > 0
    ? { id: topActions[0].chosen_action as ActionId, title: ACTIONS[topActions[0].chosen_action as ActionId]?.title ?? topActions[0].chosen_action, avgReward: topActions[0].avg_r }
    : null;

  const lessonsCompleted = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM lesson_progress WHERE completed = 1")?.cnt ?? 0;

  let fingerprint: FingerprintInsight = { bestHour: null, bestChannel: null, bestAction: null, avgRewardByHour: {}, avgRewardByChannel: {} };
  try { fingerprint = getCoupleFingerprint(); } catch { /* */ }

  return { streak, totalSessions, pendingReviews, topAction, lessonsCompleted, fingerprint };
}

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const tip = getDailyTip();
  const todayGoal = getTodayGoal();
  const { activeProfile, setActiveProfile } = useProfile();
  const { ls, lsStyles } = useSensoryStyles();
  const profileAName = getSetting("myName") || "Me (A)";
  const profileBName = getSetting("partnerName") || "Partner (B)";
  const emptyFP: FingerprintInsight = { bestHour: null, bestChannel: null, bestAction: null, avgRewardByHour: {}, avgRewardByChannel: {} };
  const [data, setData] = useState<DashboardData>({ streak: 0, totalSessions: 0, pendingReviews: 0, topAction: null, lessonsCompleted: 0, fingerprint: emptyFP });
  const [dailyLoop, setDailyLoop] = useState({ goalId: null as string | null, checkinDone: false });
  const [goalAccepted, setGoalAccepted] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const st = useMemo(() => themedStyles(colors), [colors]);

  useFocusEffect(useCallback(() => {
    setData(loadDashboard());
    try { const dl = getDailyLoop(); setDailyLoop({ goalId: dl.goalId, checkinDone: dl.checkinDone }); } catch { /* */ }
  }, []));

  const isEvening = new Date().getHours() >= 18;
  const showEveningCheckin = isEvening && !dailyLoop.checkinDone;

  return (
    <ScrollView contentContainerStyle={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.brand}>Cue</Text>
        {!ls && <Text style={st.tagline}>Adaptive communication coach</Text>}
      </View>

      {/* Profile */}
      <View style={st.profileRow}>
        {(["A", "B"] as const).map((p) => (
          <Pressable key={p} onPress={() => setActiveProfile(p)}
            style={[st.profileBtn, activeProfile === p && st.profileBtnActive]}
            accessibilityRole="button" accessibilityLabel={p === "A" ? profileAName : profileBName}>
            <Text style={[st.profileBtnText, activeProfile === p && st.profileBtnTextActive]}>
              {p === "A" ? profileAName : profileBName}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats */}
      <View style={st.statsRow}>
        {[
          { v: data.streak, l: "streak" },
          { v: data.totalSessions, l: "sessions" },
          { v: `${data.lessonsCompleted}/8`, l: "lessons" },
          { v: "20", l: "actions" },
        ].map((s) => (
          <View key={s.l} style={st.statBox}>
            <Text style={st.statVal}>{s.v}</Text>
            <Text style={st.statLbl}>{s.l}</Text>
          </View>
        ))}
      </View>

      {/* Daily goal card */}
      {!dailyLoop.goalId && !goalAccepted && (
        <View style={[st.goalCard, ls && lsStyles?.accentCard]}>
          <Text style={st.goalLabel}>Today's micro-goal</Text>
          <Text style={st.goalText}>{todayGoal.text}</Text>
          <View style={st.goalTagRow}>
            <View style={st.goalTag}><Text style={st.goalTagText}>{todayGoal.cat}</Text></View>
          </View>
          <Pressable style={st.goalBtn} onPress={() => { setMorningGoal(todayGoal.id); setGoalAccepted(true); }}
            accessibilityRole="button" accessibilityLabel="Accept today's micro goal">
            <Text style={st.goalBtnText}>Accept goal</Text>
          </Pressable>
        </View>
      )}
      {(dailyLoop.goalId || goalAccepted) && (
        <View style={st.goalActiveCard}>
          <Text style={st.goalActiveLabel}>{dailyLoop.checkinDone ? "Goal complete" : "Goal in progress"}</Text>
          <Text style={st.goalActiveText}>{todayGoal.text}</Text>
          {showEveningCheckin && (
            <Pressable style={st.checkinBtn} onPress={() => navigation.navigate("EveningCheckIn")}
              accessibilityRole="button" accessibilityLabel="Complete evening check-in">
              <Text style={st.checkinBtnText}>Evening check-in {"\u2192"}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Nudge */}
      {data.pendingReviews > 0 && (
        <Pressable style={st.nudgeCard} onPress={() => navigation.navigate("Review")}
          accessibilityRole="button" accessibilityLabel={`${data.pendingReviews} sessions to review`}>
          <Text style={{ fontSize: 20 }}>{"\uD83D\uDCDD"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.nudgeTitle}>{data.pendingReviews} to review</Text>
            <Text style={st.nudgeDesc}>Feedback trains the model.</Text>
          </View>
          <Text style={{ fontSize: 20, opacity: 0.3 }}>{"\u203A"}</Text>
        </Pressable>
      )}

      {/* Pattern / best action */}
      {data.fingerprint.bestAction && (
        <View style={st.fpCard}>
          <Text style={st.fpLabel}>What seems to work best</Text>
          <Text style={st.fpText}>
            Best: <Text style={{ fontWeight: "800" }}>{ACTIONS[data.fingerprint.bestAction as ActionId]?.title ?? data.fingerprint.bestAction}</Text>
            {data.fingerprint.bestChannel ? ` via ${data.fingerprint.bestChannel}` : ""}
            {data.fingerprint.bestHour !== null ? ` around ${data.fingerprint.bestHour}:00` : ""}
          </Text>
        </View>
      )}
      {data.topAction && !data.fingerprint.bestAction && (
        <View style={st.insightCard}>
          <Text style={st.insightLabel}>Best action so far</Text>
          <Text style={st.insightVal}>{data.topAction.title}</Text>
          <Text style={st.insightDesc}>{Math.round(data.topAction.avgReward * 100)}% success</Text>
        </View>
      )}

      {/* CTAs */}
      <Pressable style={[st.primaryBtn, ls && lsStyles?.primaryBtn]} onPress={() => navigation.navigate("Coach")}
        accessibilityRole="button" accessibilityLabel="Start a new coaching session">
        <Text style={st.primaryBtnText}>Start coaching session</Text>
      </Pressable>
      {/* Tip */}
      <View style={st.tipCard}>
        <Text style={st.tipLabel}>TIP #{(Math.floor(Date.now() / 86_400_000) % DAILY_TIPS.length) + 1} OF {DAILY_TIPS.length}</Text>
        <Text style={st.tipText}>{tip}</Text>
      </View>

      {/* Main nav */}
      {([
        { label: "ESSENTIALS", btns: [
          { icon: "\uD83C\uDFAF", label: "Coach", nav: "Coach" as const },
          { icon: "\uD83C\uDCCF", label: "Daily card", nav: "DailyCard" as const },
          { icon: "\uD83E\uDDD8", label: "Readiness", nav: "CheckIn" as const },
        ]},
        { label: "REAL-TIME", btns: [
          { icon: "\u26A1", label: "Live Coach", nav: "LiveCoach" as const },
          { icon: "\uD83C\uDD98", label: "First Aid", nav: "Emergency" as const },
          { icon: "\uD83D\uDD01", label: "Replay", nav: "Replay" as const },
        ]},
        { label: "TRACK", btns: [
          { icon: "\uD83D\uDD0D", label: "Patterns", nav: "Patterns" as const },
          { icon: "\uD83D\uDCCA", label: "Weekly", nav: "WeeklyReport" as const },
          { icon: "\uD83D\uDCC8", label: "Health", nav: "HealthScore" as const },
        ]},
      ]).map((section) => (
        <React.Fragment key={section.label}>
          <Text style={[st.sectionLabel, ls && lsStyles?.sectionLabel]}>{section.label}</Text>
          <View style={st.btnRow}>
            {section.btns.map((b) => (
              <Pressable key={b.nav} style={[st.navBtn, ls && lsStyles?.navBtn]} onPress={() => navigation.navigate(b.nav)}
                accessibilityRole="button" accessibilityLabel={b.label}>
                <Text style={[st.navIcon, ls && lsStyles?.emoji]}>{b.icon}</Text>
                <Text style={st.navText}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </React.Fragment>
      ))}

      {/* More toggle */}
      <Pressable style={st.moreToggle} onPress={() => setShowMore(!showMore)}
        accessibilityRole="button" accessibilityLabel={showMore ? "Show fewer features" : "Show more features"}>
        <Text style={st.moreToggleText}>{showMore ? "Show less" : "More features"} {showMore ? "\u25B2" : "\u25BC"}</Text>
      </Pressable>

      {showMore && ([
        { label: "LEARN", btns: [
          { icon: "\uD83C\uDFAF", label: "Goals", nav: "Goals" as const },
          { icon: "\uD83D\uDCDA", label: "Lessons", nav: "Lessons" as const },
          { icon: "\uD83C\uDFC5", label: "Milestones", nav: "Milestones" as const },
        ]},
        { label: "ANALYZE", btns: [
          { icon: "\uD83D\uDD25", label: "Streaks", nav: "Streak" as const },
          { icon: "\uD83E\uDDE9", label: "Alignment", nav: "Alignment" as const },
          { icon: "\uD83C\uDFAF", label: "Radar", nav: "ConflictRadar" as const },
        ]},
        { label: "DATA SCIENCE", btns: [
          { icon: "\uD83C\uDFB2", label: "Bandit", nav: "Stats" as const },
          { icon: "\uD83E\uDDEC", label: "Model", nav: "ModelHistory" as const },
        ]},
        { label: "MORE", btns: [
          { icon: "\uD83D\uDD2E", label: "What-If", nav: "WhatIf" as const },
          { icon: "\uD83D\uDCAC", label: "Async", nav: "Async" as const },
          { icon: "\uD83D\uDCCB", label: "History", nav: "History" as const },
        ]},
        { label: "STATISTICS", btns: [
          { icon: "\uD83D\uDCC8", label: "Statistics", nav: "Statistics" as const },
        ]},
      ]).map((section) => (
        <React.Fragment key={section.label}>
          <Text style={[st.sectionLabel, ls && lsStyles?.sectionLabel]}>{section.label}</Text>
          <View style={st.btnRow}>
            {section.btns.map((b) => (
              <Pressable key={b.nav} style={[st.navBtn, ls && lsStyles?.navBtn]} onPress={() => navigation.navigate(b.nav)}
                accessibilityRole="button" accessibilityLabel={b.label}>
                <Text style={[st.navIcon, ls && lsStyles?.emoji]}>{b.icon}</Text>
                <Text style={st.navText}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </React.Fragment>
      ))}

      <Pressable style={st.settingsBtn} onPress={() => navigation.navigate("Settings")}
        accessibilityRole="button" accessibilityLabel="Open settings">
        <Text style={st.settingsBtnText}>{"\u2699\uFE0F"} Settings</Text>
      </Pressable>

      <Text style={st.footer}>Cue {"\u2014"} Bayesian adaptive coaching {"\u00B7"} 20 actions {"\u00B7"} on-device</Text>
    </ScrollView>
  );
}

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { padding: 18, gap: 12, paddingBottom: 40 },
    header: { marginBottom: 2 },
    brand: { fontSize: 30, fontWeight: "900", letterSpacing: -1, color: c.text },
    tagline: { fontSize: 12, fontWeight: "600", marginTop: -2, color: c.textTertiary },

    profileRow: { flexDirection: "row", gap: 8 },
    profileBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: c.border, backgroundColor: "transparent", alignItems: "center" },
    profileBtnActive: { backgroundColor: c.btnPrimary, borderColor: c.btnPrimary },
    profileBtnText: { fontWeight: "700", fontSize: 13, color: c.text },
    profileBtnTextActive: { color: c.btnPrimaryText },

    statsRow: { flexDirection: "row", gap: 6 },
    statBox: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: c.gray100 },
    statVal: { fontSize: 17, fontWeight: "800", color: c.text },
    statLbl: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", color: c.textTertiary },

    goalCard: { borderWidth: 2, borderColor: c.tealBorder, borderRadius: 16, padding: 16, gap: 8, backgroundColor: c.tealLight },
    goalLabel: { fontSize: 10, fontWeight: "800", color: c.teal, letterSpacing: 1 },
    goalText: { fontSize: 15, fontWeight: "700", lineHeight: 22, color: c.text },
    goalTagRow: { flexDirection: "row" },
    goalTag: { backgroundColor: c.teal, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
    goalTagText: { color: "white", fontSize: 10, fontWeight: "800" },
    goalBtn: { backgroundColor: c.btnPrimary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 2 },
    goalBtnText: { color: c.btnPrimaryText, fontWeight: "700" },

    goalActiveCard: { borderWidth: 1.5, borderColor: c.tealBorder, borderRadius: 14, padding: 14, gap: 6, backgroundColor: c.tealLight },
    goalActiveLabel: { fontSize: 10, fontWeight: "800", color: c.teal, letterSpacing: 1 },
    goalActiveText: { fontSize: 14, fontWeight: "600", lineHeight: 20, color: c.text },
    checkinBtn: { backgroundColor: c.tealDark, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 2 },
    checkinBtnText: { color: "white", fontWeight: "700", fontSize: 13 },

    nudgeCard: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderColor: c.orange, borderRadius: 14, padding: 12, backgroundColor: c.orangeLight },
    nudgeTitle: { fontSize: 13, fontWeight: "700", color: c.red },
    nudgeDesc: { fontSize: 11, opacity: 0.6 },

    fpCard: { borderWidth: 1.5, borderColor: c.blue, borderRadius: 14, padding: 14, gap: 4, backgroundColor: c.blueLight },
    fpLabel: { fontSize: 10, fontWeight: "800", color: c.blue, letterSpacing: 1 },
    fpText: { fontSize: 13, lineHeight: 20, color: c.text },

    insightCard: { borderWidth: 1, borderColor: c.tealBorder, borderRadius: 14, padding: 12, gap: 2, backgroundColor: c.tealLight },
    insightLabel: { fontSize: 10, fontWeight: "800", color: c.teal, letterSpacing: 1 },
    insightVal: { fontSize: 16, fontWeight: "800", color: c.text },
    insightDesc: { fontSize: 12, opacity: 0.6 },

    primaryBtn: { paddingVertical: 16, borderRadius: 14, backgroundColor: c.btnPrimary, alignItems: "center" },
    primaryBtnText: { color: c.btnPrimaryText, fontWeight: "700", fontSize: 16 },

    tipCard: { borderRadius: 14, padding: 14, gap: 4, backgroundColor: c.gray100 },
    tipLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: c.textTertiary },
    tipText: { fontSize: 13, lineHeight: 20, color: c.text },

    sectionLabel: { fontSize: 10, fontWeight: "800", color: c.gray500, letterSpacing: 1.2, marginTop: 6 },
    btnRow: { flexDirection: "row", gap: 8 },
    navBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", gap: 3, backgroundColor: c.gray100 },
    navIcon: { fontSize: 20 },
    navText: { fontWeight: "600", fontSize: 11, color: c.textSecondary },

    moreToggle: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    moreToggleText: { fontWeight: "600", fontSize: 13, color: c.textTertiary },

    settingsBtn: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: "center" },
    settingsBtnText: { fontWeight: "600", fontSize: 13, color: c.text },

    footer: { marginTop: 8, fontSize: 10, textAlign: "center", fontWeight: "500", color: c.textTertiary },
  });
}
