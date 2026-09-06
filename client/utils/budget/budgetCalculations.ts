/**
 * Budget-specific calculation helpers.
 *
 * All monetary maths use **integer-cent arithmetic** to avoid
 * floating-point drift (e.g. `150.10 - 100.20` → `49.90`, not `49.900…01`).
 */

// Re-export the canonical safeAmount so existing imports don't break
import { safeAmount } from "@/utils/transaction/helpers";
export { safeAmount };

/**
 * Computes the overspend delta using **integer-cent math** to prevent
 * floating-point drift.
 *
 * @returns The absolute difference in dollars, safe for display.
 */
/**
 * Number of days in the given month (local calendar).
 */
export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Utilization tier for a spend/limit ratio — pure decision logic that the
 * UI maps onto theme colours.
 */
export type UtilizationTier = "safe" | "warm" | "over";

export function utilizationTier(ratio: number): UtilizationTier {
  if (ratio > 1) return "over";
  if (ratio >= 0.8) return "warm";
  return "safe";
}

export interface SpendSeriesPoint {
  /** 1-based day of month. */
  day: number;
  /** Cumulative spend through that day (dollars). */
  cumulative: number;
}

/**
 * Builds a month-long cumulative spend series for a budget/category using
 * integer-cent accumulation to avoid floating-point drift.
 *
 * When `budgetId` is provided, transactions are matched on `budgetId` first;
 * otherwise they are matched by lower-cased `category`.
 */
export function buildMonthSpendSeries(
  transactions: {
    date?: string;
    amount?: number | string;
    category?: string;
    budgetId?: string | null;
  }[],
  opts: {
    category?: string;
    budgetId?: string | null;
    month: number;
    year: number;
  },
): SpendSeriesPoint[] {
  const total = daysInMonth(opts.month, opts.year);
  const cat = String(opts.category || "")
    .trim()
    .toLowerCase();
  const byDay: Record<number, number> = {};

  for (const tx of transactions) {
    if (!tx.date) continue;
    const d = new Date(tx.date);
    if (d.getUTCMonth() !== opts.month || d.getUTCFullYear() !== opts.year)
      continue;

    const matches = opts.budgetId
      ? String(tx.budgetId || "") === opts.budgetId
      : String(tx.category || "")
          .trim()
          .toLowerCase() === cat;
    if (!matches) continue;

    const cents = Math.round(safeAmount(tx.amount) * 100);
    byDay[d.getUTCDate()] = (byDay[d.getUTCDate()] || 0) + cents;
  }

  const series: SpendSeriesPoint[] = [];
  let running = 0;
  for (let day = 1; day <= total; day++) {
    running += byDay[day] || 0;
    series.push({ day, cumulative: running / 100 });
  }
  return series;
}

/**
 * Day of the month for "now", used to place the “today” marker on trend
 * charts and to compute days-left.
 */
export function todayDayOfMonth(): number {
  return new Date().getDate();
}
export function overspendDeltaCents(
  limitRaw: number | string,
  spentRaw: number | string,
): number {
  const limitCents = Math.round(safeAmount(limitRaw) * 100);
  const spentCents = Math.round(safeAmount(spentRaw) * 100);
  return Math.abs(limitCents - spentCents) / 100;
}
