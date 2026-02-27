import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, useCalendar } from "@/hooks/useRedux";
import { getTransactionsCache } from "@/utils/cache";
import { formatCurrency } from "@/utils/helper";

type Comparison = {
  category: string;
  currentTotal: number;
  previousTotal: number;
  /** Positive = spent more, negative = spent less. */
  pctChange: number;
};

/**
 * Category Comparison — shows how each category's spend changed compared to
 * the previous month. Only categories present in both months are shown.
 * Data is pulled from the AsyncStorage transaction cache.
 */
export default function CategoryComparison({
  categoryTotals,
}: {
  categoryTotals: Record<string, number>;
}) {
  const { THEME } = useTheme();
  const calendar = useCalendar();
  const [comparisons, setComparisons] = useState<Comparison[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Determine previous month/year
      let prevMonth = calendar.month - 1;
      let prevYear = calendar.year;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }

      const prevTx = (await getTransactionsCache(prevYear, prevMonth)) ?? [];

      // Build previous month category totals
      const prevTotals: Record<string, number> = {};
      prevTx.forEach((t: any) => {
        if ((t.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") return;
        const cat = String(t.category || "Uncategorized");
        prevTotals[cat] = (prevTotals[cat] || 0) + Number(t.amount || 0);
      });

      // Compare overlapping categories
      const result: Comparison[] = [];
      for (const [cat, currentTotal] of Object.entries(categoryTotals)) {
        const previousTotal = prevTotals[cat];
        if (previousTotal === undefined || previousTotal === 0) continue;

        const pctChange =
          ((currentTotal - previousTotal) / previousTotal) * 100;
        result.push({ category: cat, currentTotal, previousTotal, pctChange });
      }

      // Sort by absolute change (biggest first)
      result.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));

      if (!cancelled) setComparisons(result.slice(0, 5));
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryTotals, calendar.month, calendar.year]);

  if (comparisons.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderColor: THEME.border,
        borderWidth: 1,
      }}
    >
      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "800",
          fontSize: 16,
          marginBottom: 12,
        }}
      >
        vs. Last Month
      </Text>

      {comparisons.map((c) => {
        const isUp = c.pctChange > 0;
        const arrow = isUp ? "trending-up" : "trending-down";
        const color = isUp ? THEME.danger : (THEME.success ?? "#22c55e");
        const pctLabel = `${isUp ? "+" : ""}${Math.round(c.pctChange)}%`;

        return (
          <View
            key={c.category}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: THEME.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: THEME.textPrimary, fontWeight: "700" }}
                numberOfLines={1}
              >
                {c.category}
              </Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                {formatCurrency(c.previousTotal)} →{" "}
                {formatCurrency(c.currentTotal)}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 8,
              }}
            >
              <Feather name={arrow as any} size={16} color={color} />
              <Text
                style={{
                  color,
                  fontWeight: "700",
                  marginLeft: 4,
                  fontSize: 14,
                }}
              >
                {pctLabel}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
