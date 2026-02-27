import React from "react";
import { View, Text } from "react-native";

import type { BankConnectionsProps } from "@/types/profile/types";

/**
 * Placeholder card for future bank-linking feature.
 */
export default function BankConnections({ THEME }: BankConnectionsProps) {
  return (
    <View className="mb-8">
      <Text
        style={{ color: THEME.textPrimary }}
        className="text-xl font-bold mb-4"
      >
        Bank Connections
      </Text>

      <View
        style={{ backgroundColor: THEME.surface }}
        className="p-6 rounded-xl"
      >
        <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
          Coming soon
        </Text>
        <Text style={{ color: THEME.textSecondary, marginTop: 8 }}>
          Bank linking will be available in a future update. When released,
          you'll be able to securely connect your bank accounts to import
          transactions automatically, reconcile balances, and categorize
          spending.
        </Text>
        <Text style={{ color: THEME.textSecondary, marginTop: 12 }}>
          For now, you can manually add transactions and budgets. We will
          announce bank connections and secure integrations in the app release
          notes.
        </Text>
      </View>
    </View>
  );
}
