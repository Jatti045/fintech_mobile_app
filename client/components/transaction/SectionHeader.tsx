import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";
import { friendlyDayLabel } from "../../utils/transaction/helpers";

/**
 * Section header displaying the friendly day label and the section's total spend.
 * Wrapped in `React.memo` so it only re-renders when its own props change.
 */
const SectionHeader = React.memo(function SectionHeader({
  title,
  total,
}: {
  title: string;
  total: number;
}) {
  const { THEME } = useTheme();

  return (
    <View className="py-2 flex-row justify-center items-center">
      <Text
        style={{ color: THEME.textSecondary, flex: 1 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {friendlyDayLabel(title)}
      </Text>
      <Text
        style={{ color: THEME.textPrimary, marginLeft: 8 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {formatCurrency(total)}
      </Text>
    </View>
  );
});

export default SectionHeader;
