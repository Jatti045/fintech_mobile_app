// Export everything from store
export { store, type RootState, type AppDispatch } from "./store";

// Export hooks
export {
  useAppDispatch,
  useAppSelector,
  useAuth,
  useUser,
  useAuthStatus,
} from "../hooks/useRedux";

// Export user slice actions and selectors
export {
  loginUser,
  signupUser,
  logoutUser,
  loadUserFromStorage,
  clearError,
  clearLoginError,
  clearSignupError,
  setLoading,
  resetUserState,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
  selectLoginError,
  selectSignupError,
  selectToken,
} from "./slices/userSlice";

// Export user slice types
export type { UserState } from "./slices/userSlice";
