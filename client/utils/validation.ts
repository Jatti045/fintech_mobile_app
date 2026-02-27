/**
 * Shared validation helpers.
 *
 * Every auth screen (login, signup, forgot-password, reset-password) and
 * every CRUD hook (budget, transaction) now calls into these pure functions
 * instead of duplicating regex / length checks inline.
 *
 * Each validator returns `{ valid: true }` or `{ valid: false, message }`.
 */

import {
  PASSWORD_MIN_LENGTH,
  MAX_TRANSACTION_AMOUNT,
} from "@/constants/appConfig";

// ── Primitives ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email.trim()) return { valid: false, message: "Email is required" };
  if (!EMAIL_REGEX.test(email.trim()))
    return { valid: false, message: "Please enter a valid email address" };
  return { valid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) return { valid: false, message: "Password is required" };
  if (password.length < PASSWORD_MIN_LENGTH)
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  return { valid: true };
};

// ── Composite form validators ────────────────────────────────────────────────

export const validateLoginForm = (
  email: string,
  password: string,
): ValidationResult => {
  if (!email.trim() || !password.trim())
    return { valid: false, message: "Please fill in all fields" };
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return emailCheck;
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return pwCheck;
  return { valid: true };
};

export const validateSignupForm = (
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
): ValidationResult => {
  if (
    !username.trim() ||
    !email.trim() ||
    !password.trim() ||
    !confirmPassword.trim()
  )
    return { valid: false, message: "Please fill in all fields" };
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return emailCheck;
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return pwCheck;
  if (password !== confirmPassword)
    return { valid: false, message: "Passwords do not match" };
  return { valid: true };
};

export const validateResetPasswordForm = (
  newPassword: string,
  confirmPassword: string,
): ValidationResult => {
  if (!newPassword || !confirmPassword)
    return { valid: false, message: "Please fill both password fields" };
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) return pwCheck;
  if (newPassword !== confirmPassword)
    return { valid: false, message: "Passwords do not match" };
  return { valid: true };
};

// ── Budget & Transaction field validators ────────────────────────────────────

export const validateBudgetForm = (
  category: string,
  icon: string,
  limit: string,
): ValidationResult => {
  if (!category.trim() || !limit.trim() || !icon.trim())
    return {
      valid: false,
      message: "Please enter category, icon, and limit",
    };
  const parsed = Number(limit);
  if (isNaN(parsed) || parsed <= 0)
    return { valid: false, message: "Please enter a valid numeric limit" };
  return { valid: true };
};

export const validateTransactionAmount = (
  amountStr: string,
): ValidationResult => {
  const amt = Number(amountStr);
  if (isNaN(amt) || amt <= 0 || amt > MAX_TRANSACTION_AMOUNT)
    return {
      valid: false,
      message: `Amount must be between 0.01 and ${MAX_TRANSACTION_AMOUNT.toLocaleString()}.`,
    };
  return { valid: true };
};
