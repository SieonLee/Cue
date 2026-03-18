import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { useTheme } from "../theme";
import { radii } from "../theme/tokens";

type Props = {
  value: 0 | 1 | boolean;
  onChange: ((v: 0 | 1) => void) | (() => void);
};

export function Toggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  const on = value === 1 || value === true;

  return (
    <Pressable
      onPress={() => (onChange as (v: 0 | 1) => void)(on ? 0 : 1)}
      style={[styles.toggle, { backgroundColor: on ? colors.btnPrimary : colors.gray400 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
    >
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 52,
    height: 30,
    borderRadius: radii.pill,
    padding: 3,
    justifyContent: "center",
  },
  knob: { width: 24, height: 24, borderRadius: radii.pill, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
  knobOff: { alignSelf: "flex-start" },
});
