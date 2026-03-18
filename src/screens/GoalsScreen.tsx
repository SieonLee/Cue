/**
 * GoalsScreen – Micro Goals (Finch-inspired)
 * ──────────────────────────────────────────
 * • Small, completable relationship goals
 * • No punishment for incomplete goals — just gentle nudges
 * • Celebrates completion with emoji confetti
 * • Goals are scoped to active profile (A / B) or shared
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as SQLite from "expo-sqlite";
import { useSensory } from "../context/SensoryContext";
import { useProfile } from "../context/ProfileContext";

// ─── DB helpers ─────────────────────────────────────────────────────────────

const DB_NAME = "couple_coach.db";

async function openDb() {
  return SQLite.openDatabaseAsync(DB_NAME);
}

interface GoalRow {
  id: number;
  text: string;
  completed: 0 | 1;
  created_at: string;
  completed_at: string | null;
  profile: string; // "A" | "B" | "shared"
}

async function loadGoals(profile: string): Promise<GoalRow[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<GoalRow>(
    `SELECT * FROM goals WHERE profile = ? OR profile = 'shared' ORDER BY completed ASC, created_at DESC`,
    [profile]
  );
  return rows;
}

async function addGoal(text: string, profile: string): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `INSERT INTO goals (text, completed, created_at, profile) VALUES (?, 0, datetime('now'), ?)`,
    [text, profile]
  );
}

async function completeGoal(id: number): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE goals SET completed = 1, completed_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

async function uncompleteGoal(id: number): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE goals SET completed = 0, completed_at = NULL WHERE id = ?`,
    [id]
  );
}

async function deleteGoal(id: number): Promise<void> {
  const db = await openDb();
  await db.runAsync(`DELETE FROM goals WHERE id = ?`, [id]);
}

// ─── Preset micro-goal suggestions ──────────────────────────────────────────

const PRESET_GOALS = [
  "Say one specific appreciation today",
  "Use a gentle tone in our next disagreement",
  "Ask about their day before sharing mine",
  "Take a 5-min break if I feel overwhelmed",
  "Send one kind message today",
  "Listen without planning my reply",
  "Notice when I'm getting flooded and say so",
  "End tonight with a positive comment",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const { lowSensory } = useSensory();
  const { activeProfile } = useProfile();

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [newText, setNewText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [recentCelebration, setRecentCelebration] = useState<number | null>(null);

  // ── Load goals on focus ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [activeProfile])
  );

  async function refresh() {
    const rows = await loadGoals(activeProfile);
    setGoals(rows);
  }

  // ── Add ─────────────────────────────────────────────────────────────────
  async function handleAdd(text: string = newText) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addGoal(trimmed, activeProfile);
    setNewText("");
    setShowPresets(false);
    await refresh();
  }

  // ── Complete / uncomplete ────────────────────────────────────────────────
  async function handleToggle(goal: GoalRow) {
    if (goal.completed === 0) {
      await completeGoal(goal.id);
      setRecentCelebration(goal.id);
      setTimeout(() => setRecentCelebration(null), 2000);
    } else {
      await uncompleteGoal(goal.id);
    }
    await refresh();
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function handleDelete(goal: GoalRow) {
    Alert.alert("Remove goal?", `"${goal.text}"`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteGoal(goal.id);
          await refresh();
        },
      },
    ]);
  }

  // ── Render goal item ─────────────────────────────────────────────────────
  function renderGoal({ item }: { item: GoalRow }) {
    const done = item.completed === 1;
    const celebrating = recentCelebration === item.id;
    return (
      <View style={[styles.goalRow, done && styles.goalRowDone]}>
        <TouchableOpacity
          style={[styles.checkbox, done && styles.checkboxDone]}
          onPress={() => handleToggle(item)}
          accessibilityLabel={done ? "Mark incomplete" : "Mark complete"}
        >
          {done && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <View style={styles.goalTextWrap}>
          <Text style={[styles.goalText, done && styles.goalTextDone]}>
            {celebrating ? `🎉 ${item.text}` : item.text}
          </Text>
          {done && item.completed_at && (
            <Text style={styles.completedAt}>
              Done {item.completed_at.split("T")[0]}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={styles.deleteBtn}
          accessibilityLabel="Delete goal"
        >
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const total = goals.length;
  const done = goals.filter((g) => g.completed === 1).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, lowSensory && styles.lowSensory]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <Text style={styles.title}>Micro Goals</Text>
      <Text style={styles.subtitle}>
        Profile {activeProfile} · {done}/{total} done{total > 0 ? ` (${pct}%)` : ""}
      </Text>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
      )}

      {/* Gentle nudge — not a punishment */}
      {total > 0 && done < total && (
        <Text style={styles.nudge}>
          ✨ No rush — small steps count.
        </Text>
      )}
      {done === total && total > 0 && (
        <Text style={styles.nudge}>🎉 All done! Add a new goal anytime.</Text>
      )}

      {/* Goal list */}
      <FlatList
        data={goals}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderGoal}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No goals yet. Add one below!</Text>
        }
      />

      {/* Add area */}
      <View style={styles.addArea}>
        <TextInput
          style={styles.input}
          placeholder="Add a small goal…"
          placeholderTextColor="#888"
          value={newText}
          onChangeText={setNewText}
          onSubmitEditing={() => handleAdd()}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd()}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Preset suggestions */}
      <TouchableOpacity
        style={styles.presetToggle}
        onPress={() => setShowPresets((v) => !v)}
      >
        <Text style={styles.presetToggleText}>
          {showPresets ? "▲ Hide suggestions" : "▼ Show suggestions"}
        </Text>
      </TouchableOpacity>

      {showPresets && (
        <View style={styles.presetList}>
          {PRESET_GOALS.map((p) => (
            <TouchableOpacity
              key={p}
              style={styles.presetChip}
              onPress={() => handleAdd(p)}
            >
              <Text style={styles.presetChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  lowSensory: { backgroundColor: "#f5f5f5" },

  title: { fontSize: 24, fontWeight: "700", color: "#111", marginTop: 8 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 8 },

  progressTrack: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    marginBottom: 6,
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4CAF50",
    borderRadius: 3,
  },

  nudge: { fontSize: 13, color: "#888", marginBottom: 10, fontStyle: "italic" },

  list: { flex: 1, marginTop: 4 },
  empty: { color: "#aaa", textAlign: "center", marginTop: 40, fontSize: 14 },

  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  goalRowDone: { opacity: 0.6 },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxDone: { backgroundColor: "#4CAF50" },
  checkmark: { color: "#fff", fontWeight: "700", fontSize: 14 },

  goalTextWrap: { flex: 1 },
  goalText: { fontSize: 15, color: "#222" },
  goalTextDone: { textDecorationLine: "line-through", color: "#aaa" },
  completedAt: { fontSize: 11, color: "#bbb", marginTop: 2 },

  deleteBtn: { padding: 6 },
  deleteText: { color: "#ccc", fontSize: 16 },

  addArea: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#fafafa",
  },
  addBtn: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700" },

  presetToggle: { alignSelf: "center", marginBottom: 4 },
  presetToggleText: { color: "#888", fontSize: 13 },

  presetList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: { fontSize: 12, color: "#444" },
});
