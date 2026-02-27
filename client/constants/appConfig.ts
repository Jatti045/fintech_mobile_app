/**
 * Centralized application-wide constants.
 *
 * Every "magic number" or repeated literal that was previously duplicated
 * across screens, hooks, and slices now lives here.  Import from this file
 * so changes propagate everywhere automatically.
 */

// ── Authentication ───────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 6;
export const OTP_LENGTH = 6;

// ── Transactions ─────────────────────────────────────────────────────────────
export const MAX_TRANSACTION_AMOUNT = 1_000_000;
export const PAGINATION_LIMIT = 10;

// ── Budgets ──────────────────────────────────────────────────────────────────
export const BUDGET_PRESET_AMOUNTS = [25, 50, 100, 200, 500] as const;

// ── Networking ───────────────────────────────────────────────────────────────
export const API_TIMEOUT_MS = 60_000;

// ── Cache ────────────────────────────────────────────────────────────────────
export const CACHE_TTL_MS = 3_600_000; // 1 hour

// ── Currency ─────────────────────────────────────────────────────────────────
export const DEFAULT_CURRENCY_CODE = "USD";

// ── OTP ──────────────────────────────────────────────────────────────────────
export const OTP_RESEND_COOLDOWN_S = 60;
