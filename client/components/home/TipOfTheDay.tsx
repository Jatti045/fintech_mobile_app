import React from "react";
import { View, Text } from "react-native";

type Props = {
  THEME: any;
};

/**
 * Static educational tip shown at the bottom of the home feed.
 * Replace the message prop with a dynamic tips array in the future.
 */
export default function TipOfTheDay({ THEME }: Props) {
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        padding: 14,
        borderRadius: 12,
        marginBottom: 18,
      }}
    >
      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Tip of the Day
      </Text>
      <Text style={{ color: THEME.textSecondary }}>
        Auto-assign transactions to budgets by category to keep your spending on
        track. Long-press transactions to delete.
      </Text>
    </View>
  );
}
