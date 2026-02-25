import React, { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { View, Text } from "react-native";
import { formatCurrency } from "@/utils/helper";

export const TopCategoriesChart = React.memo(
  ({ label, THEME, totals, budgets }: any) => {
    // Sort categories by total spent and take top 5
    const entries = Object.entries(totals).sort(
      (a: any, b: any) => b[1] - a[1],
    );
    const top = entries.slice(0, 5);
    const total = entries.reduce((s: number, e: any) => s + e[1], 0) || 1;

    const budgetLimitByCategory = useMemo(() => {
      const map = new Map<string, number>();
      for (const b of budgets) {
        const key = String(b.category ?? "").toLowerCase();
        map.set(key, (map.get(key) ?? 0) + Number(b.limit ?? 0));
      }
      return map;
    }, [budgets]);

    // Helper: find total budget limit for a given category (case-insensitive match)
    const getBudgetLimitForCategory = (category: string) =>
      budgetLimitByCategory.get(category.toLowerCase()) ?? 0;

    return (
      <View
        style={{
          backgroundColor: THEME.surface,
          borderRadius: 12,
          padding: 12,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: THEME.textPrimary,
            fontWeight: "700",
            fontSize: 16,
            alignSelf: "flex-start",
            marginBottom: 8,
          }}
        >
          {label}
        </Text>

        {top.length === 0 ? (
          <Text style={{ color: THEME.textSecondary }}>No categories yet</Text>
        ) : (
          <View className="w-full">
            {top.map(([cat, value]: any, idx: number) => {
              const spent = Number(value || 0);
              const budgetLimit = getBudgetLimitForCategory(cat);
              // percent: if budget exists, percent of budget; otherwise percent of total spending
              const rawPct =
                budgetLimit > 0
                  ? (spent / budgetLimit) * 100
                  : (spent / total) * 100;
              const pct = Math.round(rawPct);
              const barPct = Math.max(0, Math.min(100, Math.round(rawPct)));
              const gradientColors =
                idx % 2 === 0
                  ? [THEME.primary, THEME.secondary]
                  : [THEME.secondary, THEME.primary];
              return (
                <View key={cat} style={{ marginBottom: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ color: THEME.textPrimary, fontWeight: "700" }}
                    >
                      {cat}
                    </Text>
                    <Text style={{ color: THEME.textSecondary }}>
                      {formatCurrency(spent)} • {pct}%
                      {budgetLimit > 0 ? "" : " of spend"}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 14,
                      backgroundColor: THEME.border,
                      borderRadius: 999,
                      overflow: "hidden",
                      marginTop: 8,
                    }}
                  >
                    <LinearGradient
                      colors={gradientColors as any}
                      start={[0, 0]}
                      end={[1, 0]}
                      style={{ width: `${barPct}%`, height: "100%" }}
                    />
                  </View>
                </View>
              );
            })}
            {entries.length > 5 && (
              <Text style={{ color: THEME.textSecondary, marginTop: 6 }}>
                +{entries.length - 5} more
              </Text>
            )}
          </View>
        )}
      </View>
    );
  },
);
