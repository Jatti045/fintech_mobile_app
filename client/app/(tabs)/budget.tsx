import React, { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import MaskedView from "@react-native-masked-view/masked-view";
import BudgetModal from "@/components/budget/BudgetModal";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import { IBudget } from "@/store/slices/budgetSlice";

/**
 * Safely coerces a possibly-string or undefined value to a finite number.
 * Returns `0` for NaN / Infinity / undefined / null — never throws.
 */
function safeAmount(raw: number | string | undefined | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes the overspend delta using **integer-cent math** to prevent
 * floating-point drift (e.g. `150.10 - 100.20` → `49.90`, not `49.900000…01`).
 *
 * @returns The absolute difference in dollars, safe for display.
 */
function overspendDeltaCents(
  limitRaw: number | string,
  spentRaw: number | string,
): number {
  const limitCents = Math.round(safeAmount(limitRaw) * 100);
  const spentCents = Math.round(safeAmount(spentRaw) * 100);
  return Math.abs(limitCents - spentCents) / 100;
}

// ─── Memoised sub-components ────────────────────────────────────────────────

/** Props for a single budget card. */
interface BudgetCardProps {
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
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onEdit(budget)}
      onLongPress={() => onDelete(budget.id)}
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
  );
});

/**
 * Gradient-masked empty-state message shown when no budgets exist
 * for the selected month. Wrapped in `React.memo` — the colours rarely change.
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState({
  primary,
  secondary,
  textPrimary,
  textSecondary,
}: {
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <View className="flex-1 justify-center items-center px-6 pt-12">
      <MaskedView
        maskElement={
          <Text
            className="text-3xl font-extrabold text-center"
            style={{ color: textPrimary }}
          >
            No budgets for this month
          </Text>
        }
      >
        <LinearGradient
          colors={[primary, secondary]}
          start={[0, 0]}
          end={[1, 1]}
        >
          {/* Text is invisible but used to size the mask */}
          <Text
            className="text-3xl font-extrabold text-center"
            style={{ opacity: 0 }}
          >
            No budgets for this month
          </Text>
        </LinearGradient>
      </MaskedView>

      <Text
        className="text-center mt-4 text-base"
        style={{ color: textSecondary }}
      >
        Create budgets to track spending by category for the selected month. Tap
        "New Budget" to get started.
      </Text>
    </View>
  );
});

/**
 * Floating action button to create a new budget.
 * Wrapped in `React.memo` so it doesn't re-render on parent state changes.
 */
const NewBudgetButton = React.memo(function NewBudgetButton({
  onPress,
  primary,
  secondary,
  textPrimary,
}: {
  onPress: () => void;
  primary: string;
  secondary: string;
  textPrimary: string;
}) {
  return (
    <View className="absolute bottom-0 right-0 p-4">
      <TouchableOpacity onPress={onPress}>
        <LinearGradient
          colors={[primary, secondary]}
          start={[0, 0]}
          end={[1, 1]}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 1000,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 16,
            elevation: 16,
          }}
        >
          <View className="items-center justify-center flex-row gap-1">
            <Feather name="plus" size={24} color={textPrimary} />
            <Text
              style={{ color: textPrimary }}
              className="font-bold text-base"
            >
              New Budget
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

// ─── Main Screen Component ──────────────────────────────────────────────────

export default function BudgetScreen() {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const budgets = useBudgets();
  const { THEME } = useTheme();

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside BudgetModal.
  const { handleDeleteBudget } = useBudgetOperations();

  // ── Screen-level state ────────────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingBudget, setEditingBudget] = useState<IBudget | null>(null);

  // ── Stable callbacks ──────────────────────────────────────────────────

  /** Open the modal in edit mode for the given budget. */
  const handleEditPress = useCallback((budget: IBudget) => {
    setEditingBudget(budget);
    setOpenSheet(true);
  }, []);

  /** Clear editing state when the modal closes. */
  const handleModalClose = useCallback(() => {
    setOpenSheet(false);
    setEditingBudget(null);
  }, []);

  /** Open the modal in create mode. */
  const handleNewBudget = useCallback(() => {
    setOpenSheet(true);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  const hasBudgets = budgets && budgets.length > 0;

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      <ScrollView>
        <View className="flex-1 px-4" style={{ paddingTop: 18 }}>
          {/* Header */}
          <View style={{ marginBottom: 12 }}>
            <Text
              className="text-2xl text-center font-bold mb-2"
              style={{ color: THEME.textPrimary }}
            >
              Budgets
            </Text>
          </View>

          {/* Budget cards or empty state */}
          {hasBudgets ? (
            budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={handleEditPress}
                onDelete={handleDeleteBudget}
                surface={THEME.surface}
                border={THEME.border}
                background={THEME.background}
                primary={THEME.primary}
                secondary={THEME.secondary}
                textPrimary={THEME.textPrimary}
                textSecondary={THEME.textSecondary}
                danger={THEME.danger}
              />
            ))
          ) : (
            <EmptyBudgetState
              primary={THEME.primary}
              secondary={THEME.secondary}
              textPrimary={THEME.textPrimary}
              textSecondary={THEME.textSecondary}
            />
          )}
        </View>
      </ScrollView>

      {/* Floating action button */}
      <NewBudgetButton
        onPress={handleNewBudget}
        primary={THEME.primary}
        secondary={THEME.secondary}
        textPrimary={THEME.textPrimary}
      />

      {/* Create / Edit modal — self-contained via useBudgetOperations */}
      <BudgetModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        editingBudget={editingBudget}
        onClose={handleModalClose}
      />
    </SafeAreaView>
  );
}
