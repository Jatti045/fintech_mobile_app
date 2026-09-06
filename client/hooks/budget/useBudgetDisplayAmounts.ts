import { useEffect, useMemo, useState } from "react";
import type { DisplayBudget, IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";

export type { DisplayBudget };

const normalizeCurrency = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

/**
 * Returns budget amounts for display.
 *
 * Both `limit` and `spent` are canonical in the user's aggregation currency:
 * the backend normalizes every transaction into that currency at ingestion
 * time before `spent` is assembled, so converting an aggregate here would be
 * incorrect whenever a budget contains transactions from multiple source
 * currencies. The previous conversion-based implementation was therefore
 * reduced to a pure passthrough of the persisted values.
 *
 * The update cadence (state initialized at mount, refreshed by an effect)
 * intentionally mirrors the previous implementation — consumers and tests
 * depend on the display amounts trailing the raw store data by one commit.
 */
export function useBudgetDisplayAmounts(
  budgets: IBudget[],
  _transactions: ITransaction[],
  activeCurrency: string,
) {
  const [displayBudgets, setDisplayBudgets] = useState<DisplayBudget[]>(() =>
    budgets.map((b) => ({
      ...b,
      displayLimit: Number(b.limit || 0),
      displaySpent: Number(b.spent || 0),
      displayCurrency: normalizeCurrency(activeCurrency) || "USD",
    })),
  );

  const normalizedActiveCurrency = useMemo(
    () => normalizeCurrency(activeCurrency) || "USD",
    [activeCurrency],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const mapped = await Promise.all(
        budgets.map(async (budget) => ({
          ...budget,
          displayLimit: Number(budget.limit || 0),
          displaySpent: Number(budget.spent || 0),
          displayCurrency: normalizedActiveCurrency,
        })),
      );

      if (!cancelled) {
        setDisplayBudgets(mapped);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [budgets, normalizedActiveCurrency]);

  return { displayBudgets };
}
