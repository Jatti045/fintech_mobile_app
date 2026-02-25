import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "../store";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Custom hooks for common user state selections
export const useAuth = () => {
  return useAppSelector((state) => ({
    user: state.user.user,
    token: state.user.token,
    isAuthenticated: state.user.isAuthenticated,
    isLoading: state.user.isLoading,
    error: state.user.error,
    loginError: state.user.loginError,
    signupError: state.user.signupError,
  }));
};

export const useUser = () => {
  return useAppSelector((state) => state.user.user);
};

export const useAuthStatus = () => {
  return useAppSelector((state) => ({
    isAuthenticated: state.user.isAuthenticated,
    isLoading: state.user.isLoading,
  }));
};

// Custom hooks for transaction state selections
export const useTransactions = () => {
  return useAppSelector((state) => state.transaction.transactions);
};

export const useTransactionStatus = () => {
  return useAppSelector((state) => ({
    isAdding: state.transaction.isAdding,
    isEditing: state.transaction.isEditing,
    isDeleting: state.transaction.isDeleting,
    isLoading: state.transaction.isLoading,
    isLoadingMore: state.transaction.isLoadingMore,
    error: state.transaction.error,
  }));
};

export const useTransactionPagination = () => {
  return useAppSelector((state) => state.transaction.pagination);
};

export const useTransactionMonthSummary = () => {
  return useAppSelector((state) => state.transaction.monthSummary);
};

// Custom hooks for budget state selections
export const useBudgets = () => {
  return useAppSelector((state) => state.budget.budgets);
};

export const useCalendar = () => {
  return useAppSelector((state) => ({
    month: state.calendar.month,
    year: state.calendar.year,
  }));
};

// Custom hook for theme state selection
export const useTheme = () => {
  return useAppSelector((state) => state.theme);
};
