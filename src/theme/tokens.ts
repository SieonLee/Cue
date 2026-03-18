/**
 * Cue Design System — Design tokens for light and dark themes.
 * Single source of truth for colors, typography, spacing, radii.
 */

// ── Color Palette Type ─────────────────────────────────────────────────────

export type ThemeColors = {
  // Surfaces
  bg: string;
  card: string;
  cardElevated: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Primary (brand teal)
  teal: string;
  tealDark: string;
  tealLight: string;
  tealBorder: string;

  // Accent
  orange: string;
  orangeLight: string;
  red: string;
  redLight: string;
  danger: string;

  // Blue
  blue: string;
  blueLight: string;

  // Neutrals
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;

  // Interactive
  btnPrimary: string;
  btnPrimaryText: string;
  chipActive: string;
  chipActiveBorder: string;
  chipActiveText: string;
  chipInactive: string;
  chipInactiveBorder: string;
  chipInactiveText: string;

  // Borders
  border: string;
  borderLight: string;

  // Overlays
  overlay12: string;
  overlay15: string;
  tealOverlay: string;

  // Bayesian
  confBadgeBg: string;
  confBadgeActive: string;

  // Header
  headerBg: string;
  headerText: string;
};

export const lightColors: ThemeColors = {
  bg: "#fff",
  card: "#fff",
  cardElevated: "#fafafa",

  text: "#111",
  textSecondary: "#444",
  textTertiary: "#888",
  textInverse: "#fff",

  teal: "#2a9d8f",
  tealDark: "#264653",
  tealLight: "#f0faf9",
  tealBorder: "#2a9d8f",

  orange: "#f4a261",
  orangeLight: "#fffbf0",
  red: "#e76f51",
  redLight: "#fdf2ef",
  danger: "#e63946",

  blue: "#457b9d",
  blueLight: "#f0f4f8",

  gray50: "#fafafa",
  gray100: "#f5f5f5",
  gray200: "#eee",
  gray300: "#e0e0e0",
  gray400: "#ddd",
  gray500: "#bbb",
  gray600: "#aaa",
  gray700: "#888",
  gray800: "#444",
  gray900: "#222",

  btnPrimary: "#111",
  btnPrimaryText: "#fff",
  chipActive: "#111",
  chipActiveBorder: "#111",
  chipActiveText: "#fff",
  chipInactive: "#fff",
  chipInactiveBorder: "#ddd",
  chipInactiveText: "#111",

  border: "#eee",
  borderLight: "#f0f0f0",

  overlay12: "rgba(255,255,255,0.12)",
  overlay15: "rgba(255,255,255,0.15)",
  tealOverlay: "rgba(42,157,143,0.7)",

  confBadgeBg: "#e8f5e9",
  confBadgeActive: "#a5f3c8",

  headerBg: "#fff",
  headerText: "#111",
};

export const darkColors: ThemeColors = {
  bg: "#0d0d0d",
  card: "#1a1a1a",
  cardElevated: "#222",

  text: "#f0f0f0",
  textSecondary: "#bbb",
  textTertiary: "#777",
  textInverse: "#111",

  teal: "#4ecdc4",
  tealDark: "#2a9d8f",
  tealLight: "#1a2e2b",
  tealBorder: "#4ecdc4",

  orange: "#f4a261",
  orangeLight: "#2a2318",
  red: "#e76f51",
  redLight: "#2a1a16",
  danger: "#ff6b6b",

  blue: "#6ba3be",
  blueLight: "#1a2530",

  gray50: "#1a1a1a",
  gray100: "#222",
  gray200: "#2a2a2a",
  gray300: "#333",
  gray400: "#444",
  gray500: "#666",
  gray600: "#888",
  gray700: "#aaa",
  gray800: "#ccc",
  gray900: "#eee",

  btnPrimary: "#f0f0f0",
  btnPrimaryText: "#111",
  chipActive: "#f0f0f0",
  chipActiveBorder: "#f0f0f0",
  chipActiveText: "#111",
  chipInactive: "#1a1a1a",
  chipInactiveBorder: "#444",
  chipInactiveText: "#f0f0f0",

  border: "#2a2a2a",
  borderLight: "#222",

  overlay12: "rgba(0,0,0,0.3)",
  overlay15: "rgba(0,0,0,0.4)",
  tealOverlay: "rgba(78,205,196,0.5)",

  confBadgeBg: "#1a2e2b",
  confBadgeActive: "#4ecdc4",

  headerBg: "#111",
  headerText: "#f0f0f0",
};

// ── Typography ──────────────────────────────────────────────────────────────

export const font = {
  xs: 9,
  sm: 11,
  md: 13,
  base: 14,
  lg: 15,
  xl: 17,
  xxl: 20,
  xxxl: 22,
  brand: 30,

  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
  black: "900" as const,
} as const;

// ── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 14,
  xxl: 18,
  xxxl: 24,
  page: 18,
  pageBtm: 32,
  cardPad: 14,
  gap: 12,
} as const;

// ── Radii ───────────────────────────────────────────────────────────────────

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  pill: 999,
} as const;
