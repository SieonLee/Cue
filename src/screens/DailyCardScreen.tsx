import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useSensory } from "../context/SensoryContext";
import * as Clipboard from "expo-clipboard";

type Props = NativeStackScreenProps<RootStackParamList, "DailyCard">;

export type DailyCard = {
  id: string;
  category: "connection" | "conflict" | "appreciation" | "boundary" | "repair" | "fun";
  question: string;
  intent: string; // Paired-style: "Why this question?"
  followUp?: string;
};

export const CARDS: DailyCard[] = [
  // Connection
  { id: "c1", category: "connection", question: "When did you feel the most energy today?", intent: "Sharing a positive moment from your day strengthens your sense of connection. No need to evaluate your partner.", followUp: "Did you wish I was there with you in that moment?" },
  { id: "c2", category: "connection", question: "If there's one thing you want from your partner right now, what is it?", intent: "This is practice for expressing small needs. Focus on 'what I want right now' — not criticism or complaints.", followUp: "Was it hard to say that?" },
  { id: "c3", category: "connection", question: "What's the smallest activity we could enjoy together?", intent: "Small shared experiences strengthen a relationship more than big plans.", },
  { id: "c4", category: "connection", question: "Is there anything your partner said or did today that stuck with you?", intent: "Noticing and expressing small things is the core of intimacy.", },
  { id: "c5", category: "connection", question: "If you rate your body's state right now on a scale of 0–10, what would it be?", intent: "Sharing your physical state means your partner doesn't have to guess your energy level.", followUp: "What influenced that number?" },

  // Appreciation
  { id: "a1", category: "appreciation", question: "Is there something your partner did recently that you're grateful for but haven't said?", intent: "The more specific your gratitude, the more deeply it's felt.", followUp: "Can you tell them right now?" },
  { id: "a2", category: "appreciation", question: "Is there a habit of your partner's that you actually like but have never mentioned?", intent: "We often don't express positive things out of habit. This question is meant to break that pattern.", },
  { id: "a3", category: "appreciation", question: "Name one thing in our relationship that you've been taking for granted.", intent: "The opposite of gratitude isn't hate — it's taking things for granted. Recognizing this is the first step.", },

  // Conflict
  { id: "f1", category: "conflict", question: "Is there a conflict pattern we keep repeating?", intent: "Recognizing the pattern lets you stop earlier next time. This isn't about judging the current situation.", followUp: "What's my role in that pattern?" },
  { id: "f2", category: "conflict", question: "How do you usually react when conflict arises? (e.g., avoidance, overreaction, silence)", intent: "Knowing your own reaction patterns lets you communicate them to your partner in advance.", },
  { id: "f3", category: "conflict", question: "Do you know what topics your partner is most sensitive about?", intent: "Knowing each other's sensitive areas is the most direct way to reduce conflict.", },

  // Repair
  { id: "r1", category: "repair", question: "Is there something between us that was left unresolved recently?", intent: "Even small things accumulate when left unresolved. It may be better to bring it up now.", followUp: "Are you ready to talk about it now? (Yes/No)" },
  { id: "r2", category: "repair", question: "Is there something you haven't apologized for to your partner recently?", intent: "An apology is the most powerful tool for resetting a relationship. This question creates that opportunity.", },

  // Boundary
  { id: "b1", category: "boundary", question: "What kind of space or time do you need in our relationship?", intent: "A boundary isn't rejection — it's information about what you need to protect yourself. Sharing it reduces misunderstanding.", },
  { id: "b2", category: "boundary", question: "Is there something your partner does that feels difficult, but you haven't mentioned?", intent: "This question is about sharing information, not criticism. Speak only about your own experience, without judging their intent.", followUp: "How could you phrase it in a way that feels less difficult?" },

  // Fun
  { id: "u1", category: "fun", question: "When was the last time we laughed really hard together?", intent: "Humor and lightness are important resources in a relationship. This question revives positive memories.", },
  { id: "u2", category: "fun", question: "If you could suggest a 10-minute activity to do together right now, what would it be?", intent: "Spontaneous connection sometimes builds stronger bonds than planned activities.", },
  { id: "u3", category: "fun", question: "What's one thing we've wanted to do together but haven't yet?", intent: "Imagining a future together strengthens your sense of connection in the present.", },
];

const CATEGORY_LABEL: Record<DailyCard["category"], string> = {
  connection: "Connection",
  conflict: "Conflict",
  appreciation: "Appreciation",
  boundary: "Boundary",
  repair: "Repair",
  fun: "Fun",
};

const CATEGORY_COLOR: Record<DailyCard["category"], string> = {
  connection: "#2a9d8f",
  conflict:   "#e76f51",
  appreciation: "#f4a261",
  boundary:   "#457b9d",
  repair:     "#6a4c93",
  fun:        "#e9c46a",
};

function getTodayCard(): DailyCard {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return CARDS[dayIndex % CARDS.length];
}

export function DailyCardScreen({ navigation }: Props) {
  const { lowSensory } = useSensory();
  const card = useMemo(() => getTodayCard(), []);
  const [showIntent, setShowIntent] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const color = CATEGORY_COLOR[card.category];

  return (
    <ScrollView contentContainerStyle={[styles.container, lowSensory && styles.containerLow]}>
      {/* Category badge */}
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{CATEGORY_LABEL[card.category]}</Text>
      </View>

      {/* Main question card */}
      <View style={[styles.card, lowSensory && styles.cardLow, { borderColor: color }]}>
        <Text style={styles.cardLabel}>TODAY'S QUESTION</Text>
        <Text style={styles.questionText}>{card.question}</Text>

        {/* Intent reveal — Paired style */}
        <Pressable
          style={styles.intentToggle}
          onPress={() => setShowIntent((v) => !v)}
        >
          <Text style={styles.intentToggleText}>
            {showIntent ? "Hide" : "Why this question?"}
          </Text>
        </Pressable>
        {showIntent && (
          <View style={styles.intentBox}>
            <Text style={styles.intentText}>{card.intent}</Text>
          </View>
        )}
      </View>

      {/* Follow-up */}
      {card.followUp && (
        <View style={styles.followUpCard}>
          {!showFollowUp ? (
            <Pressable onPress={() => setShowFollowUp(true)}>
              <Text style={styles.followUpToggle}>Show follow-up question →</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.followUpLabel}>FOLLOW-UP</Text>
              <Text style={styles.followUpText}>{card.followUp}</Text>
            </>
          )}
        </View>
      )}

      {/* Copy */}
      <Pressable
        style={styles.copyBtn}
        onPress={() => Clipboard.setStringAsync(card.question)}
      >
        <Text style={styles.copyBtnText}>Copy question</Text>
      </Pressable>

      {/* CTA: Navigate to Async mode */}
      {!lowSensory && (
        <View style={styles.asyncCard}>
          <Text style={styles.asyncTitle}>Answer separately?</Text>
          <Text style={styles.asyncSubtitle}>
            Each of you answers independently — then compare. Less pressure, more honest.
          </Text>
          <Pressable
            style={styles.asyncBtn}
            onPress={() => navigation.navigate("Async", { cardId: card.id })}
          >
            <Text style={styles.asyncBtnText}>Start async session →</Text>
          </Pressable>
        </View>
      )}

      {/* All cards */}
      <Text style={styles.sectionTitle}>All categories</Text>
      {(Object.keys(CATEGORY_LABEL) as DailyCard["category"][]).map((cat) => {
        const cards = CARDS.filter((c) => c.category === cat);
        return (
          <View key={cat} style={styles.catSection}>
            <View style={[styles.catBadge, { backgroundColor: CATEGORY_COLOR[cat] }]}>
              <Text style={styles.catBadgeText}>{CATEGORY_LABEL[cat]}</Text>
            </View>
            {cards.map((c) => (
              <Pressable
                key={c.id}
                style={styles.cardItem}
                onPress={() => Clipboard.setStringAsync(c.question)}
              >
                <Text style={styles.cardItemText}>{c.question}</Text>
                <Text style={styles.cardItemCopy}>Copy</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 14, paddingBottom: 32 },
  containerLow: { backgroundColor: "#f9f9f9" },

  badge: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
  badgeText: { color: "white", fontWeight: "800", fontSize: 12 },

  card: {
    borderWidth: 2, borderRadius: 16, padding: 18, gap: 12,
  },
  cardLow: { borderRadius: 6 },
  cardLabel: { fontSize: 11, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  questionText: { fontSize: 18, fontWeight: "700", lineHeight: 26 },

  intentToggle: { alignSelf: "flex-start" },
  intentToggleText: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline", opacity: 0.6 },
  intentBox: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 12 },
  intentText: { fontSize: 13, lineHeight: 20, opacity: 0.8 },

  followUpCard: {
    borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, gap: 8,
  },
  followUpToggle: { fontSize: 13, fontWeight: "700", opacity: 0.6 },
  followUpLabel: { fontSize: 11, fontWeight: "800", opacity: 0.4, letterSpacing: 1 },
  followUpText: { fontSize: 15, lineHeight: 22 },

  copyBtn: {
    alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 1, borderColor: "#ddd",
  },
  copyBtnText: { fontWeight: "700", fontSize: 13 },

  asyncCard: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, gap: 8,
  },
  asyncTitle: { fontSize: 14, fontWeight: "700" },
  asyncSubtitle: { fontSize: 13, lineHeight: 18, opacity: 0.7 },
  asyncBtn: {
    alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, backgroundColor: "black",
  },
  asyncBtnText: { color: "white", fontWeight: "700", fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  catSection: { gap: 8 },
  catBadge: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  catBadgeText: { color: "white", fontWeight: "700", fontSize: 11 },
  cardItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, gap: 10,
  },
  cardItemText: { fontSize: 13, lineHeight: 18, flex: 1 },
  cardItemCopy: { fontSize: 12, fontWeight: "700", opacity: 0.4 },
});
