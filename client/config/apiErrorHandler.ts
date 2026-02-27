import { store } from "@/store/store";
import { hapticError } from "@/utils/haptics";

/**
 * Unified API error type returned by the response interceptor.
 * Every rejected promise from `apiClient` resolves to this shape.
 */
export interface ApiError {
  message: string;
  status?: number;
  data?: any;
}

/**
 * Ref-holder for the `showAlert` function exposed by `AlertProvider`.
 *
 * Because the Axios interceptor runs outside the React tree we can't call
 * `useThemedAlert()` directly. Instead `AlertProvider` registers its
 * `showAlert` here on mount so the interceptor can trigger the themed modal.
 */
let _showAlert: ((opts: { title: string; message?: string }) => void) | null =
  null;

export const registerAlertRef = (
  fn: (opts: { title: string; message?: string }) => void,
) => {
  _showAlert = fn;
};

export const unregisterAlertRef = () => {
  _showAlert = null;
};

/**
 * Decides whether the interceptor should show a global error toast.
 * Skips login/signup routes (those screens handle their own errors).
 */
const SILENT_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/register"];

/**
 * Called by the Axios response-error interceptor.
 * Shows a themed alert for unexpected errors, fires haptic feedback, and
 * returns a normalised `ApiError` object.
 */
export function handleApiError(error: any): ApiError {
  const defaultMsg = "An unexpected error occurred.";
  const normalized: ApiError = {
    message: error?.response?.data?.message || error?.message || defaultMsg,
    status: error?.response?.status,
    data: error?.response?.data,
  };

  // Determine whether this endpoint should be handled silently
  const url = error?.config?.url ?? "";
  const isSilent = SILENT_ENDPOINTS.some((ep) => url.includes(ep));

  // Fire haptic on every API error
  hapticError();

  // Show a global alert for non-auth, non-network-cancel errors
  if (!isSilent && normalized.status !== 401 && _showAlert) {
    const title =
      normalized.status && normalized.status >= 500
        ? "Server Error"
        : "Request Failed";
    _showAlert({ title, message: normalized.message });
  }

  return normalized;
}
