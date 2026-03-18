import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Animated } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useSensory } from "../context/SensoryContext";

type Props = NativeStackScreenProps<RootStackParamList, "Emergency">;

type ToolId = "breathe" | "ground" | "timeout" | "pause_script";

const TOOLS: { id: ToolId; emoji: string; title: string; subtitle: string }[] = [
  { id: "breathe",      emoji: "🌬️", title: "Breathing",     subtitle: "4–4–6 box breath · 1 minute" },
  { id: "ground",       emoji: "🖐️", title: "5-4-3-2-1",     subtitle: "Grounding · brings you back to now" },
  { id: "pause_script", emoji: "✋", title: "Pause message",  subtitle: "Ready-to-send timeout request" },
  { id: "timeout",      emoji: "⏱️", title: "Start timer",    subtitle: "Go to timeout timer screen" },
];

// ── Breathing Tool ──────────────────────────────────────────────────────────
const BREATH_PHASES: { label: string; duration: number }[] = [
  { label: "Breathe in", duration: 4 },
  { label: "Hold",       duration: 4 },
  { label: "Breathe out", duration: 6 },
];

function BreathingTool() {
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(BREATH_PHASES[0].duration);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running) return;
    if (count > 0) {
      const t = setTimeout(() => setCount((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    const nextPhase = (phase + 1) % BREATH_PHASES.length;
    if (nextPhase === 0) setCycles((c) => c + 1);
    setPhase(nextPhase);
    setCount(BREATH_PHASES[nextPhase].duration);
  }, [running, count, phase]);

  useEffect(() => {
    if (!running) return;
    const toValue = phase === 0 ? 1.3 : phase === 1 ? 1.3 : 1.0;
    Animated.timing(scale, {
      toValue,
      duration: BREATH_PHASES[phase].duration * 1000,
      useNativeDriver: true,
    }).start();
  }, [phase, running]);

  return (
    <View style={bt.container}>
      <Animated.View style={[bt.circle, { transform: [{ scale }] }]} />
      <Text style={bt.phaseText}>{BREATH_PHASES[phase].label}</Text>
      <Text style={bt.countText}>{count}</Text>
      {cycles > 0 && <Text style={bt.cyclesText}>{cycles} cycle{cycles > 1 ? "s" : ""} complete</Text>}
      <View style={bt.btnRow}>
        <Pressable style={bt.btn} onPress={() => { setRunning((r) => !r); }}>
          <Text style={bt.btnText}>{running ? "Pause" : "Start"}</Text>
        </Pressable>
        <Pressable style={bt.btnSecondary} onPress={() => { setRunning(false); setPhase(0); setCount(BREATH_PHASES[0].duration); setCycles(0); }}>
          <Text style={bt.btnSecondaryText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

const bt = StyleSheet.create({
  container: { alignItems: "center", gap: 16, paddingVertical: 20 },
  circle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#2a9d8f", opacity: 0.7 },
  phaseText: { fontSize: 18, fontWeight: "700" },
  countText: { fontSize: 40, fontWeight: "800" },
  cyclesText: { fontSize: 13, opacity: 0.6 },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, backgroundColor: "black" },
  btnText: { color: "white", fontWeight: "700" },
  btnSecondary: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#ddd" },
  btnSecondaryText: { fontWeight: "600" },
});

// ── Grounding Tool ──────────────────────────────────────────────────────────
const GROUND_STEPS = [
  { n: 5, sense: "see",   prompt: "Name 5 things you can see right now." },
  { n: 4, sense: "touch", prompt: "Name 4 things you can physically feel (chair, floor, air…)." },
  { n: 3, sense: "hear",  prompt: "Name 3 sounds you can hear." },
  { n: 2, sense: "smell", prompt: "Name 2 things you can smell (or 2 you remember smelling today)." },
  { n: 1, sense: "taste", prompt: "Name 1 thing you can taste right now." },
];

function GroundingTool() {
  const [step, setStep] = useState(0);
  const done = step >= GROUND_STEPS.length;
  return (
    <View style={gr.container}>
      {done ? (
        <>
          <Text style={gr.doneText}>You've completed the 5-4-3-2-1 exercise.</Text>
          <Pressable style={gr.btn} onPress={() => setStep(0)}>
            <Text style={gr.btnText}>Do it again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={gr.badge}><Text style={gr.badgeText}>{GROUND_STEPS[step].n}</Text></View>
          <Text style={gr.prompt}>{GROUND_STEPS[step].prompt}</Text>
          <Text style={gr.stepCount}>{step + 1} / {GROUND_STEPS.length}</Text>
          <Pressable style={gr.btn} onPress={() => setStep((s) => s + 1)}>
            <Text style={gr.btnText}>Done →</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const gr = StyleSheet.create({
  container: { alignItems: "center", gap: 16, paddingVertical: 20 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#457b9d", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "white", fontSize: 28, fontWeight: "800" },
  prompt: { fontSize: 16, lineHeight: 24, textAlign: "center", paddingHorizontal: 8 },
  stepCount: { fontSize: 13, opacity: 0.5 },
  doneText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  btn: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, backgroundColor: "black" },
  btnText: { color: "white", fontWeight: "700" },
});

// ── Pause Script ────────────────────────────────────────────────────────────
import * as Clipboard from "expo-clipboard";

const PAUSE_SCRIPTS = [
  "I need a moment to calm down. Can we pause and talk in 15 minutes?",
  "I'm getting overwhelmed. Let's take 15 minutes — I'll come back to this.",
  "I think I need to pause. Can we talk again in 15 minutes?",
  "My emotions are rising. I need a short break. Is 15 minutes okay?",
];

function PauseScriptTool() {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <View style={ps.container}>
      <Text style={ps.label}>Tap to copy and send:</Text>
      {PAUSE_SCRIPTS.map((s, i) => (
        <Pressable
          key={i}
          style={[ps.scriptBox, copied === i && ps.scriptBoxCopied]}
          onPress={async () => { await Clipboard.setStringAsync(s); setCopied(i); }}
        >
          <Text style={ps.scriptText}>{s}</Text>
          <Text style={ps.copyLabel}>{copied === i ? "Copied ✓" : "Copy"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const ps = StyleSheet.create({
  container: { gap: 10, paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: "700", opacity: 0.6 },
  scriptBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, gap: 8 },
  scriptBoxCopied: { borderColor: "#2a9d8f", backgroundColor: "#f0faf9" },
  scriptText: { fontSize: 14, lineHeight: 20 },
  copyLabel: { fontSize: 12, fontWeight: "700", opacity: 0.5, alignSelf: "flex-end" },
});

// ── Main Screen ─────────────────────────────────────────────────────────────
export function EmergencyScreen({ navigation }: Props) {
  const { lowSensory } = useSensory();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <ScrollView contentContainerStyle={[styles.container, lowSensory && styles.containerLow]}>
      <Text style={styles.title}>First Aid Kit</Text>
      <Text style={styles.subtitle}>
        Choose one tool. You don't have to do all of them.
      </Text>

      {/* Tool picker */}
      <View style={styles.toolGrid}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              if (t.id === "timeout") { navigation.navigate("Timer"); return; }
              setActiveTool(activeTool === t.id ? null : t.id);
            }}
            style={[styles.toolCard, activeTool === t.id && styles.toolCardActive]}
          >
            <Text style={styles.toolEmoji}>{t.emoji}</Text>
            <Text style={[styles.toolTitle, activeTool === t.id && styles.toolTitleActive]}>{t.title}</Text>
            <Text style={[styles.toolSub, activeTool === t.id && styles.toolSubActive]}>{t.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      {/* Active tool content */}
      {activeTool === "breathe"      && <BreathingTool />}
      {activeTool === "ground"       && <GroundingTool />}
      {activeTool === "pause_script" && <PauseScriptTool />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 16, paddingBottom: 32 },
  containerLow: { backgroundColor: "#f9f9f9" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18 },

  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: {
    width: "47%", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 14, padding: 14, gap: 6, alignItems: "flex-start",
  },
  toolCardActive: { backgroundColor: "black", borderColor: "black" },
  toolEmoji: { fontSize: 24 },
  toolTitle: { fontSize: 14, fontWeight: "700" },
  toolTitleActive: { color: "white" },
  toolSub: { fontSize: 12, opacity: 0.6, lineHeight: 16 },
  toolSubActive: { color: "white", opacity: 0.8 },
});
