/**
 * Budget-specific calculation helpers.
 *
 * All monetary maths use **integer-cent arithmetic** to avoid
 * floating-point drift (e.g. `150.10 - 100.20` → `49.90`, not `49.900…01`).
 */

/**
 * Safely coerces a possibly-string or undefined value to a finite number.
 * Returns `0` for NaN / Infinity / undefined / null — never throws.
 */
export function safeAmount(raw: number | string | undefined | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes the overspend delta using **integer-cent math** to prevent
 * floating-point drift.
 *
 * @returns The absolute difference in dollars, safe for display.
 */
export function overspendDeltaCents(
  limitRaw: number | string,
  spentRaw: number | string,
): number {
  const limitCents = Math.round(safeAmount(limitRaw) * 100);
  const spentCents = Math.round(safeAmount(spentRaw) * 100);
  return Math.abs(limitCents - spentCents) / 100;
}
