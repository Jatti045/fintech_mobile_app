import { useState } from "react";

/**
 * Owns all mutable form state for the budget create/edit flow.
 * Extracted from BudgetModal so that useBudgetOperations can call this hook
 * at its own top level and share a single state instance with the modal's
 * rendered inputs — no prop-drilling of values or setters required.
 */
export const useBudgetForm = () => {
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetIcon, setBudgetIcon] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);

  return {
    budgetCategory,
    setBudgetCategory,
    budgetIcon,
    setBudgetIcon,
    budgetLimit,
    setBudgetLimit,
    budgetSaving,
    setBudgetSaving,
  };
};
