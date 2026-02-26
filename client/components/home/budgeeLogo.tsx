import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// A compact, unique app mark for "Budgee" — a stylized 'B' composed of two overlapping coin-like arcs
type Props = {
  size?: number;
  primary?: string; // primary gradient color (from THEME.primary)
  secondary?: string; // secondary gradient color (from THEME.secondary)
  accent?: string; // subtle overlay color (defaults to translucent white)
  style?: ViewStyle;
};

export default function BudgeeLogo({
  size = 36,
  primary = "#4F46E5",
  secondary = "#06B6D4",
  accent = "rgba(255,255,255,0.28)",
  style,
}: Props) {
  const radius = size;
  return (
    <View
      style={[
        {
          width: radius,
          height: radius,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[primary, secondary]}
        start={[0, 0]}
        end={[1, 1]}
        style={{
          position: "absolute",
          width: radius,
          height: radius,
          borderRadius: 8,
          opacity: 0.95,
        }}
      />

      {/* Inner 'B' using two stacked arcs implemented as layered shapes */}
      <View
        style={{
          position: "absolute",
          left: radius * 0.22,
          width: radius * 0.18,
          height: radius * 0.7,
          backgroundColor: "#fff",
          borderRadius: 6,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: radius * 0.09,
          width: radius * 0.44,
          height: radius * 0.44,
          borderRadius: radius * 0.22,
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      <View
        style={{
          position: "absolute",
          right: radius * 0.09,
          top: radius * 0.28,
          width: radius * 0.44,
          height: radius * 0.44,
          borderRadius: radius * 0.22,
          backgroundColor: accent,
        }}
      />

      {/* Optional tiny textual mark center for accessibility */}
      <Text
        style={{
          color: "#fff",
          fontWeight: "800",
          position: "absolute",
          fontSize: Math.max(10, Math.floor(radius * 0.32)),
        }}
      >
        B
      </Text>
    </View>
  );
}
