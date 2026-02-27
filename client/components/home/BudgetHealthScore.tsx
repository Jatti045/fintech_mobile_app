import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useBudgets, useTheme } from "@/hooks/useRedux";

/**
 * Budget Discipline Card — computes a 0–100 score based on how well the user
 * stuck to each budget category and presents it as a compact, glanceable card.
 *
 * Scoring logic (per budget):
 *   ≤ 50% used → 100 pts (great discipline)
 *   51-80%     → 80 pts (good)
 *   81-100%    → 60 pts (on-track but tight)
 *   101-120%   → 30 pts (slightly over)
 *   > 120%     → 0 pts (over budget)
 *
 * The final score is the weighted average across all budgets.
 */
export default function BudgetHealthScore() {
  const { THEME } = useTheme();
  const budgets = useBudgets();

  if (budgets.length === 0) return null;

  const scoreForBudget = (spent: number, limit: number): number => {
    if (limit <= 0) return 50;
    const ratio = spent / limit;
    if (ratio <= 0.5) return 100;
    if (ratio <= 0.8) return 80;
    if (ratio <= 1.0) return 60;
    if (ratio <= 1.2) return 30;
    return 0;
  };

  const totalScore = budgets.reduce(
    (sum, b) =>
      sum + scoreForBudget(Number(b.spent || 0), Number(b.limit || 0)),
    0,
  );
  const score = Math.round(totalScore / budgets.length);

  const getScoreColor = (): string => {
    if (score >= 75) return THEME.success ?? "#22c55e";
    if (score >= 50) return THEME.warning ?? "#eab308";
    return THEME.danger;
  };

  const getGradient = (): [string, string] => {
    if (score >= 75) return [THEME.primary, THEME.secondary];
    if (score >= 50) return [THEME.warning ?? "#eab308", THEME.primary];
    return [THEME.danger, THEME.warning ?? "#eab308"];
  };

  const getIcon = (): keyof typeof Feather.glyphMap => {
    if (score >= 75) return "trending-up";
    if (score >= 50) return "minus";
    return "trending-down";
  };

  const getLabel = (): string => {
    if (score >= 75) return "On Track";
    if (score >= 50) return "Watch Spending";
    if (score >= 30) return "Over Budget";
    return "Way Over Budget";
  };

  const getTip = (): string => {
    if (score >= 75) return "Great discipline — keep it up!";
    if (score >= 50) return "A few categories are running warm.";
    if (score >= 30) return "Try trimming non-essentials this week.";
    return "Consider revising your budget limits.";
  };

  const color = getScoreColor();
  const barPct = Math.max(0, Math.min(100, score));

  // Count how many budgets are in good / warning / danger territory
  const onTrack = budgets.filter(
    (b) => scoreForBudget(Number(b.spent || 0), Number(b.limit || 0)) >= 60,
  ).length;
  const overBudget = budgets.length - onTrack;

  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          Spending Discipline
        </Text>

        {/* Score badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: color + "18",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 20,
          }}
        >
          <Feather
            name={getIcon()}
            size={14}
            color={color}
            style={{ marginRight: 4 }}
          />
          <Text style={{ color, fontWeight: "700", fontSize: 13 }}>
            {score}/100
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 10,
          backgroundColor: THEME.border,
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <LinearGradient
          colors={getGradient() as any}
          start={[0, 0]}
          end={[1, 0]}
          style={{
            width: `${barPct}%`,
            height: "100%",
            borderRadius: 999,
          }}
        />
      </View>

      {/* Status + tip */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color, fontWeight: "700", fontSize: 14 }}>
            {getLabel()}
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginTop: 2,
              lineHeight: 17,
            }}
          >
            {getTip()}
          </Text>
        </View>

        {/* Mini stats */}
        <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 11,
            }}
          >
            {onTrack} on track
          </Text>
          {overBudget > 0 && (
            <Text
              style={{
                color: THEME.danger,
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {overBudget} over
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
