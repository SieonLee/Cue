import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { getSetting, setSetting, resetBanditParams, exportSessionsJson, exportSessionsCsv } from "../db/sessions";
import { exportAllDataJson, resetAllData } from "../db/export";
import type { Tone } from "../types/models";
import { useSensory } from "../context/SensoryContext";
import { useTheme } from "../theme";
import { font, radii, spacing } from "../theme/tokens";
import type { ThemeColors } from "../theme";
import { Toggle } from "../components/Toggle";

type Bool01 = 0 | 1;

export function SettingsScreen() {
  const [prefText, setPrefText] = useState<Bool01>(1);
  const [prefYesNo, setPrefYesNo] = useState<Bool01>(1);
  const [noticeHours, setNoticeHours] = useState<string>("2");
  const [myName, setMyName] = useState<string>("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string>("");
  const [tone, setTone] = useState<Tone>("casual");
  const [saved, setSaved] = useState(false);
  const { lowSensory, toggleLowSensory } = useSensory();
  const { colors, isDark, toggleDarkMode } = useTheme();
  const styles = useMemo(() => themedStyles(colors), [colors]);

  useEffect(() => {
    const pt = getSetting("prefText");
    const py = getSetting("prefYesNo");
    const nh = getSetting("noticeHours");
    const mn = getSetting("myName");
    const pn = getSetting("partnerName");
    const fp = getSetting("forbiddenPhrases");
    const tn = getSetting("tone");

    if (pt !== null) setPrefText((pt === "1" ? 1 : 0) as Bool01);
    if (py !== null) setPrefYesNo((py === "1" ? 1 : 0) as Bool01);
    if (nh !== null) setNoticeHours(nh);
    if (mn !== null) setMyName(mn);
    if (pn !== null) setPartnerName(pn);
    if (fp !== null) setForbiddenPhrases(fp);
    if (tn === "formal" || tn === "casual") setTone(tn);
  }, []);

  function save() {
    setSetting("prefText", String(prefText));
    setSetting("prefYesNo", String(prefYesNo));
    const n = Math.max(0, Math.min(72, parseInt(noticeHours || "0", 10) || 0));
    setSetting("noticeHours", String(n));
    setNoticeHours(String(n));
    setSetting("myName", myName.trim());
    setSetting("partnerName", partnerName.trim());
    setSetting("forbiddenPhrases", forbiddenPhrases.trim());
    setSetting("tone", tone);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Our settings</Text>
      <Text style={styles.subtitle}>
        These preferences affect recommended actions and the wording of scripts. (Saved locally)
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>My partner prefers texting</Text>
        <View style={styles.row}>
          <Toggle value={prefText} onChange={setPrefText} />
          <Text style={styles.valueText}>{prefText ? "Yes" : "No"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Yes/No questions are helpful</Text>
        <View style={styles.row}>
          <Toggle value={prefYesNo} onChange={setPrefYesNo} />
          <Text style={styles.valueText}>{prefYesNo ? "Yes" : "No"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>How many hours of notice is best for schedule changes?</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={noticeHours}
            onChangeText={setNoticeHours}
            keyboardType="number-pad"
            placeholder="0-72"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.valueText}>hours</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>My name (how I refer to myself)</Text>
        <TextInput
          style={styles.input}
          value={myName}
          onChangeText={setMyName}
          placeholder="e.g., Alex"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Partner name (how I address them)</Text>
        <TextInput
          style={styles.input}
          value={partnerName}
          onChangeText={setPartnerName}
          placeholder="e.g., Jordan"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Forbidden phrases (comma-separated)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={forbiddenPhrases}
          onChangeText={setForbiddenPhrases}
          placeholder="e.g., always, never, you always"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Script tone</Text>
        <Text style={styles.sublabel}>Affects the wording style of recommended scripts</Text>
        <View style={styles.chipRow}>
          {(["casual", "formal"] as Tone[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTone(t)}
              style={[styles.chip, tone === t ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipText, tone === t ? styles.chipTextActive : styles.chipTextInactive]}>
                {t === "casual" ? "Casual" : "Formal"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Low sensory mode</Text>
        <Text style={styles.sublabel}>Reduces visual complexity across all screens</Text>
        <View style={styles.row}>
          <Toggle value={lowSensory ? 1 : 0} onChange={() => toggleLowSensory()} />
          <Text style={styles.valueText}>{lowSensory ? "On" : "Off"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Dark mode</Text>
        <Text style={styles.sublabel}>Switch between light and dark color scheme</Text>
        <View style={styles.row}>
          <Toggle value={isDark ? 1 : 0} onChange={() => toggleDarkMode()} />
          <Text style={styles.valueText}>{isDark ? "On" : "Off"}</Text>
        </View>
      </View>

      <Pressable style={styles.primaryBtn} onPress={save}>
        <Text style={styles.primaryBtnText}>{saved ? "Saved \u2713" : "Save"}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Export session data</Text>
        <Text style={styles.sublabel}>No message content — context tags only. Copies to clipboard.</Text>
        <View style={styles.row}>
          <Pressable
            style={styles.exportBtn}
            onPress={async () => {
              const json = exportSessionsJson();
              await Clipboard.setStringAsync(json);
              Alert.alert("Copied", "JSON copied to clipboard.");
            }}
          >
            <Text style={styles.exportBtnText}>Copy JSON</Text>
          </Pressable>
          <Pressable
            style={styles.exportBtn}
            onPress={async () => {
              const csv = exportSessionsCsv();
              await Clipboard.setStringAsync(csv);
              Alert.alert("Copied", "CSV copied to clipboard.");
            }}
          >
            <Text style={styles.exportBtnText}>Copy CSV</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Reset bandit parameters</Text>
        <Text style={styles.sublabel}>Clears all learned action preferences. Cannot be undone.</Text>
        <Pressable
          style={styles.dangerBtn}
          onPress={() =>
            Alert.alert(
              "Reset bandit?",
              "This will clear all learned preferences. Session history is kept.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  style: "destructive",
                  onPress: () => {
                    resetBanditParams();
                    Alert.alert("Done", "Bandit parameters reset.");
                  },
                },
              ]
            )
          }
        >
          <Text style={styles.dangerBtnText}>Reset learning data</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Export all data</Text>
        <Text style={styles.sublabel}>Copies complete data export (JSON) to clipboard</Text>
        <Pressable style={styles.exportBtn} onPress={async () => {
          const json = exportAllDataJson();
          await Clipboard.setStringAsync(json);
          Alert.alert("Copied", "Full data export copied to clipboard.");
        }}>
          <Text style={styles.exportBtnText}>Export JSON</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Reset all data</Text>
        <Text style={styles.sublabel}>Clears all sessions, feedback, and learning data. Settings and preferences are kept.</Text>
        <Pressable style={styles.dangerBtn} onPress={() => Alert.alert(
          "Reset all data?",
          "This will delete all sessions, feedback, learning data, goals, and badges. Your settings and profile preferences will be kept. This cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Reset everything", style: "destructive", onPress: () => { resetAllData(); Alert.alert("Done", "All data has been reset."); } },
          ]
        )}>
          <Text style={styles.dangerBtnText}>Reset all data</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function themedStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.page, gap: spacing.gap, paddingBottom: spacing.pageBtm },
    title: { fontSize: 20, fontWeight: "700", color: c.text },
    subtitle: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 6 },

    card: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: radii.xl, padding: spacing.cardPad, gap: 10 },
    label: { fontSize: 14, fontWeight: "600", color: c.text },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    valueText: { fontSize: 14, color: c.textSecondary },

    input: {
      borderWidth: 1,
      borderColor: c.gray400,
      borderRadius: radii.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      width: "100%",
      fontSize: 14,
      backgroundColor: c.cardElevated,
      color: c.text,
    },
    inputSmall: { width: 100 },
    inputMultiline: { minHeight: 70, textAlignVertical: "top" },

    primaryBtn: {
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: radii.md,
      backgroundColor: c.btnPrimary,
      alignItems: "center",
    },
    primaryBtnText: { color: c.btnPrimaryText, fontWeight: "700" },

    sublabel: { fontSize: 12, color: c.textTertiary, lineHeight: 16 },
    exportBtn: {
      paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: radii.md, borderWidth: 1, borderColor: c.gray400,
    },
    exportBtnText: { fontWeight: "600", fontSize: 13, color: c.text },
    dangerBtn: {
      paddingVertical: 12, borderRadius: radii.md,
      borderWidth: 1, borderColor: c.danger, alignItems: "center",
    },
    dangerBtnText: { color: c.danger, fontWeight: "700" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: 1 },
    chipActive: { backgroundColor: c.chipActive, borderColor: c.chipActiveBorder },
    chipInactive: { backgroundColor: c.chipInactive, borderColor: c.chipInactiveBorder },
    chipText: { fontSize: 13, fontWeight: "600" },
    chipTextActive: { color: c.chipActiveText },
    chipTextInactive: { color: c.chipInactiveText },
  });
}
