// Re-export everything from the theme module
export { lightColors, darkColors, font, spacing, radii } from "./tokens";
export type { ThemeColors } from "./tokens";
export { ThemeProvider, useTheme } from "./ThemeContext";
export type { ThemeMode } from "./ThemeContext";

// Backward compatibility: `colors` alias for lightColors (static usage)
import { lightColors } from "./tokens";
export const colors = lightColors;
