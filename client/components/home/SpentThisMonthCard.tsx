import React from "react";
import { View, Text } from "react-native";
import { formatNumber } from "@/utils/helper";
import { useUser } from "@/store";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  /* Total amount spent in the selected month */
  total: number;
};

/* Hero card showing total expenditure for the currently selected month. */
export default function SpentThisMonthCard({ total }: Props) {
  const { THEME } = useTheme();
  const user = useUser();
  const currency = user?.currency || "USD";
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        padding: 18,
        borderRadius: 16,
        marginBottom: 18,
        borderColor: THEME.border,
        borderWidth: 1,
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
        ${formatNumber(total)} {currency}
      </Text>
    </View>
  );
}
