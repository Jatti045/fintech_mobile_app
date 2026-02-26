import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export interface NewBudgetButtonProps {
  onPress: () => void;
  primary: string;
  secondary: string;
  textPrimary: string;
}

/**
 * Floating action button to create a new budget.
 * Wrapped in `React.memo` so it doesn't re-render on parent state changes.
 */
const NewBudgetButton = React.memo(function NewBudgetButton({
  onPress,
  primary,
  secondary,
  textPrimary,
}: NewBudgetButtonProps) {
  return (
    <View className="absolute bottom-0 right-0 p-4">
      <TouchableOpacity onPress={onPress}>
        <LinearGradient
          colors={[primary, secondary]}
          start={[0, 0]}
          end={[1, 1]}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 1000,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 16,
            elevation: 16,
          }}
        >
          <View className="items-center justify-center flex-row gap-1">
            <Feather name="plus" size={24} color={textPrimary} />
            <Text
              style={{ color: textPrimary }}
              className="font-bold text-base"
            >
              New Budget
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

export default NewBudgetButton;
