import React, { useEffect, useState } from "react";
import * as react_native from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { initDb } from "./src/db/db";
import { getSetting } from "./src/db/sessions";
import { SensoryProvider } from "./src/context/SensoryContext";
import { ProfileProvider } from "./src/context/ProfileContext";
import { ThemeProvider, useTheme } from "./src/theme";

function AppNavigatorShell({ needsOnboarding }: { needsOnboarding: boolean }) {
  const { colors, isDark } = useTheme();

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

  return (
    <NavigationContainer theme={navTheme}>
      <AppNavigator initialRoute={needsOnboarding ? "Onboarding" : "Home"} />
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initDb();
        if (cancelled) return;
        const onboarded = getSetting("onboarding_completed");
        setNeedsOnboarding(onboarded !== "true");
        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown init error");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <react_native.View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <react_native.Text style={{ color: "#111827" }}>Loading...</react_native.Text>
      </react_native.View>
    );
  }

  if (error) {
    return (
      <react_native.View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", padding: 20 }}>
        <react_native.Text style={{ fontSize: 18, fontWeight: "700", color: "#b91c1c" }}>Init Error</react_native.Text>
        <react_native.Text style={{ marginTop: 10, color: "#111827" }}>{error}</react_native.Text>
      </react_native.View>
    );
  }

  return (
    <ThemeProvider>
      <SensoryProvider>
        <ProfileProvider>
          <AppNavigatorShell needsOnboarding={needsOnboarding} />
        </ProfileProvider>
      </SensoryProvider>
    </ThemeProvider>
  );
}
