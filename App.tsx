import React, { useEffect, useState } from "react";
import * as react_native from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { initDb } from "./src/db/db";
import { getSetting } from "./src/db/sessions";
import { SensoryProvider } from "./src/context/SensoryContext";
import { ProfileProvider } from "./src/context/ProfileContext";
import { ThemeProvider, useTheme } from "./src/theme";

function AppInner() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    try {
      initDb();
      const onboarded = getSetting("onboarding_completed");
      setNeedsOnboarding(onboarded !== "true");
      setReady(true);
    } catch (e: any) {
      setError(e?.message ?? "Unknown init error");
      setReady(true);
    }
  }, []);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.headerBg,
      text: colors.text,
      border: colors.border,
      primary: colors.teal,
    },
  };

  if (!ready) {
    return (
      <react_native.View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <react_native.Text style={{ color: colors.text }}>Loading...</react_native.Text>
      </react_native.View>
    );
  }

  if (error) {
    return (
      <react_native.View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, padding: 20 }}>
        <react_native.Text style={{ fontSize: 18, fontWeight: "700", color: colors.danger }}>Init Error</react_native.Text>
        <react_native.Text style={{ marginTop: 10, color: colors.text }}>{error}</react_native.Text>
      </react_native.View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <AppNavigator initialRoute={needsOnboarding ? "Onboarding" : "Home"} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SensoryProvider>
        <ProfileProvider>
          <AppInner />
        </ProfileProvider>
      </SensoryProvider>
    </ThemeProvider>
  );
}
