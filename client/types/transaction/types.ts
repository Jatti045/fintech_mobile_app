// ─── Transaction Domain Types ───────────────────────────────────────────────

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

/** Full transaction shape as returned by the API / stored in Redux slices. */
export interface ITransaction {
  id?: string;
  name: string;
  month: number;
  year: number;
  category: string;
  amount: number;
  date: string;
  type: TransactionType;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
  budgetId?: string | null;
  goalId?: string | null;
}

export interface ITransactionPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface ITransactionFilter {
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  budgetId?: string;
  goalId?: string;
}

export interface ITransactionResponse<T> {
  success: boolean;
  message: string;
  data: {
    transaction: T;
    pagination?: ITransactionPagination;
    filters?: ITransactionFilter;
  };
}

export interface TransactionState {
  transactions: ITransaction[];
  isLoading: boolean;
  error: string | null;
  filter: {
    category: string | null;
    dateRange: { start: string | null; end: string | null };
  };
  totalIncome: number;
  totalExpense: number;
  balance: number;
  isAdding: boolean;
  isEditing: boolean;
  editingTransaction: ITransaction | null;
  isDeleting: boolean;
  deleteError: string | null;
  isFetchingSummary: boolean;
  summary: {
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    monthlyTrends: { month: string; income: number; expense: number }[];
    topExpenses: ITransaction[];
    topIncomes: ITransaction[];
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  monthSummary: {
    totalAmount: number;
  };
  isLoadingMore: boolean;
}

/** Minimal shape of a transaction as stored in Redux. */
export interface TransactionItem {
  id: string;
  name: string;
  amount: number | string;
  date: string;
  category: string;
  budgetId?: string;
  type?: string;
  icon?: string;
}

/** A single day-group for the SectionList. */
export interface GroupedSection {
  title: string;
  data: TransactionItem[];
  /** Aggregated spend for the day in dollars (computed with integer-cent math). */
  total: number;
}
