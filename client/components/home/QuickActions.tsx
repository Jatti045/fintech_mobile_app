import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  THEME: any;
  /** Called after the guard check passes (budget exists for this month). */
  onNewTransaction: () => void;
  onNewBudget: () => void;
};

/**
 * Two-button row for the most common actions: add transaction / add budget.
 * The parent is responsible for any guard logic before calling onNewTransaction.
 */
export default function QuickActions({
  THEME,
  onNewTransaction,
  onNewBudget,
}: Props) {
  return (
    <View>
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 16,
          fontWeight: "800",
          marginBottom: 8,
        }}
      >
        Quick Actions
      </Text>

      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            marginRight: 8,
            backgroundColor: THEME.surface,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
          }}
          onPress={onNewTransaction}
        >
          <MaterialIcons name="payment" size={22} color={THEME.primary} />
          <Text style={{ color: THEME.textPrimary, marginTop: 8 }}>
            New Transaction
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            marginLeft: 8,
            backgroundColor: THEME.surface,
            padding: 12,
            borderRadius: 12,
            alignItems: "center",
          }}
          onPress={onNewBudget}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={22}
            color={THEME.primary}
          />
          <Text style={{ color: THEME.textPrimary, marginTop: 8 }}>
            New Budget
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
