import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import BudgeeLogo from "@/components/budgeeLogo";

type Props = {
  THEME: any;
  onInfoPress: () => void;
};

/**
 * Persistent top bar: app logo/wordmark on the left, info button on the right.
 */
export default function HomeHeader({ THEME, onInfoPress }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <BudgeeLogo
          size={36}
          primary={THEME.primary}
          secondary={THEME.secondary}
        />
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 20,
            fontWeight: "800",
            marginLeft: 10,
          }}
        >
          Budgee
        </Text>
      </View>

      <TouchableOpacity
        onPress={onInfoPress}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: THEME.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="info" size={18} color={THEME.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}
