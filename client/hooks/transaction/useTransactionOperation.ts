import { useCallback } from "react";
import {
  fetchTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/store/slices/transactionSlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { TransactionType } from "@/types/transaction/types";
import { formatCurrency } from "@/utils/helper";
import { useThemedAlert } from "@/utils/themedAlert";
import { validateTransactionAmount } from "@/utils/validation";
import { MAX_TRANSACTION_AMOUNT } from "@/constants/appConfig";
import { useAppDispatch, useCalendar } from "../useRedux";
import { useTransactionForm } from "./useTransactionForm";
import { convertCurrency } from "@/utils/currencyConverter";
import { getCurrencySymbol } from "@/constants/Currencies";
import { hapticSuccess, hapticHeavy, hapticError } from "@/utils/haptics";

/**
 * Combined hook that owns form state and exposes both create and update handlers.
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
  const dispatch = useAppDispatch();

  const {
    txName,
    txAmount,
    txDate,
    txSelectedCategoryAndId,
    txCurrency,
    userCurrency,
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

      // Convert amount if the transaction currency differs from the user's default
      let finalAmount = amt;
      let originalCurrency: string | null = null;
      let originalAmount: number | null = null;

      if (txCurrency !== userCurrency) {
        try {
          finalAmount = await convertCurrency(amt, txCurrency, userCurrency);
          originalCurrency = txCurrency;
          originalAmount = amt;
        } catch (err: any) {
          showAlert({
            title: "Conversion Error",
            message:
              err.message ||
              `Failed to convert from ${txCurrency} to ${userCurrency}. Please try again.`,
          });
          return;
        }
      }

      const payload: any = {
        name: txName.trim(),
        month: calendar.month,
        year: calendar.year,
        date: txDate.toISOString(),
        category: txSelectedCategoryAndId.name || "Uncategorized",
        type: TransactionType.EXPENSE,
        amount: finalAmount,
        icon: null,
        budgetId: txSelectedCategoryAndId.id || null,
        originalCurrency,
        originalAmount,
      };

      // Close modal first so any loader overlay is visible
      setOpenSheet(false);

      try {
        const response: any = await dispatch(createTransaction(payload));
        const { success, message } = response.payload ?? {};
        if (success) {
          hapticSuccess();
          showAlert({ title: "Success", message: "Transaction created" });
          // Reset form only on success
          setTxName("");
          setTxAmount("");
          setTxSelectedCategoryAndId({ id: "", name: "" });
          setTxDate(new Date());
          setTxCurrency(userCurrency);
          dispatch(
            fetchTransaction({
              searchQuery: "",
              currentMonth: calendar.month,
              currentYear: calendar.year,
              useCache: false,
            } as any),
          );
          return;
        }
        showAlert({
          title: "Error",
          message: message || "Failed to create transaction",
        });
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
      setTxName,
      setTxAmount,
      setTxDate,
      setTxSelectedCategoryAndId,
      setTxCurrency,
      showAlert,
      calendar,
      dispatch,
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
      const currencyChanged = txCurrency !== userCurrency;
      const wasCurrencyTransaction = !!editingTransaction.originalCurrency;
      const sameCurrencyState =
        currencyChanged === wasCurrencyTransaction &&
        (!currencyChanged ||
          txCurrency === editingTransaction.originalCurrency);

      const noChange =
        editingTransaction.name === txName.trim() &&
        Number(editingTransaction.amount) === Number(txAmount) &&
        (editingTransaction.budgetId || "") ===
          (txSelectedCategoryAndId.id || "") &&
        new Date(editingTransaction.date).toISOString() ===
          txDate.toISOString() &&
        sameCurrencyState;

      if (noChange) {
        showAlert({
          title: "No changes detected",
          message: "No changes were made to the transaction.",
        });
        return;
      }

      // Handle currency conversion if the transaction currency differs from user default
      let finalAmount = Number(txAmount);
      let originalCurrency: string | null = null;
      let originalAmount: number | null = null;

      if (txCurrency !== userCurrency) {
        try {
          finalAmount = await convertCurrency(
            Number(txAmount),
            txCurrency,
            userCurrency,
          );
          originalCurrency = txCurrency;
          originalAmount = Number(txAmount);
        } catch (err: any) {
          showAlert({
            title: "Conversion Error",
            message:
              err.message ||
              `Failed to convert from ${txCurrency} to ${userCurrency}. Please try again.`,
          });
          return;
        }
      }

      // Build a partial update with only changed fields to minimise payload size
      const updates: any = {};
      if (editingTransaction.name !== txName.trim())
        updates.name = txName.trim();
      if (Number(editingTransaction.amount) !== finalAmount)
        updates.amount = finalAmount;
      if (
        (editingTransaction.budgetId || "") !==
        (txSelectedCategoryAndId.id || "")
      )
        updates.budgetId = txSelectedCategoryAndId.id || null;
      if (
        new Date(editingTransaction.date).toISOString() !== txDate.toISOString()
      )
        updates.date = txDate.toISOString();

      // Always send currency fields when they've changed
      if (!sameCurrencyState) {
        updates.originalCurrency = originalCurrency;
        updates.originalAmount = originalAmount;
        // Also update amount with the converted value
        updates.amount = finalAmount;
      }

      // Close modal first so any loader overlay is visible
      setOpenSheet(false);

      try {
        const response: any = await dispatch(
          updateTransaction({ id: editingTransaction.id, updates }),
        );
        const { success, message } = response.payload ?? {};
        if (success) {
          hapticSuccess();
          showAlert({
            title: "Updated",
            message: "Transaction updated successfully",
          });
          dispatch(
            fetchTransaction({
              searchQuery: "",
              currentMonth: calendar.month,
              currentYear: calendar.year,
              useCache: false,
            } as any),
          );
          // Refresh budgets so the spent amount reflects the updated transaction
          dispatch(
            fetchBudgets({
              currentMonth: calendar.month,
              currentYear: calendar.year,
            }),
          );
          return;
        }
        showAlert({
          title: "Error",
          message: message || "Failed to update transaction",
        });
      } catch (err: any) {
        showAlert({
          title: "Error",
          message: err.message || "Failed to update transaction",
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
      showAlert,
      calendar,
      dispatch,
    ],
  );

  /**
   * Delete a transaction by id after a confirmation prompt.
   * Only the id is required — no form state involved.
   */
  const handleDeleteTransaction = useCallback(
    (id: string) => {
      hapticHeavy();
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
                const response: any = await dispatch(deleteTransaction(id));
                const { success, message } = response?.payload ?? {};
                // Small delay so the confirmation alert fully dismisses first
                setTimeout(() => {
                  if (success) {
                    hapticSuccess();
                    showAlert({
                      title: "Deleted",
                      message: "Transaction deleted successfully.",
                    });
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
    [showAlert, dispatch],
  );

  return {
    // Spread all form state so the modal can bind inputs directly
    ...form,
    handleCreateTransaction,
    handleUpdateTransaction,
    handleDeleteTransaction,
  };
};
