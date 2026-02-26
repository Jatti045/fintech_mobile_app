import React, { useCallback, useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TransactionModal from "@/components/transaction/TxModal";
import SearchTransaction from "@/components/transaction/TxSearchBar";
import AddNewTransactionButton from "@/components/transaction/AddTxButton";
import FilterTransaction from "@/components/transaction/TxFilterOpt";
import SectionHeader from "@/components/transaction/SectionHeader";
import TransactionRow from "@/components/transaction/TxRow";
import ListFooter from "@/components/transaction/TxFooter";
import { useTransactionOperations } from "@/hooks/transaction/useTransactionOperation";
import { useTransactionFilters } from "@/hooks/transaction/useTransactionFilters";
import { useTransactionLoadMore } from "@/hooks/transaction/useTransactionLoadMore";
import { TransactionSkeleton } from "@/components/skeleton/SkeletonLoader";
import type { TransactionItem } from "@/types/transaction/types";
import {
  useBudgets,
  useTheme,
  useTransactions,
  useTransactionStatus,
} from "@/hooks/useRedux";
import Loader from "@/utils/loader";

export default function TransactionScreen() {
  const transactions = useTransactions();
  const budgets = useBudgets();
  const { THEME } = useTheme();
  const { isAdding, isEditing, isDeleting, isLoading } = useTransactionStatus();

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside TransactionModal.
  const { handleDeleteTransaction } = useTransactionOperations();

  // Custom hook encapsulating all filter state + logic for deriving the filtered + grouped transaction data fed into the SectionList.
  const {
    searchQuery,
    setSearchQuery,
    filterCategoryId,
    setFilterCategoryId,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    clearFilters,
    sectionsWithTotals,
  } = useTransactionFilters(transactions, budgets);

  const { handleLoadMore, isLoadingMore, hasNextPage } =
    useTransactionLoadMore();

  /** Show skeleton while initial data is loading (transactions empty + loading) */
  const isInitialLoading = isLoading && transactions.length === 0;

  const [openSheet, setOpenSheet] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionItem | null>(null);

  const loaderMessage = useMemo(() => {
    if (isAdding) return "Adding transaction…";
    if (isEditing) return "Updating transaction…";
    if (isDeleting) return "Deleting transaction…";
    return "";
  }, [isAdding, isEditing, isDeleting]);

  const isLoaderVisible = isAdding || isEditing || isDeleting;

  /** Open the modal in edit mode for the given transaction. */
  const handleEditPress = useCallback((tx: TransactionItem) => {
    setEditingTransaction(tx);
    setOpenSheet(true);
  }, []);

  /** Clear editing state when the modal closes. */
  const handleModalClose = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  // ── Memoised render callbacks for SectionList ─────────────────────────
  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: { title: string; total: number; data: TransactionItem[] };
    }) => <SectionHeader title={section.title} total={section.total} />,
    [],
  );

  // Note: the `TransactionItem` type is minimal and only includes the fields needed for display in the list. The full transaction details (including any additional fields) are passed to the modal when editing. This keeps the list rendering efficient while still allowing full access to transaction data when needed.
  const renderItem = useCallback(
    ({ item }: { item: TransactionItem }) => (
      <TransactionRow
        tx={item}
        onEdit={handleEditPress}
        onDelete={handleDeleteTransaction}
      />
    ),
    [handleEditPress, handleDeleteTransaction],
  );

  // Key extractor for SectionList items — uses transaction ID if available, otherwise falls back to index. This ensures stable keys even for transactions that may not have an ID yet (e.g. newly created transactions that haven't been saved to the backend).
  const keyExtractor = useCallback(
    (item: TransactionItem, index: number) => item.id ?? String(index),
    [],
  );

  /** Memoised footer element — avoids re-creating the subtree every render. */
  const listFooter = useMemo(
    () => (
      <ListFooter
        hasNextPage={hasNextPage}
        isLoadingMore={isLoadingMore}
        hasTransactions={transactions.length > 0}
        onLoadMore={handleLoadMore}
      />
    ),
    [hasNextPage, isLoadingMore, transactions.length, handleLoadMore],
  );

  // Show skeleton loader during initial data fetch
  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["left", "right"]}
        style={{ backgroundColor: THEME.background, flex: 1 }}
        className="px-4"
      >
        <TransactionSkeleton />
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
