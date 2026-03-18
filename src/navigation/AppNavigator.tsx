import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { CoachScreen } from "../screens/CoachScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { StatsScreen } from "../screens/StatsScreen";
import { CheckInScreen } from "../screens/CheckInScreen";
import { TimerScreen } from "../screens/TimerScreen";
import { DailyCardScreen } from "../screens/DailyCardScreen";
import { AsyncScreen } from "../screens/AsyncScreen";
import { EmergencyScreen } from "../screens/EmergencyScreen";
import { HealthScoreScreen } from "../screens/HealthScoreScreen";
import GoalsScreen from "../screens/GoalsScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { PatternScreen } from "../screens/PatternScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { StreakScreen } from "../screens/StreakScreen";
import { WeeklyReportScreen } from "../screens/WeeklyReportScreen";
import { LessonsScreen } from "../screens/LessonsScreen";
import { MilestoneScreen } from "../screens/MilestoneScreen";
import { LiveCoachScreen } from "../screens/LiveCoachScreen";
import { ReplayScreen } from "../screens/ReplayScreen";
import { AlignmentScreen } from "../screens/AlignmentScreen";
import { WhatIfScreen } from "../screens/WhatIfScreen";
import { ConflictRadarScreen } from "../screens/ConflictRadarScreen";
import { ModelHistoryScreen } from "../screens/ModelHistoryScreen";
import { EveningCheckInScreen } from "../screens/EveningCheckInScreen";
import { StatisticsScreen } from "../screens/StatisticsScreen";

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Coach: undefined;
  Result: { sessionId: string };
  Settings: undefined;
  History: undefined;
  Stats: undefined;
  CheckIn: undefined;
  Timer: undefined;
  DailyCard: undefined;
  Async: { cardId: string } | undefined;
  Emergency: undefined;
  HealthScore: undefined;
  Goals: undefined;
  Review: undefined;
  Patterns: undefined;
  Streak: undefined;
  WeeklyReport: undefined;
  Lessons: undefined;
  Milestones: undefined;
  LiveCoach: undefined;
  Replay: undefined;
  Alignment: undefined;
  WhatIf: undefined;
  ConflictRadar: undefined;
  ModelHistory: undefined;
  EveningCheckIn: undefined;
  Statistics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator({ initialRoute }: { initialRoute?: keyof RootStackParamList }) {
  return (
    <Stack.Navigator initialRouteName={initialRoute ?? "Home"}>
      <Stack.Screen name="Onboarding"   component={OnboardingScreen}   options={{ headerShown: false }} />
      <Stack.Screen name="Home"          component={HomeScreen}         options={{ title: "Cue" }} />
      <Stack.Screen name="Coach"         component={CoachScreen}        options={{ title: "Describe Situation" }} />
      <Stack.Screen name="Result"        component={ResultScreen}       options={{ title: "Recommendations" }} />
      <Stack.Screen name="Settings"      component={SettingsScreen}     options={{ title: "Our Settings" }} />
      <Stack.Screen name="History"       component={HistoryScreen}      options={{ title: "Session History" }} />
      <Stack.Screen name="Stats"         component={StatsScreen}        options={{ title: "Bandit Stats" }} />
      <Stack.Screen name="CheckIn"       component={CheckInScreen}      options={{ title: "Pre-Talk Check" }} />
      <Stack.Screen name="Timer"         component={TimerScreen}        options={{ title: "Timeout Timer" }} />
      <Stack.Screen name="DailyCard"     component={DailyCardScreen}    options={{ title: "Daily Card" }} />
      <Stack.Screen name="Async"         component={AsyncScreen}        options={{ title: "Together Apart" }} />
      <Stack.Screen name="Emergency"     component={EmergencyScreen}    options={{ title: "First Aid Kit" }} />
      <Stack.Screen name="HealthScore"   component={HealthScoreScreen}  options={{ title: "Relationship Health" }} />
      <Stack.Screen name="Goals"         component={GoalsScreen}        options={{ title: "Micro Goals" }} />
      <Stack.Screen name="Review"        component={ReviewScreen}       options={{ title: "Conversation Review" }} />
      <Stack.Screen name="Patterns"      component={PatternScreen}      options={{ title: "Pattern Dashboard" }} />
      <Stack.Screen name="Streak"        component={StreakScreen}        options={{ title: "Streaks & Badges" }} />
      <Stack.Screen name="WeeklyReport"  component={WeeklyReportScreen} options={{ title: "Weekly Report" }} />
      <Stack.Screen name="Lessons"       component={LessonsScreen}      options={{ title: "Guided Lessons" }} />
      <Stack.Screen name="Milestones"    component={MilestoneScreen}    options={{ title: "Milestones" }} />
      <Stack.Screen name="LiveCoach"    component={LiveCoachScreen}    options={{ title: "Live Coach" }} />
      <Stack.Screen name="Replay"       component={ReplayScreen}       options={{ title: "Conversation Replay" }} />
      <Stack.Screen name="Alignment"    component={AlignmentScreen}    options={{ title: "Partner Alignment" }} />
      <Stack.Screen name="WhatIf"       component={WhatIfScreen}       options={{ title: "What-If Analysis" }} />
      <Stack.Screen name="ConflictRadar" component={ConflictRadarScreen} options={{ title: "Conflict Radar" }} />
      <Stack.Screen name="ModelHistory" component={ModelHistoryScreen} options={{ title: "Model Evolution" }} />
      <Stack.Screen name="EveningCheckIn" component={EveningCheckInScreen} options={{ title: "Evening Check-In" }} />
      <Stack.Screen name="Statistics"    component={StatisticsScreen}   options={{ title: "Learning Statistics" }} />
    </Stack.Navigator>
  );
}
