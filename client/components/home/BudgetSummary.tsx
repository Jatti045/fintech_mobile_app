import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency } from "@/utils/helper";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import type { IBudget } from "@/types/budget/types";

/**
 * Compact list of up to 3 budgets for the month, each with a spend/limit
 * ratio and a colour-coded progress bar (red when over budget).
 */
export default function BudgetSummary() {
  const { THEME } = useTheme();
  const budgets = useBudgets();
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
        Budget Summary
      </Text>

      {budgets.length === 0 ? (
        <Text style={{ color: THEME.textSecondary }}>
          No budgets for this month.
        </Text>
      ) : (
        budgets.slice(0, 3).map((b: any) => {
          const spent = Number(b.spent || 0);
          const limit = Number(b.limit || 0);
          const ratio = limit > 0 ? Math.max(0, Math.min(1, spent / limit)) : 0;
          const pct = Math.round(ratio * 100);
          const overspent = limit > 0 && spent > limit;

          return (
            <View
              key={b.id}
              style={{
                backgroundColor: THEME.surface,
                padding: 12,
                borderRadius: 12,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                  {b.category}
                </Text>
                <Text style={{ color: THEME.textSecondary }}>
                  {formatCurrency(spent)} / {formatCurrency(limit)}
                </Text>
              </View>

              {/* Progress bar */}
              <View
                style={{
                  height: 8,
                  backgroundColor: THEME.border,
                  borderRadius: 999,
                  overflow: "hidden",
                  marginTop: 8,
                }}
              >
                <View style={{ width: `${pct}%`, height: "100%" }}>
                  <LinearGradient
                    colors={
                      overspent
                        ? [THEME.danger, THEME.danger]
                        : [THEME.primary, THEME.secondary]
                    }
                    start={[0, 0]}
                    end={[1, 0]}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
