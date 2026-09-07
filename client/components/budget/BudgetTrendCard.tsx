import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import {
  budgetPace,
  buildMonthSpendSeries,
  daysInMonth,
  todayDayOfMonth,
} from "@/utils/budget/budgetCalculations";
import type { ITransaction } from "@/types/transaction/types";
import GlassPanel from "@/components/global/GlassPanel";

export interface BudgetTrendCardProps {
  category: string;
  budgetId?: string | null;
  displayLimit?: number;
  displaySpent?: number;
  currencyCode?: string;
  transactions: ITransaction[];
  month: number;
  year: number;
}

const CHART_HEIGHT = 96;
const PAD_X = 8;
const PAD_Y = 14;

function buildLinePath(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/**
 * The oscilloscope — a per-channel cumulative spend curve over the month,
 * with a dashed even-burn plan line, a “today” marker and the remaining /
 * daily-left / burn-rate vitals. Re-renders per selected budget.
 */
const BudgetTrendCard = React.memo(function BudgetTrendCard({
  category,
  budgetId,
  displayLimit,
  displaySpent,
  currencyCode = "USD",
  transactions,
  month,
  year,
}: BudgetTrendCardProps) {
  const { THEME } = useTheme();
  const [width, setWidth] = useState(0);

  const limit = safeAmount(displayLimit);
  const spent = safeAmount(displaySpent);
  const totalDays = daysInMonth(month, year);
  const now = new Date();
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;
  const todayDay = Math.min(todayDayOfMonth(), totalDays);

  const { series, planPath, curvePath, areaPath, todayX, lastPoint } = useMemo(() => {
    const s = buildMonthSpendSeries(transactions, {
      category,
      budgetId: budgetId ?? null,
      month,
      year,
    });

    const maxVal = Math.max(spent, limit, 1) * 1.18 || 1;
    const chartW = Math.max(width, 2);
    const toX = (dayIndex: number) =>
      PAD_X + (dayIndex / Math.max(1, totalDays - 1)) * (chartW - PAD_X * 2);
    const toY = (v: number) =>
      CHART_HEIGHT -
      PAD_Y -
      Math.max(0, Math.min(1, v / maxVal)) * (CHART_HEIGHT - PAD_Y * 2);

    const curvePoints = s.map((p) => ({ x: toX(p.day - 1), y: toY(p.cumulative) }));
    const planPoints = s.map((p) => ({
      x: toX(p.day - 1),
      y: toY((limit / Math.max(1, totalDays)) * p.day),
    }));

    const curvePath = buildLinePath(curvePoints);
    const planPath = buildLinePath(planPoints);
    const areaPath =
      curvePoints.length > 0
        ? `${curvePath} L ${toX(totalDays - 1)} ${PAD_Y} L ${toX(0)} ${PAD_Y} Z`
        : "";

    return {
      series: s,
      planPath,
      curvePath,
      areaPath,
      todayX: isCurrentMonth ? toX(todayDay - 1) : null,
      lastPoint: curvePoints.length > 0 ? curvePoints[curvePoints.length - 1] : null,
    };
  }, [
    transactions, category, budgetId, month, year,
    spent, limit, totalDays, isCurrentMonth, todayDay, width,
  ]);

  const pace = budgetPace({
    limit,
    spent,
    isCurrentMonth,
    todayDay: todayDay,
    totalDays,
  });
  const pctUsedLabel = limit > 0 ? `${Math.round(pace.pctUsed * 100)}%` : null;
  const statusLabel: Record<string, string> = {
    idle: "No limit set",
    on_track: "On track",
    at_risk: "At risk",
    over: "Over budget",
  };
  const statusColor: Record<string, string> = {
    idle: THEME.textSecondary,
    on_track: THEME.success,
    at_risk: THEME.warning,
    over: THEME.danger,
  };

  const overspent = pace.overspent;
  const hasActivity = series.some((p) => p.cumulative > 0);
  const progressRatio = limit > 0 ? Math.min(1, spent / limit) : 0;

  const activeColor = overspent ? THEME.danger : THEME.primary;
  const activeGradient: [string, string] = overspent
    ? [THEME.danger, THEME.warning]
    : [THEME.primary, THEME.secondary];

  return (
    <GlassPanel padding={14} radius={20} style={{ marginBottom: 16 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: activeColor,
              marginRight: 8,
            }}
          />
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 13,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
            numberOfLines={1}
          >
            {category}
          </Text>
        </View>
        <Text
          style={{
            color: statusColor[pace.status],
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {statusLabel[pace.status]}
        </Text>
      </View>

      {/* Spent vs limit + progress bar */}
      <View style={{ marginBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 15,
              fontWeight: "800",
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(spent, currencyCode)}
            {limit > 0 ? (
              <Text
                style={{ color: THEME.textSecondary, fontWeight: "600" }}
              >
                {" "}
                of {formatCurrency(limit, currencyCode)}
              </Text>
            ) : null}
          </Text>
          {pctUsedLabel ? (
            <Text
              style={{
                color: statusColor[pace.status],
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {pctUsedLabel} used
            </Text>
          ) : null}
        </View>
        {limit > 0 ? (
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: hexToRgba(THEME.border, 0.6),
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${Math.round(progressRatio * 100)}%` as any,
                backgroundColor:
                  pace.status === "over"
                    ? THEME.danger
                    : pace.status === "at_risk"
                      ? THEME.warning
                      : THEME.primary,
              }}
            />
          </View>
        ) : null}
      </View>

{/* Chart */}
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: CHART_HEIGHT,
          backgroundColor: hexToRgba(THEME.border, 0.3),
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={activeGradient[0]} />
                <Stop offset="1" stopColor={activeGradient[1]} />
              </SvgLinearGradient>
              <SvgLinearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={hexToRgba(activeColor, 0.2)} />
                <Stop offset="1" stopColor={hexToRgba(activeColor, 0)} />
              </SvgLinearGradient>
            </Defs>

            {/* Plan rail (dashed) */}
            <Path
              d={planPath}
              stroke={THEME.textDisabled}
              strokeWidth={1.4}
              strokeDasharray="4 6"
              fill="none"
              opacity={0.7}
            />

            {/* Area under the curve */}
            {hasActivity && areaPath ? (
              <Path d={areaPath} stroke="none" fill="url(#trend-area)" />
            ) : null}

            {/* Actual spend curve */}
            <Path
              d={curvePath}
              stroke="url(#trend-stroke)"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* End-of-curve node */}
            {hasActivity && lastPoint ? (
              <Circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={3.5}
                fill={activeGradient[1]}
              />
            ) : null}

            {/* Today marker */}
            {todayX != null && (
              <Line
                x1={todayX}
                y1={4}
                x2={todayX}
                y2={CHART_HEIGHT - 4}
                stroke={THEME.textSecondary}
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.8}
              />
            )}
          </Svg>
        )}

        {!hasActivity && spent <= 0 ? (
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.noData}>
              <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                No spending in this channel yet
              </Text>
            </View>
          </View>
        ) : null}
      </View>

{/* Vitals */}
      <View style={{ flexDirection: "row", marginTop: 12, gap: 10 }}>
        <TrendTile
          label="Remaining"
          value={
            overspent
              ? `Over ${formatCurrency(Math.abs(spent - limit), currencyCode)}`
              : formatCurrency(pace.remaining, currencyCode)
          }
          accent={overspent ? THEME.danger : THEME.success}
        />
        <TrendTile
          label="Projected"
          value={formatCurrency(pace.projectedSpend, currencyCode)}
          accent={
            limit > 0 && pace.projectedSpend > limit
              ? THEME.danger
              : THEME.textPrimary
          }
        />
        <TrendTile
          label="Daily left"
          value={
            pace.dailyLeft == null
              ? "—"
              : formatCurrency(pace.dailyLeft, currencyCode)
          }
          accent={pace.dailyLeft != null && pace.dailyLeft <= 0 ? THEME.danger : THEME.textPrimary}
        />
      </View>
    </GlassPanel>
  );
});

function TrendTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const { THEME } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent,
          fontSize: 14,
          fontWeight: "800",
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noData: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default BudgetTrendCard;