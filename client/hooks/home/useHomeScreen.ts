import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAppDispatch,
  useCalendar,
  useUser,
} from "@/hooks/useRedux";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import {
  defaultTransactionArgs,
  useGetBudgetsQuery,
  useGetFinancialSummaryQuery,
  useGetRecurringPaymentsQuery,
  useGetTransactionsQuery,
} from "@/store/api/apiSlice";
import { useRefresh } from "@/hooks/useRefresh";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";
import { useBudgetDisplayAmounts } from "@/hooks/budget/useBudgetDisplayAmounts";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import type { IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";
import type { IRecurringPayment } from "@/types/recurring/types";
import {
  loadDismissedSeries,
  dismissSeries,
} from "@/utils/recurring/dismissedSeries";

/**
 * Stable empty-array fallbacks.
 *
 * The display-amount hooks run `setState` from effects keyed on these inputs,
 * so the fallbacks MUST be referentially stable — an inline `?? []` creates a
 * new array every render and, while RTK Query data is pending, produces an
 * infinite effect/render loop (the old slices had stable initial states).
 */
const NO_TRANSACTIONS: ITransaction[] = [];
const NO_BUDGETS: IBudget[] = [];

/**
 * Cohesive orchestration hook for the Home tab.
 *
 * Owns everything the screen needs that is neither global Redux state nor
 * pure presentation:
 *
 *  - month-scoped RTK Query subscriptions (transactions, budgets, summary).
 *    Subscribing is the only fetch mechanism — requests are deduped across
 *    all screens viewing the same month, and cache entries are keyed per
 *    month so navigation can never mix months.
 *  - backend-normalized financial aggregates
 *  - month metadata + calendar navigation handlers
 *  - modal state + the "budget required" transaction guard
 *
 * Contains no JSX. Global data stays in Redux; display transforms stay in
 * `useTransactionDisplayAmounts` / `useBudgetDisplayAmounts`.
 */
export const useHomeScreen = () => {
  const dispatch = useAppDispatch();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const calendar = useCalendar();

  const transactionsQuery = useGetTransactionsQuery({
    ...defaultTransactionArgs(calendar.month, calendar.year),
    limit: PAGINATION_LIMIT,
  });
  const budgetsQuery = useGetBudgetsQuery({
    currentMonth: calendar.month,
    currentYear: calendar.year,
  });
  const financialSummaryQuery = useGetFinancialSummaryQuery({
    currentMonth: calendar.month,
    currentYear: calendar.year,
  });

  const transactions = transactionsQuery.data?.transaction ?? NO_TRANSACTIONS;
  const budgets = budgetsQuery.data ?? NO_BUDGETS;
  const financialSummary = financialSummaryQuery.data ?? null;

  // ── Upcoming Bills ─────────────────────────────────────────────────────
  // Predictions are day-scoped (`today` busts the cache at midnight) and
  // filtered client-side by persisted dismissals. Failures degrade silently —
  // Home's other content must never be blocked by an analytics nicety.
  const todayKey = useMemo(
    () =>
      `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
    // Recomputed per render is fine; memo keeps the arg reference stable.
    [],
  );
  const recurringQuery = useGetRecurringPaymentsQuery({ today: todayKey });

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadDismissedSeries().then((keys) => {
      if (!cancelled) setDismissedKeys(keys);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Dismisses a series locally (persisted) so it stops appearing. */
  const handleDismissBill = useCallback((seriesKey: string) => {
    setDismissedKeys((prev) =>
      prev.includes(seriesKey) ? prev : [...prev, seriesKey],
    );
    void dismissSeries(seriesKey);
  }, []);

  const upcomingBills: IRecurringPayment[] = useMemo(() => {
    const all = recurringQuery.data?.recurringPayments ?? [];
    return all
      .filter((b) => !dismissedKeys.includes(b.seriesKey))
      .slice(0, 5);
  }, [recurringQuery.data, dismissedKeys]);

  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );
  const { displayBudgets } = useBudgetDisplayAmounts(
    budgets,
    transactions,
    activeCurrency,
  );

  // ── Modal / screen-level UI state ─────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [openTxModal, setOpenTxModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [openSetup, setOpenSetup] = useState(false);

  // ── Pull-to-refresh: force a network revalidation of all three sources ─
  const { refreshing, onRefresh } = useRefresh(() =>
    Promise.all([
      transactionsQuery.refetch(),
      budgetsQuery.refetch(),
      financialSummaryQuery.refetch(),
    ]),
  );

  // ── Month metadata (trivial — computed directly, no memo) ─────────────
  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getMonth() && calendar.year === now.getFullYear();
  const monthLabel = `${new Date(calendar.year, calendar.month, 1).toLocaleString(undefined, { month: "long" })} ${calendar.year}`;

  // ── Calendar navigation ───────────────────────────────────────────────
  const handlePrevMonth = useCallback(() => {
    dispatch(prevMonth());
  }, [dispatch]);

  const handleNextMonth = useCallback(() => {
    dispatch(nextMonth());
  }, [dispatch]);

  // ── Quick actions ─────────────────────────────────────────────────────
  const handleNewBudget = useCallback(() => {
    setOpenBudgetModal(true);
  }, []);

  /** Guard: a budget must exist for the month before a transaction can be added. */
  const handleNewTransaction = useCallback(() => {
    if (budgets.length === 0) {
      // No budgets for this month — surface setup instead of a dead-end alert.
      setOpenSetup(true);
      return;
    }
    setOpenTxModal(true);
  }, [budgets.length]);

  const handleHideSetup = useCallback(() => {
    setOpenSetup(false);
  }, []);

  const handleInfoPress = useCallback(() => {
    setHelpOpen(true);
  }, []);

  return {
    transactions,
    displayTransactions,
    displayBudgets,
    activeCurrency,
    monthlyIncome: Number(financialSummary?.monthlyIncome || 0),
    // The API guarantees that all summary fields are already denominated in
    // the user's selected currency; never convert an aggregate client-side.
    expenseTotal: Number(financialSummary?.totalAmount || 0),
    monthLabel,
    isCurrentMonth,
    month: calendar.month,
    year: calendar.year,
    upcomingBills,
    handleDismissBill,
    helpOpen,
    openTxModal,
    openBudgetModal,
    openSetup,
    setHelpOpen,
    setOpenTxModal,
    setOpenBudgetModal,
    handleHideSetup,
    refreshing,
    onRefresh,
    handlePrevMonth,
    handleNextMonth,
    handleNewTransaction,
    handleNewBudget,
    handleInfoPress,
  };
};
