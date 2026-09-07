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

// ── Budget pace / status ────────────────────────────────────────────────────

export type BudgetPaceStatus = "idle" | "on_track" | "at_risk" | "over";

export interface BudgetPace {
  /** Concise status derived from utilization AND spending pace. */
  status: BudgetPaceStatus;
  /** Fraction of the limit consumed, 0..∞ (1 == exactly at budget). */
  pctUsed: number;
  /** Straight-line projection of month-end spend (equals spent for past months). */
  projectedSpend: number;
  /** Per-day allowance for the rest of the month (null for past months). */
  dailyLeft: number | null;
  /** Remaining allowance, floored at 0. */
  remaining: number;
  /** True when spent exceeds the limit. */
  overspent: boolean;
}

export interface BudgetPaceInput {
  limit: number;
  spent: number;
  /** Is the budget's month the month we are currently in? */
  isCurrentMonth: boolean;
  /** Day of month "today" is (1-based). Ignored for non-current months. */
  todayDay?: number;
  /** Total days in the budget's month. */
  totalDays: number;
}

/**
 * Derives actionable budget-status information from a budget's limit, its
 * month-scoped spend, and the month's progress. Pure so it is unit-testable.
 *
 * Status rules:
 * - `idle`     — no limit configured (empty/recently created budget) and no spend.
 * - `over`     — spent exceeds the limit.
 * - `at_risk`  — projected month-end spend exceeds the limit (or spent is
 *                already ≥ 80% of the limit while more than a fifth of the
 *                month remains).
 * - `on_track` — everything else.
 */
export function budgetPace({
  limit,
  spent,
  isCurrentMonth,
  todayDay,
  totalDays,
}: BudgetPaceInput): BudgetPace {
  const day = isCurrentMonth
    ? Math.min(Math.max(1, todayDay ?? 1), totalDays)
    : totalDays;
  const daysLeft = isCurrentMonth ? Math.max(1, totalDays - day + 1) : 0;

  const remaining = Math.max(0, limit - spent);
  const overspent = limit > 0 && spent > limit;
  const pctUsed = limit > 0 ? spent / limit : 0;

  // Straight-line projection from actual burn so far. Past months are
  // complete, so the projection is simply what was spent.
  const elapsedDays = Math.max(1, day);
  const projectedSpend = isCurrentMonth
    ? (spent / elapsedDays) * totalDays
    : spent;

  const dailyLeft = isCurrentMonth ? remaining / daysLeft : null;

  let status: BudgetPaceStatus;
  if (limit <= 0 && spent <= 0) {
    status = "idle";
  } else if (overspent) {
    status = "over";
  } else if (
    limit > 0 &&
    isCurrentMonth &&
    // Tiny epsilon guards against floating-point drift like 500/30*30 > 500.
    (projectedSpend > limit + 1e-6 ||
      (pctUsed >= 0.8 && daysLeft > totalDays / 5))
  ) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  return { status, pctUsed, projectedSpend, dailyLeft, remaining, overspent };
}
export function overspendDeltaCents(
  limitRaw: number | string,
  spentRaw: number | string,
): number {
  const limitCents = Math.round(safeAmount(limitRaw) * 100);
  const spentCents = Math.round(safeAmount(spentRaw) * 100);
  return Math.abs(limitCents - spentCents) / 100;
}
