import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useSensory } from "../context/SensoryContext";

type Props = NativeStackScreenProps<RootStackParamList, "Timer">;

const PRESETS = [
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
];

function fmt(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function TimerScreen({ navigation }: Props) {
  const { lowSensory } = useSensory();
  const [selected, setSelected] = useState(900); // default 15 min
  const [remaining, setRemaining] = useState(900);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback((secs: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSelected(secs);
    setRemaining(secs);
    setRunning(false);
    setDone(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function start() {
    if (done || running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function pause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }

  const progress = 1 - remaining / selected;
  const ringSize = lowSensory ? 140 : 180;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Timeout timer</Text>
      {!lowSensory && (
        <Text style={styles.subtitle}>
          Use this to take a structured break before continuing the conversation.
        </Text>
      )}

      {/* Preset selector */}
      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.seconds}
            onPress={() => reset(p.seconds)}
            style={[styles.presetBtn, selected === p.seconds && styles.presetBtnActive]}
          >
            <Text style={[styles.presetBtnText, selected === p.seconds && styles.presetBtnTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Timer display */}
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <Text style={styles.timerText}>{fmt(remaining)}</Text>
        {!lowSensory && (
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        )}
      </View>

      {done && (
        <View style={styles.doneCard}>
          <Text style={styles.doneText}>Time's up. Ready to talk?</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {!running && !done && (
          <Pressable style={styles.primaryBtn} onPress={start}>
            <Text style={styles.primaryBtnText}>Start</Text>
          </Pressable>
        )}
        {running && (
          <Pressable style={styles.secondaryBtn} onPress={pause}>
            <Text style={styles.secondaryBtnText}>Pause</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryBtn} onPress={() => reset(selected)}>
          <Text style={styles.secondaryBtnText}>Reset</Text>
        </Pressable>
      </View>

      {done && (
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("CheckIn")}>
          <Text style={styles.primaryBtnText}>Check readiness →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, opacity: 0.7, lineHeight: 18, textAlign: "center" },

  presetRow: { flexDirection: "row", gap: 10 },
  presetBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 999, borderWidth: 1, borderColor: "#ddd",
  },
  presetBtnActive: { backgroundColor: "black", borderColor: "black" },
  presetBtnText: { fontWeight: "700", fontSize: 13 },
  presetBtnTextActive: { color: "white" },

  ring: {
    borderWidth: 6,
    borderColor: "#2a9d8f",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  timerText: { fontSize: 36, fontWeight: "800", fontVariant: ["tabular-nums"] },
  progressText: { fontSize: 13, opacity: 0.5 },

  doneCard: {
    borderWidth: 2, borderColor: "#2a9d8f",
    borderRadius: 12, padding: 14,
  },
  doneText: { fontSize: 15, fontWeight: "700", color: "#2a9d8f", textAlign: "center" },

  controls: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 10, backgroundColor: "black", alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: "#ccc", alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "600" },
});
