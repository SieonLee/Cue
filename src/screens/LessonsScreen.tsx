/**
 * LessonsScreen — Guided Learning Modules
 *
 * Structured micro-lessons on evidence-based couple communication techniques.
 * Each lesson follows a 4-step flow:
 *   1. Concept — explanation of the technique
 *   2. Example — real scenario demonstrating the technique
 *   3. Practice — interactive exercise (choose the better response)
 *   4. Takeaway — key insight + mark complete
 *
 * Lessons are grouped into modules (Foundations, De-escalation, Connection).
 * Progress is stored in the lesson_progress table.
 * Completed lessons unlock the next in sequence.
 */

import React, { useCallback, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { db } from "../db/db";

type Props = NativeStackScreenProps<RootStackParamList, "Lessons">;

// ── Lesson data ─────────────────────────────────────────────────────────────

type PracticeOption = { text: string; correct: boolean; explanation: string };

type Lesson = {
  id: string;
  module: string;
  title: string;
  concept: string;
  example: { situation: string; bad: string; good: string; why: string };
  practice: { prompt: string; options: PracticeOption[] };
  takeaway: string;
  relatedAction: string; // ActionId
};

const LESSONS: Lesson[] = [
  // ── Module 1: Foundations ──────────────────────────────────────────────
  {
    id: "L01", module: "Foundations",
    title: "The Check-In",
    concept: "Before starting a conversation about something important, check if your partner is available. This respects their emotional bandwidth and makes them more receptive.",
    example: {
      situation: "You want to discuss splitting household chores.",
      bad: "We need to talk about chores. Sit down.",
      good: "Hey, I'd like to talk about something. Is now a good time?",
      why: "The good version respects autonomy. Your partner can say 'give me 10 minutes' without it becoming a conflict.",
    },
    practice: {
      prompt: "Your partner just got home from work. You want to discuss weekend plans. What do you say?",
      options: [
        { text: "We need to figure out this weekend right now.", correct: false, explanation: "This creates urgency and pressure. Your partner hasn't had time to decompress." },
        { text: "Hey, when you're settled, can we chat about weekend plans?", correct: true, explanation: "This acknowledges their current state and gives them a choice of timing." },
        { text: "You never plan anything, so I booked something.", correct: false, explanation: "This is a criticism disguised as action. It skips the conversation entirely." },
      ],
    },
    takeaway: "A 5-second check-in ('Is now okay?') prevents 30 minutes of defensive arguing.",
    relatedAction: "A1",
  },
  {
    id: "L02", module: "Foundations",
    title: "One Request at a Time",
    concept: "When you have multiple things to address, pick the most important one. Multiple requests overwhelm your partner's working memory and make them feel attacked.",
    example: {
      situation: "You're frustrated about dishes, laundry, and taking out trash.",
      bad: "You never do the dishes, the laundry is piling up, and the trash has been sitting there for days!",
      good: "Could you help me with the dishes tonight? That would really help.",
      why: "One specific request is actionable. A list of complaints triggers defensiveness.",
    },
    practice: {
      prompt: "You're upset about several things. Your partner asks 'What's wrong?' What's the best response?",
      options: [
        { text: "Everything! You forgot the groceries, you were late, and you didn't text me back.", correct: false, explanation: "This is a complaint avalanche. Your partner will shut down or get defensive." },
        { text: "I felt worried when I didn't hear back from you today. Can we talk about texting?", correct: true, explanation: "This focuses on one specific issue with an I-statement, making it manageable." },
        { text: "Nothing, forget it.", correct: false, explanation: "Withdrawal prevents resolution and builds resentment over time." },
      ],
    },
    takeaway: "One clear request > a list of grievances. Your partner can act on one thing; they can't fix everything at once.",
    relatedAction: "A5",
  },
  {
    id: "L03", module: "Foundations",
    title: "Specific Appreciation",
    concept: "Generic praise ('you're great') fades quickly. Specific appreciation ('I noticed you made coffee this morning — that was really thoughtful') reinforces the exact behavior you want to see more of.",
    example: {
      situation: "Your partner cooked dinner after a long day.",
      bad: "Thanks for dinner.",
      good: "Thank you for cooking tonight, especially after your long day. The pasta was really good.",
      why: "Specific gratitude tells your partner exactly what you noticed and valued. It makes them feel truly seen.",
    },
    practice: {
      prompt: "Your partner picked up your favorite snack from the store without being asked. How do you respond?",
      options: [
        { text: "Oh cool, thanks.", correct: false, explanation: "Too vague. Your partner won't know what specifically you appreciated." },
        { text: "You remembered my favorite snack! That really made my day — thanks for thinking of me.", correct: true, explanation: "This names the specific action and its emotional impact, reinforcing the behavior." },
        { text: "Finally, you thought of me for once.", correct: false, explanation: "This turns a positive moment into a criticism. It punishes good behavior." },
      ],
    },
    takeaway: "The formula: [What they did] + [How it made you feel]. 'You [action] — that made me feel [emotion].'",
    relatedAction: "A8",
  },
  // ── Module 2: De-escalation ───────────────────────────────────────────
  {
    id: "L04", module: "De-escalation",
    title: "The Strategic Timeout",
    concept: "When emotions are running high (heart rate above ~100 bpm), your brain's fight-or-flight response takes over. A timeout isn't avoidance — it's protecting the conversation by letting your nervous system calm down.",
    example: {
      situation: "An argument about finances is getting heated.",
      bad: "I can't talk to you when you're like this. *walks away*",
      good: "I'm getting too heated to think clearly. Can we take 20 minutes and come back to this?",
      why: "The good version takes ownership of YOUR state (not blaming them), sets a specific time, and commits to returning.",
    },
    practice: {
      prompt: "You notice your voice getting louder during a disagreement. What do you do?",
      options: [
        { text: "Keep going — stopping means I lose the argument.", correct: false, explanation: "Conversations aren't competitions. Pushing through when flooded leads to saying things you'll regret." },
        { text: "I need to step away. Let's pick this up in 20 minutes.", correct: true, explanation: "This protects the conversation. Research shows 20-30 minutes is ideal for physiological calming." },
        { text: "Fine, whatever. *silent treatment for hours*", correct: false, explanation: "Stonewalling is one of Gottman's 'Four Horsemen' — it's more damaging than the original argument." },
      ],
    },
    takeaway: "A good timeout has 3 parts: 1) Take ownership ('I need to calm down'), 2) Set a time ('20 minutes'), 3) Commit to return ('then let's continue').",
    relatedAction: "A2",
  },
  {
    id: "L05", module: "De-escalation",
    title: "The Repair Attempt",
    concept: "Gottman's research found that the #1 predictor of relationship stability isn't avoiding conflict — it's the ability to repair after one. A repair attempt is any statement that de-escalates tension.",
    example: {
      situation: "You said something hurtful during an argument last night.",
      bad: "Well you said mean things too, so we're even.",
      good: "I'm sorry for what I said last night. I was frustrated, but that's no excuse. Next time I'll take a break before I say something I don't mean.",
      why: "A real repair has three parts: acknowledgment + ownership + concrete plan. 'We're even' dismisses both people's pain.",
    },
    practice: {
      prompt: "You forgot your partner's important work event. They're hurt. What do you say?",
      options: [
        { text: "You forget stuff too, it's not a big deal.", correct: false, explanation: "Minimizing + deflecting. This tells your partner their feelings don't matter." },
        { text: "I'm sorry I forgot. That event was important to you and I should have been there. I'm putting a shared calendar on my phone right now.", correct: true, explanation: "Acknowledgment + emotional validation + concrete action. This is a complete repair." },
        { text: "Sorry.", correct: false, explanation: "A bare 'sorry' without acknowledging what happened or what you'll change feels hollow." },
      ],
    },
    takeaway: "Repair formula: 'I'm sorry for [specific thing]. I understand it made you feel [emotion]. Here's what I'll do differently: [concrete action].'",
    relatedAction: "A6",
  },
  {
    id: "L06", module: "De-escalation",
    title: "Boundaries Without Blame",
    concept: "A boundary is information about what you need to function — not a punishment or attempt to control. When stated without blame, boundaries are easier to hear and respect.",
    example: {
      situation: "Your partner keeps checking their phone during dinner.",
      bad: "You're so rude. You care more about your phone than me.",
      good: "I'd really like our dinner time to be phone-free. It helps me feel connected to you.",
      why: "The good version states a need and its positive outcome. The bad version attacks character.",
    },
    practice: {
      prompt: "Your partner calls you multiple times during work meetings. You need to set a boundary. What do you say?",
      options: [
        { text: "Stop calling me at work! You're so clingy.", correct: false, explanation: "This is a character attack disguised as a boundary. It creates shame rather than understanding." },
        { text: "I can't answer calls during meetings, but I'll text you back on my break. Would that work?", correct: true, explanation: "This states the boundary clearly, offers an alternative, and invites collaboration." },
        { text: "I'll just put my phone on silent and not tell them.", correct: false, explanation: "Avoiding the conversation creates confusion and can feel like rejection to your partner." },
      ],
    },
    takeaway: "Good boundaries: state what you need (not what they're doing wrong) + offer an alternative when possible.",
    relatedAction: "A7",
  },
  // ── Module 3: Connection ──────────────────────────────────────────────
  {
    id: "L07", module: "Connection",
    title: "The Wrap-Up",
    concept: "When a conversation doesn't end clearly, both people are left with lingering tension and uncertainty. A clean wrap-up confirms what was agreed and sets the next step.",
    example: {
      situation: "You just had a productive talk about household responsibilities.",
      bad: "Okay, well... I guess that's that. *walks away*",
      good: "So we agreed that I'll do dishes and you'll handle laundry this week. Does that sound right to you?",
      why: "Summarizing + confirming prevents 'I thought we agreed on...' fights later.",
    },
    practice: {
      prompt: "You and your partner just discussed visiting family this holiday. How do you close the conversation?",
      options: [
        { text: "Okay, whatever you want.", correct: false, explanation: "This is passive capitulation. It breeds resentment and doesn't confirm any agreement." },
        { text: "So we'll do Thanksgiving with your family and Christmas with mine. I'll book the flights this weekend. Sound good?", correct: true, explanation: "This confirms the agreement and assigns a concrete next step with a timeline." },
        { text: "Let's just figure it out later.", correct: false, explanation: "Postponing without a plan means this conversation will happen again (and with more pressure)." },
      ],
    },
    takeaway: "End every important conversation with: 'So we agreed on [X]. I'll do [Y] by [when]. Does that work?'",
    relatedAction: "A9",
  },
  {
    id: "L08", module: "Connection",
    title: "The Text Summary",
    concept: "After a difficult in-person conversation, sending a brief text summary reduces misunderstanding. Written words are processed differently than spoken ones — they give your partner time to re-read and reflect.",
    example: {
      situation: "You just had a tough talk about spending habits.",
      bad: "*sends nothing — assumes everything was understood*",
      good: "'Hey, just wanted to recap: we'll track shared expenses this month and check in next Sunday. I appreciate you being open about this.'",
      why: "The text serves as a shared record, prevents 'you never said that' moments, and ends on an appreciative note.",
    },
    practice: {
      prompt: "After discussing your partner's job dissatisfaction, what text would you send?",
      options: [
        { text: "Hope you figure out the job thing.", correct: false, explanation: "This is dismissive and puts the burden entirely on them." },
        { text: "Thanks for sharing how you're feeling about work. I'm here to support you. Let's look at options together this weekend.", correct: true, explanation: "This validates, shows support, and creates a concrete follow-up plan." },
        { text: "*sends a long essay about what they should do*", correct: false, explanation: "A summary should be brief and collaborative, not prescriptive." },
      ],
    },
    takeaway: "A good follow-up text has: 1) Acknowledgment, 2) Key agreement or plan, 3) Positive closing.",
    relatedAction: "A3",
  },
];

const MODULES = ["Foundations", "De-escalation", "Connection"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLessonProgress(): Map<string, { completed: boolean; score: number }> {
  type Row = { lesson_id: string; completed: number; score: number };
  const rows = db.getAllSync<Row>("SELECT lesson_id, completed, score FROM lesson_progress");
  const map = new Map<string, { completed: boolean; score: number }>();
  for (const r of rows) {
    map.set(r.lesson_id, { completed: r.completed === 1, score: r.score });
  }
  return map;
}

function completeLesson(lessonId: string, score: number) {
  db.runSync(
    `INSERT INTO lesson_progress(lesson_id, completed, score, completed_at)
     VALUES(?, 1, ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET completed=1, score=MAX(score, excluded.score), completed_at=excluded.completed_at`,
    [lessonId, score, Date.now()]
  );
}

function isLessonUnlocked(lessonId: string, progress: Map<string, { completed: boolean; score: number }>): boolean {
  const idx = LESSONS.findIndex((l) => l.id === lessonId);
  if (idx === 0) return true;
  const prev = LESSONS[idx - 1];
  return progress.get(prev.id)?.completed ?? false;
}

// ── Component ───────────────────────────────────────────────────────────────

type LessonStep = "concept" | "example" | "practice" | "takeaway";

export function LessonsScreen({ navigation }: Props) {
  const [progress, setProgress] = useState<Map<string, { completed: boolean; score: number }>>(new Map());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState<LessonStep>("concept");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProgress(getLessonProgress());
    }, [])
  );

  function startLesson(lesson: Lesson) {
    setActiveLesson(lesson);
    setStep("concept");
    setSelectedAnswer(null);
    setAnswered(false);
  }

  function handleAnswer(idx: number) {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
  }

  function finishLesson() {
    if (!activeLesson) return;
    const correct = activeLesson.practice.options[selectedAnswer ?? 0]?.correct ? 1 : 0;
    completeLesson(activeLesson.id, correct);
    setProgress(getLessonProgress());
    setActiveLesson(null);
  }

  // ── Lesson detail view ──────────────────────────────────────────────────
  if (activeLesson) {
    const lesson = activeLesson;

    if (step === "concept") {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.stepLabel}>CONCEPT</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.body}>{lesson.concept}</Text>
          <Pressable style={styles.nextBtn} onPress={() => setStep("example")}>
            <Text style={styles.nextBtnText}>See an example</Text>
          </Pressable>
          <Pressable style={styles.backBtn} onPress={() => setActiveLesson(null)}>
            <Text style={styles.backBtnText}>Back to lessons</Text>
          </Pressable>
        </ScrollView>
      );
    }

    if (step === "example") {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.stepLabel}>EXAMPLE</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>

          <View style={styles.scenarioCard}>
            <Text style={styles.scenarioLabel}>SITUATION</Text>
            <Text style={styles.scenarioText}>{lesson.example.situation}</Text>
          </View>

          <View style={[styles.responseCard, styles.badResponse]}>
            <Text style={styles.responseLabel}>INSTEAD OF...</Text>
            <Text style={styles.responseText}>"{lesson.example.bad}"</Text>
          </View>

          <View style={[styles.responseCard, styles.goodResponse]}>
            <Text style={styles.responseLabel}>TRY THIS</Text>
            <Text style={styles.responseText}>"{lesson.example.good}"</Text>
          </View>

          <View style={styles.whyCard}>
            <Text style={styles.whyLabel}>WHY IT WORKS</Text>
            <Text style={styles.whyText}>{lesson.example.why}</Text>
          </View>

          <Pressable style={styles.nextBtn} onPress={() => { setStep("practice"); setSelectedAnswer(null); setAnswered(false); }}>
            <Text style={styles.nextBtnText}>Practice it</Text>
          </Pressable>
        </ScrollView>
      );
    }

    if (step === "practice") {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.stepLabel}>PRACTICE</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>

          <View style={styles.scenarioCard}>
            <Text style={styles.scenarioText}>{lesson.practice.prompt}</Text>
          </View>

          {lesson.practice.options.map((opt, idx) => {
            const isSelected = selectedAnswer === idx;
            const showResult = answered && isSelected;
            return (
              <Pressable
                key={idx}
                style={[
                  styles.optionCard,
                  isSelected && (opt.correct ? styles.optionCorrect : styles.optionWrong),
                ]}
                onPress={() => handleAnswer(idx)}
              >
                <Text style={styles.optionText}>"{opt.text}"</Text>
                {showResult && (
                  <Text style={[styles.optionFeedback, opt.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
                    {opt.correct ? "Correct! " : "Not quite. "}{opt.explanation}
                  </Text>
                )}
              </Pressable>
            );
          })}

          {answered && (
            <Pressable style={styles.nextBtn} onPress={() => setStep("takeaway")}>
              <Text style={styles.nextBtnText}>See takeaway</Text>
            </Pressable>
          )}
        </ScrollView>
      );
    }

    if (step === "takeaway") {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.stepLabel}>TAKEAWAY</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>

          <View style={styles.takeawayCard}>
            <Text style={styles.takeawayText}>{lesson.takeaway}</Text>
          </View>

          <Text style={styles.relatedText}>
            Related action: {lesson.relatedAction} — Try using it in your next coaching session!
          </Text>

          <Pressable style={styles.nextBtn} onPress={finishLesson}>
            <Text style={styles.nextBtnText}>Complete lesson</Text>
          </Pressable>
        </ScrollView>
      );
    }
  }

  // ── Module list view ──────────────────────────────────────────────────────
  const totalCompleted = Array.from(progress.values()).filter((v) => v.completed).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Guided Lessons</Text>
      <Text style={styles.pageSubtitle}>
        Evidence-based communication techniques. Complete lessons in order to unlock the next.
      </Text>

      <View style={styles.overallProgress}>
        <Text style={styles.overallText}>
          {totalCompleted} / {LESSONS.length} completed
        </Text>
        <View style={styles.overallTrack}>
          <View style={[styles.overallFill, { width: `${Math.round((totalCompleted / LESSONS.length) * 100)}%` as any }]} />
        </View>
      </View>

      {MODULES.map((mod) => {
        const moduleLessons = LESSONS.filter((l) => l.module === mod);
        const moduleCompleted = moduleLessons.filter((l) => progress.get(l.id)?.completed).length;
        return (
          <View key={mod} style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Text style={styles.moduleName}>{mod}</Text>
              <Text style={styles.moduleCount}>{moduleCompleted}/{moduleLessons.length}</Text>
            </View>
            {moduleLessons.map((lesson) => {
              const p = progress.get(lesson.id);
              const unlocked = isLessonUnlocked(lesson.id, progress);
              const completed = p?.completed ?? false;
              return (
                <Pressable
                  key={lesson.id}
                  style={[styles.lessonRow, !unlocked && styles.lessonLocked]}
                  onPress={() => unlocked && startLesson(lesson)}
                  disabled={!unlocked}
                >
                  <Text style={styles.lessonIcon}>
                    {completed ? "\u2705" : unlocked ? "\u25B6\uFE0F" : "\uD83D\uDD12"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lessonName, !unlocked && styles.lessonNameLocked]}>
                      {lesson.title}
                    </Text>
                    {completed && p?.score === 1 && (
                      <Text style={styles.lessonPerfect}>Perfect score</Text>
                    )}
                  </View>
                  <Text style={styles.lessonAction}>{lesson.relatedAction}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}

      <Text style={styles.note}>
        Each lesson teaches one technique with a real example and practice exercise.
      </Text>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },

  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 14, opacity: 0.7, lineHeight: 20 },

  overallProgress: { gap: 6 },
  overallText: { fontSize: 13, fontWeight: "600", opacity: 0.7 },
  overallTrack: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 999, overflow: "hidden" },
  overallFill: { height: "100%", backgroundColor: "#2a9d8f", borderRadius: 999 },

  moduleCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 14, gap: 10 },
  moduleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  moduleName: { fontSize: 16, fontWeight: "800" },
  moduleCount: { fontSize: 13, fontWeight: "600", opacity: 0.5 },

  lessonRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  lessonLocked: { opacity: 0.4 },
  lessonIcon: { fontSize: 18, width: 28, textAlign: "center" },
  lessonName: { fontSize: 14, fontWeight: "600" },
  lessonNameLocked: { opacity: 0.6 },
  lessonPerfect: { fontSize: 11, color: "#2a9d8f", fontWeight: "600" },
  lessonAction: { fontSize: 11, fontWeight: "700", opacity: 0.4, backgroundColor: "#f0f0f0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },

  // Lesson detail styles
  stepLabel: { fontSize: 11, fontWeight: "800", color: "#2a9d8f", letterSpacing: 1 },
  lessonTitle: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 24, opacity: 0.85 },

  scenarioCard: {
    borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 6,
    backgroundColor: "#fafafa",
  },
  scenarioLabel: { fontSize: 10, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  scenarioText: { fontSize: 15, lineHeight: 22 },

  responseCard: { borderWidth: 2, borderRadius: 12, padding: 14, gap: 4 },
  badResponse: { borderColor: "#e76f51", backgroundColor: "#fdf2ef" },
  goodResponse: { borderColor: "#2a9d8f", backgroundColor: "#f0faf9" },
  responseLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, opacity: 0.6 },
  responseText: { fontSize: 15, lineHeight: 22, fontStyle: "italic" },

  whyCard: { borderLeftWidth: 3, borderLeftColor: "#2a9d8f", paddingLeft: 12, gap: 4 },
  whyLabel: { fontSize: 10, fontWeight: "800", color: "#2a9d8f", letterSpacing: 1 },
  whyText: { fontSize: 14, lineHeight: 22, opacity: 0.8 },

  optionCard: {
    borderWidth: 2, borderColor: "#e0e0e0", borderRadius: 12, padding: 14, gap: 6,
  },
  optionCorrect: { borderColor: "#2a9d8f", backgroundColor: "#f0faf9" },
  optionWrong: { borderColor: "#e76f51", backgroundColor: "#fdf2ef" },
  optionText: { fontSize: 15, lineHeight: 22 },
  optionFeedback: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  feedbackCorrect: { color: "#2a9d8f" },
  feedbackWrong: { color: "#e76f51" },

  takeawayCard: {
    borderWidth: 2, borderColor: "#f4a261", borderRadius: 14, padding: 16,
    backgroundColor: "#fffbf0",
  },
  takeawayText: { fontSize: 16, lineHeight: 26, fontWeight: "600" },

  relatedText: { fontSize: 13, opacity: 0.6, lineHeight: 20 },

  nextBtn: {
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: "black", alignItems: "center",
  },
  nextBtnText: { color: "white", fontWeight: "700", fontSize: 15 },

  backBtn: { alignItems: "center", paddingVertical: 10 },
  backBtnText: { fontSize: 13, opacity: 0.5, textDecorationLine: "underline" },

  note: { fontSize: 11, opacity: 0.5, lineHeight: 16, textAlign: "center" },
});
