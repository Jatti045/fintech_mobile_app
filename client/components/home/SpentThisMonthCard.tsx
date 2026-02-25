import React from "react";
import { View, Text } from "react-native";
import { formatNumber } from "@/utils/helper";

type Props = {
  THEME: any;
  /** Total amount spent in the selected month (in dollars). */
  total: number;
};

/**
 * Hero card showing total expenditure for the currently selected month.
 */
export default function SpentThisMonthCard({ THEME, total }: Props) {
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        padding: 18,
        borderRadius: 16,
        marginBottom: 18,
      }}
    >
      <Text style={{ color: THEME.textSecondary, marginBottom: 8 }}>
        Spent This Month
      </Text>
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 34,
          fontWeight: "900",
        }}
      >
        ${formatNumber(total)}
      </Text>
    </View>
  );
}
