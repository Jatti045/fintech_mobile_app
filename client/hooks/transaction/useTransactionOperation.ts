import { useCallback } from "react";
import {
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateTransactionMutation,
} from "@/store/api/apiSlice";
import type { MonthKey } from "@/store/api/apiSlice";
import { TransactionType } from "@/types/transaction/types";
import { formatCurrency } from "@/utils/helper";
import { useThemedAlert } from "@/utils/themedAlert";
import { validateTransactionAmount } from "@/utils/validation";
import { MAX_TRANSACTION_AMOUNT } from "@/constants/appConfig";
import { useCalendar, useTransactions } from "../useRedux";
import { useTransactionForm } from "./useTransactionForm";
import { getCurrencySymbol } from "@/constants/Currencies";
import { hapticSuccess, hapticHeavy } from "@/utils/haptics";

/** Unique `{year, month}` keys for cache-tag invalidation. */
function uniqueMonths(months: (MonthKey | null | undefined)[]): MonthKey[] {
  const seen = new Set<string>();
  const out: MonthKey[] = [];
  for (const m of months) {
    if (!m) continue;
    const key = `${m.year}-${m.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

const monthOfDate = (date?: string | Date | null): MonthKey | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * Combined hook that owns form state and exposes both create and update handlers.
 *
 * Mutations run through RTK Query and invalidate the affected month tags
 * (`Transactions`, `Budgets`, `Summary`), which triggers authoritative
 * refetches automatically — no manual post-mutation refetch dispatches.
 *
 * Calling `useTransactionForm()` here means there is a single state instance
 * shared between the handlers and the modal's rendered inputs — no prop-drilling
 * of form values required, and the Rules of Hooks are satisfied because all
 * hook calls happen at this hook's top level.
 */
export const useTransactionOperations = () => {
  const form = useTransactionForm();
  const { showAlert } = useThemedAlert();
  const calendar = useCalendar();
  const transactions = useTransactions();
  const [createTransactionMutation] = useCreateTransactionMutation();
  const [updateTransactionMutation] = useUpdateTransactionMutation();
  const [deleteTransactionMutation] = useDeleteTransactionMutation();

  const {
    txName,
    txAmount,
    txDate,
    txSelectedCategoryAndId,
    txCurrency,
    userCurrency,
    type,
    setType,
    setTxName,
    setTxAmount,
    setTxDate,
    setTxSelectedCategoryAndId,
    setTxCurrency,
  } = form;

  /**
   * Create a new transaction using the current form state.
   * Only `setOpenSheet` is required — all form values come from the shared hook.
   */
  const handleCreateTransaction = useCallback(
    async (setOpenSheet: (v: boolean) => void) => {
      if (!txName.trim() || !txAmount.trim()) {
        showAlert({ title: "Please enter a name and amount" });
        return;
      }

      const amtCheck = validateTransactionAmount(txAmount);
      if (!amtCheck.valid) {
        showAlert({
          title: "Invalid Amount",
          message: `Amount must be between ${getCurrencySymbol(txCurrency)}0.01 and ${formatCurrency(MAX_TRANSACTION_AMOUNT, userCurrency)}.`,
        });
        return;
      }

      const amt = Number(txAmount);

      // The API owns conversion so Plaid and manual transactions share one
      // normalization path. `amount` is the original entered value.
      const finalAmount = amt;
      const originalCurrency = txCurrency;
      const originalAmount = amt;
      const baseCurrency = userCurrency;

      const payload: any = {
        name: txName.trim(),
        month: calendar.month,
        year: calendar.year,
        date: txDate.toISOString(),
        category: txSelectedCategoryAndId.name || "Uncategorized",
        type,
        amount: finalAmount,
        budgetId: txSelectedCategoryAndId.id || null,
        baseCurrency,
        originalCurrency,
        originalAmount,
      };

      // Close modal first so any loader overlay is visible
      setOpenSheet(false);

      try {
        const result = await createTransactionMutation(payload);
        if (!result.error && result.data?.success) {
          hapticSuccess();
          // Reset form only on success
          setTxName("");
          setTxAmount("");
          setTxSelectedCategoryAndId({ id: "", name: "" });
          setTxDate(new Date());
          setTxCurrency(userCurrency);
          setType(TransactionType.EXPENSE);
          return;
        }
        const message =
          (result.data as any)?.message ??
          (result.error as any)?.error ??
          "Failed to create transaction";
        showAlert({ title: "Error", message });
      } catch (err: any) {
        showAlert({
          title: "Error",
          message: err.message || "Failed to create transaction",
        });
      }
    },
    // Re-create when form values change so the callback always closes over fresh state
    [
      txName,
      txAmount,
      txDate,
      txSelectedCategoryAndId,
      txCurrency,
      userCurrency,
      type,
      setTxName,
      setTxAmount,
      setTxDate,
      setTxSelectedCategoryAndId,
      setTxCurrency,
      setType,
      showAlert,
      calendar,
      createTransactionMutation,
    ],
  );

  /**
   * Update an existing transaction using the current form state.
   * Performs a no-op check so the API is not hit when nothing changed.
   */
  const handleUpdateTransaction = useCallback(
    async (editingTransaction: any, setOpenSheet: (v: boolean) => void) => {
      if (!editingTransaction) return;

      // Detect no-op: skip API call if nothing has changed
      const existingOriginalCurrency =
        editingTransaction.originalCurrency ||
        editingTransaction.baseCurrency ||
        userCurrency;
      const existingOriginalAmount = Number(
        editingTransaction.originalAmount ?? editingTransaction.amount,
      );

      const existingBudgetId =
        editingTransaction.budgetId ?? editingTransaction.budget?.id ?? "";
      const selectedBudgetId = txSelectedCategoryAndId.id || "";
      const selectedCategory = txSelectedCategoryAndId.name || "";

      const budgetChanged = existingBudgetId !== selectedBudgetId;
      const categoryChanged =
        selectedCategory !== "" &&
        editingTransaction.category !== selectedCategory;

      const noChange =
        editingTransaction.name === txName.trim() &&
        existingOriginalAmount === Number(txAmount) &&
        !budgetChanged &&
        !categoryChanged &&
        new Date(editingTransaction.date).toISOString() ===
          txDate.toISOString() &&
        existingOriginalCurrency === txCurrency &&
        (editingTransaction.type || "EXPENSE") === type;

      if (noChange) {
        showAlert({
          title: "No changes detected",
          message: "No changes were made to the transaction.",
        });
        return;
      }

      // The API owns conversion; send the original user-entered amount.
      const finalAmount = Number(txAmount);
      const originalCurrency = txCurrency;
      const originalAmount = Number(txAmount);
      const baseCurrency = userCurrency;

      // Build a partial update with only changed fields to minimise payload size
      const updates: any = {};
      if (editingTransaction.name !== txName.trim())
        updates.name = txName.trim();
      if (Number(editingTransaction.amount) !== finalAmount)
        updates.amount = finalAmount;
      if ((editingTransaction.type || "EXPENSE") !== type) updates.type = type;
      if (budgetChanged) updates.budgetId = selectedBudgetId || null;
      if (categoryChanged) updates.category = selectedCategory;
      if (
        new Date(editingTransaction.date).toISOString() !== txDate.toISOString()
      )
        updates.date = txDate.toISOString();

      const currencySnapshotChanged =
        (editingTransaction.originalCurrency ||
          editingTransaction.baseCurrency) !== originalCurrency ||
        Number(
          editingTransaction.originalAmount ?? editingTransaction.amount,
        ) !== originalAmount ||
        (editingTransaction.baseCurrency || userCurrency) !== baseCurrency;

      // Always send currency snapshot when amount/currency changed.
      if (
        requestHasNumericChange(editingTransaction.amount, finalAmount) ||
        currencySnapshotChanged
      ) {
        updates.baseCurrency = baseCurrency;
        updates.originalCurrency = originalCurrency;
        updates.originalAmount = originalAmount;
        updates.amount = finalAmount;
      }

      // Invalidate both the month the transaction is leaving and the one it
      // may be entering (an edited date can move it across months).
      const invalidateMonths = uniqueMonths([
        { year: calendar.year, month: calendar.month },
        monthOfDate(editingTransaction.date),
        monthOfDate(updates.date),
      ]);

      try {
        const result = await updateTransactionMutation({
          id: editingTransaction.id,
          updates,
          invalidateMonths,
        });
        if (!result.error && result.data?.success) {
          hapticSuccess();
          setOpenSheet(false);
          return;
        }
        const message =
          (result.data as any)?.message ??
          (result.error as any)?.error ??
          "Couldn't update transaction. Please try again.";
        showAlert({ title: "Error", message });
      } catch (err: any) {
        showAlert({
          title: "Error",
          message:
            err.message || "Couldn't update transaction. Please try again.",
        });
      }
    },
    [
      txName,
      txAmount,
      txDate,
      txSelectedCategoryAndId,
      txCurrency,
      userCurrency,
      type,
      showAlert,
      calendar,
      updateTransactionMutation,
    ],
  );

  /**
   * Delete a transaction by id after a confirmation prompt.
   * Only the id is required — no form state involved.
   */
  const handleDeleteTransaction = useCallback(
    (id: string) => {
      hapticHeavy();

      // Derive the deleted transaction's month (fall back to the selected
      // calendar month) so the correct month caches are invalidated.
      const deletedTx = transactions.find((t: any) => t.id === id);
      const invalidateMonths = uniqueMonths([
        { year: calendar.year, month: calendar.month },
        monthOfDate(deletedTx?.date),
      ]);

      showAlert({
        title: "Delete Transaction",
        message: "Are you sure you want to delete this transaction?",
        buttons: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const result = await deleteTransactionMutation({
                  id,
                  invalidateMonths,
                });
                const success = !result.error && !!result.data?.success;
                const message =
                  (result.data as any)?.message ??
                  (result.error as any)?.error ??
                  "";
                // Small delay so the confirmation alert fully dismisses first
                setTimeout(() => {
                  if (success) {
                    hapticSuccess();
                  } else {
                    showAlert({
                      title: "Error",
                      message: message || "Failed to delete transaction",
                    });
                  }
                }, 400);
              } catch (err: any) {
                setTimeout(() => {
                  showAlert({
                    title: "Error",
                    message: err.message || "Failed to delete transaction",
                  });
                }, 400);
              }
            },
          },
        ],
      });
    },
    [transactions, showAlert, calendar, deleteTransactionMutation],
  );

  return {
    // Spread all form state so the modal can bind inputs directly
    ...form,
    handleCreateTransaction,
    handleUpdateTransaction,
    handleDeleteTransaction,
  };
};

function requestHasNumericChange(oldValue: any, newValue: number): boolean {
  return Number(oldValue) !== Number(newValue);
}
