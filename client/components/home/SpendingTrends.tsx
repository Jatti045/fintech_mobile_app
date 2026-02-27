import React, { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, useCalendar } from "@/hooks/useRedux";
import { getTransactionsCache } from "@/utils/cache";
import { formatCurrency } from "@/utils/helper";

/**
 * Month label from a 0-based month index.
 */
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type MonthDatum = {
  label: string;
  total: number;
};

/**
 * Spending Trends — a horizontal bar chart showing expense totals for the
 * last 6 months (or fewer if cache data is unavailable). Data is read from
 * the AsyncStorage transaction cache so no extra API calls are needed.
 */
export default function SpendingTrends() {
  const { THEME } = useTheme();
  const calendar = useCalendar();
  const [data, setData] = useState<MonthDatum[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const results: MonthDatum[] = [];
      let month = calendar.month;
      let year = calendar.year;

      // Walk back 6 months (including current)
      for (let i = 0; i < 6; i++) {
        const cached = await getTransactionsCache(year, month);
        const total =
          (cached ?? [])
            .filter(
              (t: any) => (t.type ?? "EXPENSE").toUpperCase() === "EXPENSE",
            )
            .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0) ||
          0;

        results.push({
          label: `${SHORT_MONTHS[month]} ${year}`,
          total,
        });

        // Step back one month
        month -= 1;
        if (month < 0) {
          month = 11;
          year -= 1;
        }
      }

      if (!cancelled) setData(results.reverse()); // oldest first
    })();

    return () => {
      cancelled = true;
    };
  }, [calendar.month, calendar.year]);

  const maxTotal = useMemo(
    () => Math.max(...data.map((d) => d.total), 1),
    [data],
  );

  // Don't render if there is no historical data at all
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) return null;

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
        Spending Trends
      </Text>

      {data.map((item, idx) => {
        const barPct = Math.max(
          0,
          Math.min(100, (item.total / maxTotal) * 100),
        );
        return (
          <View
            key={item.label}
            style={{ marginBottom: idx < data.length - 1 ? 10 : 0 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {item.label}
              </Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>
                {formatCurrency(item.total)}
              </Text>
            </View>
            <View
              style={{
                height: 10,
                backgroundColor: THEME.border,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              {item.total > 0 && (
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={[0, 0]}
                  end={[1, 0]}
                  style={{
                    width: `${barPct}%`,
                    height: "100%",
                    borderRadius: 999,
                  }}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
