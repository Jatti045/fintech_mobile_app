import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import BudgeeLogo from "./budgeeLogo";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  onInfoPress: () => void;
};

{
  /*Persistent top bar: app logo on the left, info button on the right.*/
}
export default function HomeHeader({ onInfoPress }: Props) {
  const { THEME } = useTheme();
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
