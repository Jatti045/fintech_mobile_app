import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  /** Pre-formatted label, e.g. "February 2026". */
  monthLabel: string;
  /** Disables the forward arrow when already at the current month. */
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Centred month navigation row with previous / next chevron buttons.
 */
export default function MonthSelector({
  monthLabel,
  isCurrentMonth,
  onPrev,
  onNext,
}: Props) {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
      }}
    >
      <TouchableOpacity
        onPress={onPrev}
        activeOpacity={0.7}
        style={{
          padding: 8,
          marginRight: 12,
          backgroundColor: THEME.surface,
          borderRadius: 8,
          borderColor: THEME.border,
          borderWidth: 1,
        }}
      >
        <Feather name="chevron-left" size={20} color={THEME.textPrimary} />
      </TouchableOpacity>

      <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
        {monthLabel}
      </Text>

      <TouchableOpacity
        onPress={onNext}
        activeOpacity={isCurrentMonth ? 1 : 0.7}
        disabled={isCurrentMonth}
        style={{
          padding: 8,
          marginLeft: 12,
          backgroundColor: THEME.surface,
          borderRadius: 8,
          opacity: isCurrentMonth ? 0.5 : 1,
          borderColor: THEME.border,
          borderWidth: 1,
        }}
      >
        <Feather name="chevron-right" size={20} color={THEME.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}
