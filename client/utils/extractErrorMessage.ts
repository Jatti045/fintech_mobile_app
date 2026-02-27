/**
 * Normalizes any thrown value into a user-facing error string.
 *
 * Handles the shapes returned by Axios interceptors, Redux Toolkit
 * `rejectWithValue`, and plain `Error` objects so every thunk can
 * use a one-liner instead of a repeated ternary chain.
 */
export function extractErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (!error) return fallback;

  // Plain string (e.g. rejectWithValue("msg"))
  if (typeof error === "string") return error;

  // Standard Error or Axios-normalised shape
  if (typeof error === "object") {
    const e = error as Record<string, any>;

    // Prefer explicit message
    if (typeof e.message === "string" && e.message) return e.message;

    // Axios response wrapper
    if (e.data && typeof e.data.message === "string") return e.data.message;

    // response.data nesting from apiClient
    if (e.response?.data?.message) return e.response.data.message;
  }

  return fallback;
}
