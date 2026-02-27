import { useCallback } from "react";
import {
  createBudget,
  updateBudget,
  deleteBudget,
} from "@/store/slices/budgetSlice";
import { useThemedAlert } from "@/utils/themedAlert";
import { useAppDispatch, useCalendar, useTransactions } from "../useRedux";
import { capitalizeFirst } from "@/utils/helper";
import { useBudgetForm } from "./useBudgetForm";
import { validateBudgetForm } from "@/utils/validation";
import { hapticSuccess, hapticHeavy, hapticError } from "@/utils/haptics";

/**
 * Combined hook that owns budget form state and exposes both create and update
 * handlers. Mirrors the `useTransactionOperations` pattern: `useBudgetForm()` is
 * called here so there is a single shared state instance between the handlers and
 * the modal's rendered inputs — no prop-drilling of values or setters required.
 */
export const useBudgetOperations = () => {
  const form = useBudgetForm();
  const { showAlert } = useThemedAlert();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();
  // Used by handleDeleteBudget to enforce referential integrity before deletion
  const transactions = useTransactions();

  const {
    budgetCategory,
    budgetIcon,
    budgetLimit,
    setBudgetCategory,
    setBudgetIcon,
    setBudgetLimit,
    setBudgetSaving,
  } = form;

  /**
   * Create a new budget using the current form state.
   * Only `setOpenSheet` is required — all form values come from the shared hook.
   */
  const handleCreateBudget = useCallback(
    async (setOpenSheet: (v: boolean) => void) => {
      const check = validateBudgetForm(budgetCategory, budgetIcon, budgetLimit);
      if (!check.valid) {
        showAlert({ title: "Missing Information", message: check.message });
        return;
      }

      const parsedCategory = capitalizeFirst(budgetCategory.trim());
      const parsedIcon = budgetIcon.trim();
      const parsedLimit = Number(budgetLimit);

      setBudgetSaving(true);
      try {
        const response: any = await dispatch(
          createBudget({
            category: parsedCategory,
            icon: parsedIcon,
            limit: parsedLimit,
            month: calendar.month,
            year: calendar.year,
          } as any),
        );
        const { success, message } = response.payload ?? {};
        if (!success) {
          showAlert({ title: "Error", message: message || "Failed to save" });
          return;
        }
        hapticSuccess();
        showAlert({ title: "Success", message: "Budget created successfully" });
        // Reset form only on success, preserving input on error for correction
        setBudgetCategory("");
        setBudgetIcon("");
        setBudgetLimit("");
        setOpenSheet(false);
      } catch (err: any) {
        showAlert({ title: "Error", message: err.message || "Failed to save" });
      } finally {
        setBudgetSaving(false);
      }
    },
    [
      budgetCategory,
      budgetIcon,
      budgetLimit,
      setBudgetCategory,
      setBudgetIcon,
      setBudgetLimit,
      setBudgetSaving,
      showAlert,
      calendar,
      dispatch,
    ],
  );

  /**
   * Update an existing budget using the current form state.
   * Performs a no-op check so the API is not hit when nothing changed.
   */
  const handleUpdateBudget = useCallback(
    async (editingBudget: any, setOpenSheet: (v: boolean) => void) => {
      if (!editingBudget) return;

      const check = validateBudgetForm(budgetCategory, budgetIcon, budgetLimit);
      if (!check.valid) {
        showAlert({ title: "Missing Information", message: check.message });
        return;
      }

      const parsedCategory = budgetCategory.trim();
      const parsedIcon = budgetIcon.trim();
      const parsedLimit = Number(budgetLimit);

      // Detect no-op: skip API call if nothing has changed
      const noChange =
        parsedCategory === String(editingBudget.category) &&
        Number(parsedLimit) === Number(editingBudget.limit) &&
        parsedIcon === String(editingBudget.icon);

      if (noChange) {
        showAlert({
          title: "No changes detected",
          message: "Nothing to update",
        });
        return;
      }

      // Build a partial update with only changed fields to minimise payload size
      const updates: any = {};
      if (parsedCategory !== String(editingBudget.category))
        updates.category = parsedCategory;
      if (parsedIcon !== String(editingBudget.icon)) updates.icon = parsedIcon;
      if (Number(parsedLimit) !== Number(editingBudget.limit))
        updates.limit = parsedLimit;

      setBudgetSaving(true);
      try {
        const response: any = await dispatch(
          updateBudget({ id: editingBudget.id, updates }),
        );
        const { success, message } = response.payload ?? {};
        if (success) {
          hapticSuccess();
          showAlert({
            title: "Success",
            message: "Budget updated successfully",
          });
          setOpenSheet(false);
          return;
        }
        showAlert({
          title: "Error",
          message: message || "Failed to update budget",
        });
      } catch (err: any) {
        showAlert({
          title: "Error",
          message: err?.message || "Failed to update budget",
        });
      } finally {
        setBudgetSaving(false);
      }
    },
    [
      budgetCategory,
      budgetIcon,
      budgetLimit,
      setBudgetSaving,
      showAlert,
      dispatch,
    ],
  );

  /**
   * Delete a budget by id after a referential-integrity pre-check and
   * a confirmation prompt. Blocks deletion if transactions are still attached.
   */
  const handleDeleteBudget = useCallback(
    (budgetId: string) => {
      // Client-side guard: prevent orphaning attached transactions
      const attached = transactions.filter((t: any) => t.budgetId === budgetId);
      if (attached.length > 0) {
        showAlert({
          title: "Cannot delete budget",
          message: `This budget has ${attached.length} transaction${
            attached.length > 1 ? "s" : ""
          } attached. Remove or reassign those transactions first.`,
        });
        return;
      }

      hapticHeavy();
      showAlert({
        title: "Delete Budget",
        message: "Are you sure you want to delete this budget?",
        buttons: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const response: any = await dispatch(deleteBudget(budgetId));
                const { success, message } = response?.payload ?? {};
                setTimeout(() => {
                  if (success) {
                    hapticSuccess();
                    showAlert({
                      title: "Success",
                      message: "Budget deleted successfully",
                    });
                  } else {
                    showAlert({
                      title: "Error",
                      message: message || "Failed to delete budget",
                    });
                  }
                }, 400);
              } catch (err: any) {
                setTimeout(() => {
                  showAlert({
                    title: "Error",
                    message: err.message || "Failed to delete budget",
                  });
                }, 400);
              }
            },
          },
        ],
      });
    },
    [transactions, showAlert, dispatch],
  );

  return {
    // Spread all form state so the modal can bind inputs directly
    ...form,
    handleCreateBudget,
    handleUpdateBudget,
    handleDeleteBudget,
  };
};

export default useBudgetOperations;
