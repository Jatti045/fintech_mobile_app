import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import {
  safeAmount,
  overspendDeltaCents,
} from "@/utils/budget/budgetCalculations";
import type { IBudget } from "@/types/budget/types";
import { hapticLight, hapticHeavy } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";

/** Props for a single budget card. */
export interface BudgetCardProps {
  budget: IBudget;
  onEdit: (budget: IBudget) => void;
  onDelete: (id: string) => void;
  surface: string;
  border: string;
  background: string;
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
}

/**
 * A single budget card with icon, progress bar, overspend badge, and warning text.
 *
 * Financial calculations (ratio, percent, overspend) use integer-cent math
 * to avoid floating-point drift. Wrapped in `React.memo` so it only
 * re-renders when its own props change.
 */
const BudgetCard = React.memo(function BudgetCard({
  budget,
  onEdit,
  onDelete,
  surface,
  border,
  background,
  primary,
  secondary,
  textPrimary,
  textSecondary,
  danger,
}: BudgetCardProps) {
  const limit = safeAmount(budget.limit);
  const spent = safeAmount(budget.spent);

  /** Spend ratio clamped to [0, 1] for the progress bar width. */
  const ratio = limit > 0 ? Math.max(0, Math.min(1, spent / limit)) : 0;

  /** Integer percentage for display (avoids "33.33333…%"). */
  const percent = Math.round(ratio * 100);

  /** Whether spending has exceeded the budget limit. */
  const overspent = spent > limit && limit > 0;

  return (
    <SwipeableRow
      onDelete={() => onDelete(budget.id)}
      dangerColor={danger}
      actionStyle={{ marginBottom: 16, borderRadius: 16 }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          hapticLight();
          onEdit(budget);
        }}
        onLongPress={() => {
          hapticHeavy();
          onDelete(budget.id);
        }}
      >
        <View
          style={{
            backgroundColor: surface,
            borderColor: border,
            borderWidth: 1,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 6,
          }}
          className="p-4 mb-4 rounded-2xl"
        >
          {/* Top row: category / limit / spent + icon / percent */}
          <View className="flex-row justify-between items-start">
            <View style={{ flex: 1 }}>
              <Text style={{ color: textSecondary }} className="text-sm">
                {capitalizeFirst(budget.category)}
              </Text>
              <Text
                style={{ color: textPrimary }}
                className="text-2xl font-extrabold mt-1"
              >
                {formatCurrency(limit)}
              </Text>
              <View className="flex-row items-center mt-2">
                <Text
                  style={{ color: overspent ? danger : textSecondary }}
                  className="text-sm"
                >
                  Spent {formatCurrency(spent)}
                </Text>
                {overspent && (
                  <View
                    className="ml-3 px-2 py-1 rounded-full"
                    style={{ backgroundColor: danger }}
                  >
                    <Text
                      style={{ color: textPrimary }}
                      className="text-xs font-bold"
                    >
                      Over
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="items-center ml-4">
              <Feather
                name={budget.icon as keyof typeof Feather.glyphMap}
                size={64}
                color={secondary}
              />
              <View
                className="mt-2 px-2 py-1 rounded-md"
                style={{
                  backgroundColor: overspent ? "#FFF6F6" : background,
                }}
              >
                <Text
                  style={{ color: overspent ? danger : textSecondary }}
                  className="font-bold"
                >
                  {percent}%
                </Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View
            className="mt-4 rounded-full overflow-hidden"
            style={{ backgroundColor: border, height: 12 }}
          >
            <View style={{ flexDirection: "row", width: "100%", height: 12 }}>
              <LinearGradient
                colors={overspent ? [danger, danger] : [primary, secondary]}
                start={[0, 0]}
                end={[1, 0]}
                style={{ flex: ratio }}
              />
              <View style={{ flex: 1 - ratio }} />
            </View>
          </View>

          {/* Warning text when overspent */}
          {overspent && (
            <View className="mt-3 flex-row items-center">
              <Feather name="alert-circle" size={18} color={danger} />
              <Text className="ml-2" style={{ color: danger }}>
                You have exceeded this budget by{" "}
                {formatCurrency(overspendDeltaCents(limit, spent))}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </SwipeableRow>
  );
});

export default BudgetCard;
