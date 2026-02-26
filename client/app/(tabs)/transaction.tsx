import React, { useCallback, useMemo, useRef, useState } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchMoreTransactions } from "@/store/slices/transactionSlice";
import { useAppDispatch } from "@/store";
import {
  useBudgets,
  useTheme,
  useTransactions,
  useTransactionStatus,
  useCalendar,
  useTransactionPagination,
} from "@/hooks/useRedux";
import Loader from "@/utils/loader";
import { formatDate, capitalizeFirst, formatCurrency } from "@/utils/helper";
import TransactionModal from "@/components/transaction/transactionModal";
import SearchTransaction from "@/components/transaction/searchTransaction";
import AddNewTransactionButton from "@/components/transaction/addNewTransactionButton";
import FilterTransaction from "@/components/transaction/filterTransaction";
import { useTransactionOperations } from "@/hooks/transaction/useTransactionOperation";
import { TransactionSkeleton } from "@/components/skeleton/SkeletonLoader";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Minimal shape of a transaction as stored in Redux. */
interface TransactionItem {
  id: string;
  name: string;
  amount: number | string;
  date: string;
  category: string;
  budgetId?: string;
  type?: string;
  icon?: string;
}

/** A single day-group for the SectionList. */
interface GroupedSection {
  title: string;
  data: TransactionItem[];
  /** Aggregated spend for the day in dollars (computed with integer-cent math). */
  total: number;
}

// ─── Pure helpers (module-scope — never recreated) ──────────────────────────

/**
 * Returns a user-friendly label for a date key string.
 * @returns "Today" | "Yesterday" | locale-formatted date
 */
function friendlyDayLabel(dayKey: string): string {
  const d = new Date(dayKey);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

/**
 * Safely coerces a possibly-string amount to a finite number.
 * Returns `0` for NaN / Infinity / undefined / null — never throws.
 */
function safeAmount(raw: number | string | undefined | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sums an array of amounts using **integer-cent accumulation** to avoid
 * floating-point drift common in financial calculations.
 *
 * @example sumAmountsCents([1.1, 2.2]) // => 3.30 (not 3.3000000000000003)
 */
function sumAmountsCents(items: { amount: number | string }[]): number {
  const totalCents = items.reduce(
    (acc, tx) => acc + Math.round(safeAmount(tx.amount) * 100),
    0,
  );
  return totalCents / 100;
}

// ─── Memoised sub-components ────────────────────────────────────────────────

/**
 * Section header displaying the friendly day label and the section's total spend.
 * Wrapped in `React.memo` so it only re-renders when its own props change.
 */
const SectionHeader = React.memo(function SectionHeader({
  title,
  total,
  textSecondary,
  textPrimary,
}: {
  title: string;
  total: number;
  textSecondary: string;
  textPrimary: string;
}) {
  return (
    <View className="py-2 flex-row justify-center items-center">
      <Text
        style={{ color: textSecondary, flex: 1 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {friendlyDayLabel(title)}
      </Text>
      <Text
        style={{ color: textPrimary, marginLeft: 8 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {formatCurrency(total)}
      </Text>
    </View>
  );
});

/**
 * Single transaction row with press-to-edit and long-press-to-delete behaviour.
 * All theme colours are passed as props to keep the component pure.
 */
const TransactionRow = React.memo(function TransactionRow({
  tx,
  onEdit,
  onDelete,
  surface,
  border,
  primary,
  textPrimary,
  textSecondary,
  danger,
}: {
  tx: TransactionItem;
  onEdit: (tx: TransactionItem) => void;
  onDelete: (id: string) => void;
  surface: string;
  border: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
}) {
  const amt = safeAmount(tx.amount);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: surface,
        borderColor: border,
        borderWidth: 1,
      }}
      className="flex-row p-3 items-center justify-between mb-3 rounded-lg"
      activeOpacity={0.8}
      onPress={() => onEdit(tx)}
      onLongPress={() => onDelete(tx.id)}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
          <Text
            style={{ color: textPrimary, fontWeight: "700" }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {capitalizeFirst(tx.category)}
          </Text>
          <Text
            style={{ color: textSecondary }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatDate(tx.date)} - {tx.name}
          </Text>
        </View>
      </View>
      <View style={{ marginLeft: 12, alignItems: "flex-end" }}>
        <Text
          style={{ color: danger, fontWeight: "700" }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          - {formatCurrency(amt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

/**
 * Infinite-scroll footer: loading spinner, "Load More" button, or end-of-list.
 */
const ListFooter = React.memo(function ListFooter({
  hasNextPage,
  isLoadingMore,
  hasTransactions,
  onLoadMore,
  secondary,
  textSecondary,
  background,
}: {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  hasTransactions: boolean;
  onLoadMore: () => void;
  secondary: string;
  textSecondary: string;
  background: string;
}) {
  if (hasNextPage) {
    return (
      <View className="py-4 items-center">
        {isLoadingMore ? (
          <>
            <ActivityIndicator size="small" color={secondary} />
            <Text style={{ color: textSecondary, marginTop: 8 }}>
              Loading more...
            </Text>
          </>
        ) : (
          <TouchableOpacity onPress={onLoadMore} activeOpacity={0.8}>
            <Text style={{ color: textSecondary, fontSize: 12 }}>
              Load More Transactions
            </Text>
            <Ionicons name="chevron-down" size={18} color={background} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (hasTransactions) {
    return (
      <View className="py-4 items-center">
        <Text style={{ color: textSecondary, fontSize: 12 }}>
          No more transactions
        </Text>
      </View>
    );
  }

  return null;
});

// ─── Main Screen Component ──────────────────────────────────────────────────

export default function TransactionScreen() {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const transactions = useTransactions();
  const budgets = useBudgets();
  const { THEME } = useTheme();
  const calendar = useCalendar();
  const pagination = useTransactionPagination();
  const { isAdding, isEditing, isDeleting, isLoadingMore, isLoading } =
    useTransactionStatus();
  const dispatch = useAppDispatch();

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside TransactionModal.
  const { handleDeleteTransaction } = useTransactionOperations();

  /** Show skeleton while initial data is loading (transactions empty + loading) */
  const isInitialLoading = isLoading && transactions.length === 0;

  // ── Screen-level state ────────────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionItem | null>(null);

  // Filter controls (owned by this screen, not the modal)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string | "all">(
    "all",
  );
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  /** Ref-based guard to prevent duplicate infinite-scroll dispatches. */
  const loadMoreRef = useRef(false);

  // ── Derived / memoised data ───────────────────────────────────────────

  /**
   * Budget-id → category-name lookup map.
   * Eliminates the O(n) `budgets.find()` that was previously executed
   * per transaction inside the filter callback.
   */
  const budgetCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of budgets) {
      map.set(b.id, (b.category ?? "").toLowerCase());
    }
    return map;
  }, [budgets]);

  /**
   * Transactions filtered by category, amount range, and search query.
   * Only EXPENSE-type transactions are shown.
   */
  const filteredTransactions = useMemo(() => {
    const minParsed = minAmount.trim() !== "" ? Number(minAmount) || 0 : null;
    const maxParsed = maxAmount.trim() !== "" ? Number(maxAmount) || 0 : null;
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((t: any) => {
      // Category filter — O(1) map lookup instead of O(n) find
      if (filterCategoryId !== "all") {
        if (t.budgetId) {
          if (t.budgetId !== filterCategoryId) return false;
        } else {
          const filterCat = budgetCategoryMap.get(filterCategoryId) ?? "";
          if (String(t.category).toLowerCase() !== filterCat) return false;
        }
      }

      // Only expenses
      if ((t.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") return false;

      // Amount range
      const amt = safeAmount(t.amount);
      if (minParsed !== null && amt < minParsed) return false;
      if (maxParsed !== null && amt > maxParsed) return false;

      // Free-text search across name and category
      if (query) {
        const matchesName = String(t.name).toLowerCase().includes(query);
        const matchesCat = String(t.category).toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [
    transactions,
    filterCategoryId,
    budgetCategoryMap,
    minAmount,
    maxAmount,
    searchQuery,
  ]);

  /**
   * Grouped-by-day sections sorted newest-first with integer-cent totals.
   *
   * A single `useMemo` pass replaces the previous 3-step chain:
   *   reduce → sort(sections) + sort(items) → map(totals)
   * This avoids intermediate allocations and duplicate memoisation boundaries.
   */
  const sectionsWithTotals = useMemo<GroupedSection[]>(() => {
    const groups: Record<string, TransactionItem[]> = {};

    for (const t of filteredTransactions) {
      const dayKey = new Date(t.date).toDateString();
      (groups[dayKey] ??= []).push(t as TransactionItem);
    }

    return (
      Object.entries(groups)
        .map(([title, data]) => {
          // Sort items within the section: newest first
          data.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );
          return {
            title,
            data,
            total: sumAmountsCents(data),
          };
        })
        // Sort sections: newest day first
        .sort(
          (a, b) => new Date(b.title).getTime() - new Date(a.title).getTime(),
        )
    );
  }, [filteredTransactions]);

  /**
   * Derived loader message — eliminates the manual `setTransactionStatusMsg` calls.
   * The message is computed from Redux status flags that already track in-flight ops.
   */
  const loaderMessage = useMemo(() => {
    if (isAdding) return "Adding transaction…";
    if (isEditing) return "Updating transaction…";
    if (isDeleting) return "Deleting transaction…";
    return "";
  }, [isAdding, isEditing, isDeleting]);

  const isLoaderVisible = isAdding || isEditing || isDeleting;

  // ── Stable callbacks ──────────────────────────────────────────────────

  /** Reset all filter controls to their default values. */
  const clearFilters = useCallback(() => {
    setFilterCategoryId("all");
    setMinAmount("");
    setMaxAmount("");
  }, []);

  /** Open the modal in edit mode for the given transaction. */
  const handleEditPress = useCallback((tx: TransactionItem) => {
    setEditingTransaction(tx);
    setOpenSheet(true);
  }, []);

  /** Clear editing state when the modal closes. */
  const handleModalClose = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  /**
   * Infinite-scroll handler with `useRef` guard.
   * The ref prevents a second dispatch while a previous `fetchMoreTransactions`
   * is still in flight — even if React batches state updates that haven't yet
   * flipped `isLoadingMore` to `true`.
   */
  const handleLoadMore = useCallback(() => {
    if (loadMoreRef.current || isLoadingMore || !pagination.hasNextPage) return;

    loadMoreRef.current = true;
    const nextPage = pagination.currentPage + 1;

    dispatch(
      fetchMoreTransactions({
        searchQuery: "",
        currentMonth: calendar.month,
        currentYear: calendar.year,
        page: nextPage,
        limit: 10,
      }),
    ).finally(() => {
      loadMoreRef.current = false;
    });
  }, [
    isLoadingMore,
    pagination.hasNextPage,
    pagination.currentPage,
    calendar.month,
    calendar.year,
    dispatch,
  ]);

  // ── SectionList render callbacks (stable references) ──────────────────

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: { title: string; total: number; data: TransactionItem[] };
    }) => (
      <SectionHeader
        title={section.title}
        total={section.total}
        textSecondary={THEME.textSecondary}
        textPrimary={THEME.textPrimary}
      />
    ),
    [THEME.textSecondary, THEME.textPrimary],
  );

  const renderItem = useCallback(
    ({ item }: { item: TransactionItem }) => (
      <TransactionRow
        tx={item}
        onEdit={handleEditPress}
        onDelete={handleDeleteTransaction}
        surface={THEME.surface}
        border={THEME.border}
        primary={THEME.primary}
        textPrimary={THEME.textPrimary}
        textSecondary={THEME.textSecondary}
        danger={THEME.danger}
      />
    ),
    [
      handleEditPress,
      handleDeleteTransaction,
      THEME.surface,
      THEME.border,
      THEME.primary,
      THEME.textPrimary,
      THEME.textSecondary,
      THEME.danger,
    ],
  );

  const keyExtractor = useCallback(
    (item: TransactionItem, index: number) => item.id ?? String(index),
    [],
  );

  /** Memoised footer element — avoids re-creating the subtree every render. */
  const listFooter = useMemo(
    () => (
      <ListFooter
        hasNextPage={pagination.hasNextPage}
        isLoadingMore={isLoadingMore}
        hasTransactions={transactions.length > 0}
        onLoadMore={handleLoadMore}
        secondary={THEME.secondary}
        textSecondary={THEME.textSecondary}
        background={THEME.background}
      />
    ),
    [
      pagination.hasNextPage,
      isLoadingMore,
      transactions.length,
      handleLoadMore,
      THEME.secondary,
      THEME.textSecondary,
      THEME.background,
    ],
  );

  // ── Render ────────────────────────────────────────────────────────────

  // Show skeleton loader during initial data fetch
  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={{ backgroundColor: THEME.background, flex: 1 }}
        className="px-4"
      >
        <TransactionSkeleton THEME={THEME} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ backgroundColor: THEME.background, flex: 1 }}
      className="px-4"
    >
      {/* Screen title */}
      <View className="items-center justify-center my-4 mb-6">
        <Text
          style={{ color: THEME.textPrimary }}
          className="text-2xl font-bold"
        >
          Transactions
        </Text>
      </View>

      {/* Search bar */}
      <SearchTransaction
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Category + amount filters */}
      <FilterTransaction
        budgets={budgets}
        filterCategoryId={filterCategoryId}
        setFilterCategoryId={setFilterCategoryId}
        minAmount={minAmount}
        setMinAmount={setMinAmount}
        maxAmount={maxAmount}
        setMaxAmount={setMaxAmount}
        clearFilters={clearFilters}
      />

      {/* Transaction list or empty state */}
      {sectionsWithTotals.length === 0 ? (
        <View className="py-12 items-center">
          <Text style={{ color: THEME.textSecondary }}>
            No transactions match filters.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sectionsWithTotals}
          keyExtractor={keyExtractor}
          renderSectionHeader={renderSectionHeader as any}
          renderItem={renderItem as any}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={listFooter}
        />
      )}

      {/* Create / Edit modal — self-contained via useTransactionOperations */}
      <TransactionModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        budgets={budgets}
        editingTransaction={editingTransaction}
        onClose={handleModalClose}
      />

      {/* Floating action button */}
      <AddNewTransactionButton setOpenSheet={setOpenSheet} budgets={budgets} />

      {/* Full-screen loader overlay */}
      {isLoaderVisible ? <Loader msg={loaderMessage} /> : null}
    </SafeAreaView>
  );
}
