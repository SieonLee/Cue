import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { lightColors, darkColors } from "./tokens";
import type { ThemeColors } from "./tokens";
import { getSetting, setSetting } from "../db/sessions";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  colors: lightColors,
  isDark: false,
  toggleDarkMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = getSetting("darkMode");
    if (stored === "1") setMode("dark");
  }, []);

  const toggleDarkMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      setSetting("darkMode", next === "dark" ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    colors: mode === "dark" ? darkColors : lightColors,
    isDark: mode === "dark",
    toggleDarkMode,
  }), [mode, toggleDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
