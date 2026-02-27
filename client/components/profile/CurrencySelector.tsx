import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCurrencyByCode, DEFAULT_CURRENCY } from "@/constants/Currencies";
import type { CurrencySelectorProps } from "@/types/profile/types";

/**
 * The row that displays the current currency and opens the picker modal.
 */
export default function CurrencySelector({
  THEME,
  userCurrency,
  onPress,
}: CurrencySelectorProps) {
  const code = userCurrency || DEFAULT_CURRENCY;
  const currency = getCurrencyByCode(code);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ backgroundColor: THEME.surface }}
      className="p-4 rounded-xl mb-3"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="font-medium text-base mb-1"
          >
            Default Currency
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 18 }}>{currency?.flag}</Text>
            <Text style={{ color: THEME.textSecondary }}>
              {code} — {currency?.name}
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={THEME.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
}
