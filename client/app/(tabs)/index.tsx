import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View } from "react-native";
import { useAppDispatch } from "@/store";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import {
  useTheme,
  useTransactions,
  useBudgets,
  useCalendar,
  useTransactionMonthSummary,
  useTransactionStatus,
  useBudgetStatus,
} from "@/hooks/useRedux";
import { HomeSkeleton } from "@/components/skeleton/SkeletonLoader";
import { useThemedAlert } from "@/utils/themedAlert";
import CreateTransactionModal from "@/components/transaction/transactionModal";
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

  // ── Derived state ────────────────────────────────────────────────────────────

  const monthStartDate = useMemo(
    () => new Date(calendar.year, calendar.month, 1),
    [calendar.year, calendar.month],
  );

  /** Pre-formatted label passed to MonthSelector to avoid prop-drilling a Date. */
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

  /** Budgets that belong to the currently selected month/year. */
  const filteredBudgets = useMemo(
    () =>
      budgets.filter((b: any) => {
        try {
          const d = new Date(b.createdAt);
          return (
            d.getMonth() === calendar.month && d.getFullYear() === calendar.year
          );
        } catch {
          return false;
        }
      }),
    [budgets, calendar.month, calendar.year],
  );

  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getMonth() && calendar.year === now.getFullYear();

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Guard: a budget must exist for the month before a transaction can be added. */
  const handleNewTransaction = () => {
    if (filteredBudgets.length === 0) {
      showAlert({
        title: "No budgets available",
        message:
          "No budgets exist for this month. Please create a budget first.",
      });
      return;
    }
    setOpenTxModal(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  // Show skeleton loader during initial data fetch
  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={{ flex: 1, backgroundColor: THEME.background }}
      >
        <HomeSkeleton THEME={THEME} />
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
      >
        <HomeHeader THEME={THEME} onInfoPress={() => setHelpOpen(true)} />

        <MonthSelector
          THEME={THEME}
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
          onPrev={() => dispatch(prevMonth())}
          onNext={() => dispatch(nextMonth())}
        />

        <SpentThisMonthCard THEME={THEME} total={expenseTotal} />

        <QuickActions
          THEME={THEME}
          onNewTransaction={handleNewTransaction}
          onNewBudget={() => setOpenBudgetModal(true)}
        />

        <BudgetSummary THEME={THEME} budgets={filteredBudgets} />

        <TopCategoriesChart
          label="Top Categories"
          THEME={THEME}
          totals={categoryTotals}
          budgets={filteredBudgets}
        />

        <RecentTransactions THEME={THEME} transactions={recentTransactions} />

        <TipOfTheDay THEME={THEME} />

        {/* Bottom padding so the last card clears the tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals ─────────────────────────────────────────────────────────────── */}
      <CreateTransactionModal
        openSheet={openTxModal}
        setOpenSheet={setOpenTxModal}
        budgets={filteredBudgets}
      />
      <BudgetModal
        openSheet={openBudgetModal}
        setOpenSheet={setOpenBudgetModal}
      />
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
