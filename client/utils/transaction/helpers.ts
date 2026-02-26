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
