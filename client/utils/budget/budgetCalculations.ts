/**
 * Budget-specific calculation helpers.
 *
 * All monetary maths use **integer-cent arithmetic** to avoid
 * floating-point drift (e.g. `150.10 - 100.20` → `49.90`, not `49.900…01`).
 */

// Re-export the canonical safeAmount so existing imports don't break
export { safeAmount } from "@/utils/transaction/helpers";
import { safeAmount } from "@/utils/transaction/helpers";

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
