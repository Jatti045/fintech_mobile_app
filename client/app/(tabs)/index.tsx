import React, { useCallback, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { useAppDispatch } from "@/store";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { HomeSkeleton } from "@/components/skeleton/SkeletonLoader";
import { useThemedAlert } from "@/utils/themedAlert";
import TransactionModal from "@/components/transaction/TxModal";
import BudgetModal from "@/components/budget/BudgetModal";
import InformationModal from "@/components/home/informationModal";
import { TopCategoriesChart } from "@/components/home/TopCategoriesChart";
import HomeHeader from "@/components/home/HomeHeader";
import MonthSelector from "@/components/home/MonthSelector";
import SpentThisMonthCard from "@/components/home/SpentThisMonthCard";
import QuickActions from "@/components/home/QuickActions";
import BudgetSummary from "@/components/home/BudgetSummary";
import RecentTransactions from "@/components/home/RecentTransactions";
import TipOfTheDay from "@/components/home/TipOfTheDay";
import BudgetHealthScore from "@/components/home/BudgetHealthScore";
import SpendingTrends from "@/components/home/SpendingTrends";
import CategoryComparison from "@/components/home/CategoryComparison";
import {
  useTheme,
  useTransactions,
  useBudgets,
  useCalendar,
  useTransactionMonthSummary,
  useTransactionStatus,
  useBudgetStatus,
} from "@/hooks/useRedux";

export default function Index() {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const calendar = useCalendar();
  const monthSummary = useTransactionMonthSummary();
  const dispatch = useAppDispatch();
  const { isLoading: isTransactionsLoading } = useTransactionStatus();
  const { isLoading: isBudgetsLoading } = useBudgetStatus();

  /** Show skeleton while initial data is loading (both transactions and budgets empty + loading) */
  const isInitialLoading =
    (isTransactionsLoading || isBudgetsLoading) &&
    transactions.length === 0 &&
    budgets.length === 0;

  const [helpOpen, setHelpOpen] = useState(false);
  const [openTxModal, setOpenTxModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(
          fetchTransaction({
            searchQuery: "",
            currentMonth: calendar.month,
            currentYear: calendar.year,
            page: 1,
            limit: 10,
            useCache: false,
          }),
        ),
        dispatch(
          fetchBudgets({
            currentMonth: calendar.month,
            currentYear: calendar.year,
          }),
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, calendar.month, calendar.year]);

  const monthStartDate = useMemo(
    () => new Date(calendar.year, calendar.month, 1),
    [calendar.year, calendar.month],
  );

  const monthLabel = useMemo(
    () =>
      `${monthStartDate.toLocaleString(undefined, { month: "long" })} ${calendar.year}`,
    [monthStartDate, calendar.year],
  );

  /** 5 most recent transactions across all months, sorted newest-first. */
  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .slice(0, 5),
    [transactions],
  );

  const expenseTotal = monthSummary.totalAmount || 0;

  /** Expense totals keyed by category — used by the TopCategoriesChart. */
  const categoryTotals: Record<string, number> = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach((t: any) => {
      const cat = String(t.category || "Uncategorized");
      if ((t.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
        totals[cat] = (totals[cat] || 0) + Number(t.amount || 0);
      }
    });
    return totals;
  }, [transactions]);

  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getMonth() && calendar.year === now.getFullYear();

  /* Guard: a budget must exist for the month before a transaction can be added. */
  const handleNewTransaction = () => {
    if (budgets.length === 0) {
      showAlert({
        title: "No budgets available",
        message:
          "No budgets exist for this month. Please create a budget first.",
      });
      return;
    }
    setOpenTxModal(true);
  };

  // Show skeleton loader during initial data fetch
  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={{ flex: 1, backgroundColor: THEME.background }}
      >
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        {/* Header with title and info button to open help modal */}
        <HomeHeader onInfoPress={() => setHelpOpen(true)} />

        {/* Month selector with chevron buttons to navigate back and forth */}
        <MonthSelector
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
          onPrev={() => dispatch(prevMonth())}
          onNext={() => dispatch(nextMonth())}
        />

        {/* Card showing total spent this month, with currency-aware formatting */}
        <SpentThisMonthCard total={expenseTotal} />

        {/* Quick action buttons for adding new transaction or budget */}
        <QuickActions
          onNewTransaction={handleNewTransaction}
          onNewBudget={() => setOpenBudgetModal(true)}
        />

        {/* Budget summary cards with progress bars for each category */}
        <BudgetSummary />

        {/* Budget health score gauge (0–100) */}
        <BudgetHealthScore />

        {/* Chart showing top spending categories for the month, with bars colored by budget ratio */}
        <TopCategoriesChart label="Top Categories" totals={categoryTotals} />

        {/* Category spend vs. last month comparison */}
        <CategoryComparison categoryTotals={categoryTotals} />

        {/* Bar chart showing spending totals for the last 6 months */}
        <SpendingTrends />

        {/* List of 5 most recent transactions across all months */}
        <RecentTransactions transactions={recentTransactions} />

        {/* Static tip of the day with financial advice */}
        <TipOfTheDay />

        {/* Extra spacing at bottom to ensure last item isn't cut off */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals */}
      <TransactionModal openSheet={openTxModal} setOpenSheet={setOpenTxModal} />
      <BudgetModal
        openSheet={openBudgetModal}
        setOpenSheet={setOpenBudgetModal}
      />
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
