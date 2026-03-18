import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { parseConversation, type Turn } from "../nlp/sentiment";
import { ACTIONS } from "../coach/actions";
import type { ActionId } from "../coach/actions";

type ReplayResult = {
  turns: Turn[];
  totalUrgencySignals: number;
  totalPauseSignals: number;
  actionsDetected: Map<ActionId, number>;
};

function analyzeConversation(text: string): ReplayResult {
  const turns = parseConversation(text);
  let totalUrgencySignals = 0;
  let totalPauseSignals = 0;
  const actionsDetected = new Map<ActionId, number>();

  for (const t of turns) {
    totalUrgencySignals += t.signals.urgencySignals.length;
    totalPauseSignals += t.signals.pauseSignals.length;
    if (t.detectedAction) {
      actionsDetected.set(t.detectedAction, (actionsDetected.get(t.detectedAction) ?? 0) + 1);
    }
  }

  return { turns, totalUrgencySignals, totalPauseSignals, actionsDetected };
}

export function ReplayScreen() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReplayResult | null>(null);

  const handleAnalyze = () => {
    if (!input.trim()) return;
    setResult(analyzeConversation(input));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        Paste a conversation and Cue will label each turn with the closest action.{"\n"}
        Use one line per turn, like "Me: ..." and "Partner: ..."
      </Text>

      <TextInput
        style={styles.input} multiline value={input} onChangeText={setInput}
        placeholder={"Me: Can we talk about yesterday?\nPartner: Not now, I'm tired.\nMe: Would you prefer later tonight or tomorrow?"}
        placeholderTextColor="#bbb"
      />
      <Pressable style={styles.analyzeBtn} onPress={handleAnalyze}>
        <Text style={styles.analyzeBtnText}>Analyze conversation</Text>
      </Pressable>

      {result && (
        <View style={styles.results}>
          {/* Summary counts */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryNum}>{result.turns.length}</Text>
              <Text style={styles.summaryLabel}>turns</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryNum}>{result.actionsDetected.size}</Text>
              <Text style={styles.summaryLabel}>actions used</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryNum, { color: result.totalUrgencySignals > 0 ? "#e76f51" : "#2a9d8f" }]}>
                {result.totalUrgencySignals}
              </Text>
              <Text style={styles.summaryLabel}>urgency signals</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryNum, { color: "#2a9d8f" }]}>{result.totalPauseSignals}</Text>
              <Text style={styles.summaryLabel}>pause signals</Text>
            </View>
          </View>

          {/* Actions detected summary */}
          {result.actionsDetected.size > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Detected actions</Text>
              {Array.from(result.actionsDetected.entries()).map(([id, count]) => (
                <View key={id} style={styles.actionSummaryRow}>
                  <Text style={styles.actionSummaryTitle}>{ACTIONS[id]?.title ?? id}</Text>
                  <Text style={styles.actionSummaryCount}>{count}x</Text>
                </View>
              ))}
            </View>
          )}

          {/* Turn-by-turn */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Turn by turn</Text>
            {result.turns.map((t, i) => (
              <View key={i} style={styles.turnRow}>
                <Text style={styles.turnSpeaker}>{t.speaker}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.turnText} numberOfLines={2}>{t.text}</Text>
                  <View style={styles.turnTags}>
                    {t.detectedAction && (
                      <Text style={styles.tagAction}>{ACTIONS[t.detectedAction]?.title ?? t.detectedAction}</Text>
                    )}
                    {t.signals.hasUrgency && <Text style={styles.tagUrgency}>urgency</Text>}
                    {t.signals.hasPauseAttempt && <Text style={styles.tagPause}>pause attempt</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Actions NOT detected — suggestions */}
          {result.actionsDetected.size < 3 && (
            <View style={styles.suggestCard}>
              <Text style={styles.sectionLabel}>Ideas for next time</Text>
              {(Object.keys(ACTIONS) as ActionId[])
                .filter((id) => !result.actionsDetected.has(id))
                .slice(0, 3)
                .map((id) => (
                  <View key={id} style={styles.suggestRow}>
                    <Text style={styles.suggestTitle}>{ACTIONS[id].title}</Text>
                    <Text style={styles.suggestDesc}>{ACTIONS[id].description}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 14, paddingBottom: 40 },
  subtitle: { fontSize: 13, opacity: 0.6, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, fontSize: 14, minHeight: 120, textAlignVertical: "top", backgroundColor: "#fafafa", lineHeight: 20 },
  analyzeBtn: { backgroundColor: "black", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  analyzeBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  results: { gap: 14 },
  summaryRow: { flexDirection: "row", gap: 6 },
  summaryBox: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 10 },
  summaryNum: { fontSize: 20, fontWeight: "900" },
  summaryLabel: { fontSize: 9, opacity: 0.5, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, gap: 8, backgroundColor: "#fafafa" },
  sectionLabel: { fontSize: 10, fontWeight: "800", opacity: 0.5, letterSpacing: 1 },
  actionSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionSummaryTitle: { fontSize: 14, fontWeight: "700" },
  actionSummaryCount: { fontSize: 14, fontWeight: "800", color: "#2a9d8f" },
  turnRow: { flexDirection: "row", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  turnSpeaker: { fontSize: 12, fontWeight: "800", color: "#264653", width: 20 },
  turnText: { fontSize: 13, lineHeight: 18 },
  turnTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  tagAction: { fontSize: 9, fontWeight: "700", color: "#264653", backgroundColor: "#e8eef0", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  tagUrgency: { fontSize: 9, fontWeight: "700", color: "#e76f51", backgroundColor: "#fdf2ef", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  tagPause: { fontSize: 9, fontWeight: "700", color: "#2a9d8f", backgroundColor: "#f0faf9", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  suggestCard: { borderWidth: 1, borderColor: "#2a9d8f", borderRadius: 12, padding: 12, gap: 8, backgroundColor: "#f0faf9" },
  suggestRow: { gap: 2 },
  suggestTitle: { fontSize: 13, fontWeight: "700" },
  suggestDesc: { fontSize: 11, opacity: 0.6, lineHeight: 16 },
});
