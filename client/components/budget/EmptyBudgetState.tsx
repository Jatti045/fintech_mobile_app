import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

export interface EmptyBudgetStateProps {
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
}

/**
 * Gradient-masked empty-state message shown when no budgets exist
 * for the selected month. Wrapped in `React.memo` — the colours rarely change.
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState({
  primary,
  secondary,
  textPrimary,
  textSecondary,
}: EmptyBudgetStateProps) {
  return (
    <View className="flex-1 justify-center items-center px-6 pt-12">
      <MaskedView
        maskElement={
          <Text
            className="text-3xl font-extrabold text-center"
            style={{ color: textPrimary }}
          >
            No budgets for this month
          </Text>
        }
      >
        <LinearGradient
          colors={[primary, secondary]}
          start={[0, 0]}
          end={[1, 1]}
        >
          {/* Text is invisible but used to size the mask */}
          <Text
            className="text-3xl font-extrabold text-center"
            style={{ opacity: 0 }}
          >
            No budgets for this month
          </Text>
        </LinearGradient>
      </MaskedView>

      <Text
        className="text-center mt-4 text-base"
        style={{ color: textSecondary }}
      >
        Create budgets to track spending by category for the selected month. Tap
        "New Budget" to get started.
      </Text>
    </View>
  );
});

export default EmptyBudgetState;
