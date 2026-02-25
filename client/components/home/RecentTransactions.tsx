import React from "react";
import { View, Text } from "react-native";
import { formatCurrency } from "@/utils/helper";

type Props = {
  THEME: any;
  /** Pre-sorted, pre-sliced list of recent transactions to display. */
  transactions: any[];
};

/**
 * Scrollable list of recent transactions showing name, category, date, and
 * amount. Expects the parent to own sorting and slicing.
 */
export default function RecentTransactions({ THEME, transactions }: Props) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 16,
          fontWeight: "800",
          marginBottom: 8,
        }}
      >
        Recent Transactions
      </Text>

      {transactions.length === 0 ? (
        <Text style={{ color: THEME.textSecondary }}>
          No recent transactions.
        </Text>
      ) : (
        transactions.map((r: any) => (
          <View
            key={r.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 12,
              backgroundColor: THEME.surface,
              borderRadius: 12,
              marginBottom: 8,
            }}
          >
            <View>
              <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                {r.name}
              </Text>
              <Text style={{ color: THEME.textSecondary }}>
                {r.category} • {new Date(r.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
              {formatCurrency(Number(r.amount || 0))}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
