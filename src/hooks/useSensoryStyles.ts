import { useSensory } from "../context/SensoryContext";
import { StyleSheet } from "react-native";

/**
 * Returns sensory-aware style overrides.
 * When lowSensory is ON:
 * - Reduce emoji sizes and hide decorative emojis
 * - Flatten card borders (use background fills instead)
 * - Mute accent colors to grays
 * - Reduce font weight contrasts
 * - Remove letter-spacing on labels
 */
export function useSensoryStyles() {
  const { lowSensory } = useSensory();

  if (!lowSensory) return { ls: false, lsStyles: null } as const;

  return {
    ls: true,
    lsStyles: overrides,
  } as const;
}

const overrides = StyleSheet.create({
  // Cards: no border, subtle bg
  card: {
    borderWidth: 0,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
  },
  // Muted accent card
  accentCard: {
    borderWidth: 0,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  // Icons/emoji smaller
  emoji: {
    fontSize: 16,
    opacity: 0.6,
  },
  // Hide decorative emojis
  hideEmoji: {
    display: "none",
  },
  // Softer section labels
  sectionLabel: {
    fontWeight: "600",
    letterSpacing: 0,
    color: "#999",
  },
  // Muted nav buttons
  navBtn: {
    backgroundColor: "#f0f0f0",
  },
  // Softer primary button
  primaryBtn: {
    backgroundColor: "#444",
  },
  // Reduce chip contrast
  chipActive: {
    backgroundColor: "#555",
    borderColor: "#555",
  },
});
