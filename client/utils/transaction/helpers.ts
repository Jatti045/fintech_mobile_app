// ─── Pure helpers (module-scope — never recreated) ──────────────────────────

/**
 * Returns a user-friendly label for a date key string.
 * @returns "Today" | "Yesterday" | locale-formatted date
 */
export function friendlyDayLabel(dayKey: string): string {
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
export function safeAmount(raw: number | string | undefined | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sums an array of amounts using **integer-cent accumulation** to avoid
 * floating-point drift common in financial calculations.
 *
 * @example sumAmountsCents([1.1, 2.2]) // => 3.30 (not 3.3000000000000003)
 */
export function sumAmountsCents(items: { amount: number | string }[]): number {
  const totalCents = items.reduce(
    (acc, tx) => acc + Math.round(safeAmount(tx.amount) * 100),
    0,
  );
  return totalCents / 100;
}
/**
 * Builds a day-of-month spend series (daily totals, not cumulative) for all
 * EXPENSE transactions within the given month, using integer-cent math.
 *
 * Returns an array aligned to the month (index = day - 1) so it can be used
 * directly to render daily spend bars / sparklines.
 */
export function buildDailySpendTotals(
  transactions: {
    date?: string;
    amount?: number | string;
    type?: string;
    isTransfer?: boolean;
  }[],
  month: number,
  year: number,
): { day: number; total: number }[] {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const byDay: Record<number, number> = {};

  for (const tx of transactions) {
    if (!tx.date) continue;
    if ((tx.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") continue;
    // Transfers between the user's own accounts are not spending.
    if (tx.isTransfer) continue;

    const d = new Date(tx.date);
    if (d.getUTCMonth() !== month || d.getUTCFullYear() !== year) continue;

    const cents = Math.round(safeAmount(tx.amount) * 100);
    byDay[d.getUTCDate()] = (byDay[d.getUTCDate()] || 0) + cents;
  }

  const series: { day: number; total: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    series.push({ day, total: (byDay[day] || 0) / 100 });
  }
  return series;
}
