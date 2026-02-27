import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useBudgets,
  useTheme,
  useBudgetStatus,
  useCalendar,
} from "@/hooks/useRedux";
import { useAppDispatch } from "@/store";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import {
  BudgetCard,
  BudgetModal,
  EmptyBudgetState,
  NewBudgetButton,
} from "@/components/budget";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import type { IBudget } from "@/types/budget/types";
import { BudgetSkeleton } from "@/components/skeleton/SkeletonLoader";

// ─── Main Screen Component ──────────────────────────────────────────────────

export default function BudgetScreen() {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const budgets = useBudgets();
  const { THEME } = useTheme();
  const { isLoading } = useBudgetStatus();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside BudgetModal.
  const { handleDeleteBudget } = useBudgetOperations();

  /** Show skeleton while initial data is loading (budgets empty + loading) */
  const isInitialLoading = isLoading && budgets.length === 0;

  // ── Screen-level state ────────────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingBudget, setEditingBudget] = useState<IBudget | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(
        fetchBudgets({
          currentMonth: calendar.month,
          currentYear: calendar.year,
        }),
      );
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, calendar.month, calendar.year]);

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

  // Show skeleton loader during initial data fetch
  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        className="flex-1"
        style={{ backgroundColor: THEME.background }}
      >
        <BudgetSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
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
