import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import transactionAPI, { ITransaction } from "../../api/transaction";
import {
  getTransactionsCache,
  setTransactionsCache,
  appendTransactionToCache,
  removeTransactionFromCacheById,
  removeTransactionFromCacheByIdAcrossAllMonths,
} from "../../utils/cache";

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

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  filter: {
    category: null,
    dateRange: { start: null, end: null },
  },
  totalIncome: 0,
  totalExpense: 0,
  balance: 0,
  isAdding: false,
  isEditing: false,
  editingTransaction: null,
  isDeleting: false,
  deleteError: null,
  isFetchingSummary: false,
  summary: {
    incomeByCategory: {},
    expenseByCategory: {},
    monthlyTrends: [],
    topExpenses: [],
    topIncomes: [],
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  },
  monthSummary: {
    totalAmount: 0,
  },
  isLoadingMore: false,
};

export const fetchTransaction = createAsyncThunk(
  "transactions/fetch",
  async (
    {
      searchQuery = "",
      currentMonth,
      currentYear,
      startDate = null,
      endDate = null,
      useCache = true,
      page = 1,
      limit = 10,
    }: {
      searchQuery: string;
      currentMonth: number;
      currentYear: number;
      startDate?: string | null;
      endDate?: string | null;
      useCache?: boolean;
      page?: number;
      limit?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      console.log("Fetching transactions with params:", currentMonth, currentYear);
      // Disable cache when using pagination beyond first page
      if (page > 1 || !useCache) {
        const response = await transactionAPI.fetchAll({
          searchQuery,
          currentMonth,
          currentYear,
          startDate,
          endDate,
          page,
          limit,
        });

        // persist to cache only for page 1 (overwrite month cache)
        if (page === 1) {
          try {
            const toStore = response.data?.transaction ?? response.data ?? [];
            await setTransactionsCache(currentYear, currentMonth, toStore);
          } catch (err) {
            // ignore
          }
        }

        return response.data;
      }

      // If allowed, return cached data immediately to avoid API call (page 1 only)
      if (useCache && page === 1) {
        try {
          const cached = await getTransactionsCache(currentYear, currentMonth);
          if (cached) {
            // Kick off background revalidation (don't await)
            (async () => {
              try {
                const fresh = await transactionAPI.fetchAll({
                  searchQuery: "",
                  currentMonth,
                  currentYear,
                  page: 1,
                  limit,
                });
                const toStore = fresh.data?.transaction ?? fresh.data ?? [];
                await setTransactionsCache(currentYear, currentMonth, toStore);
              } catch (err) {
                // ignore background revalidation errors
              }
            })();
            // Return cached data with default pagination
            return {
              transaction: cached,
              pagination: {
                currentPage: 1,
                totalPages: 1,
                totalCount: cached.length,
                hasNextPage: false,
                hasPrevPage: false,
                limit: limit,
              },
            } as any;
          }
        } catch (e) {
          // ignore cache errors and fall back to network
        }
      }

      // If we returned cached data above the caller won't know we revalidated;
      // ensure consumers can trigger a background revalidation by calling fetchTransaction with useCache = false.

      const response = await transactionAPI.fetchAll({
        searchQuery,
        currentMonth,
        currentYear,
        startDate,
        endDate,
        page,
        limit,
      });

      // persist to cache (overwrite month cache)
      try {
        const toStore = response.data?.transaction ?? response.data ?? [];
        await setTransactionsCache(currentYear, currentMonth, toStore);
      } catch (err) {
        // ignore
      }

      return response.data;
    } catch (error: any) {
      // On network failure try to return cached data
      try {
        const cached = await getTransactionsCache(currentYear, currentMonth);
        if (cached) return { transaction: cached } as any;
      } catch (err) {
        // ignore
      }
      return rejectWithValue(error.message || "Failed to fetch transactions");
    }
  }
);

// Fetch more transactions (for infinite scroll)
export const fetchMoreTransactions = createAsyncThunk(
  "transactions/fetchMore",
  async (
    {
      searchQuery = "",
      currentMonth,
      currentYear,
      startDate = null,
      endDate = null,
      page = 1,
      limit = 10,
    }: {
      searchQuery: string;
      currentMonth: number;
      currentYear: number;
      startDate?: string | null;
      endDate?: string | null;
      page?: number;
      limit?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await transactionAPI.fetchAll({
        searchQuery,
        currentMonth,
        currentYear,
        startDate,
        endDate,
        page,
        limit,
      });

      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.message || "Failed to fetch more transactions"
      );
    }
  }
);

export const createTransaction = createAsyncThunk(
  "transactions/create",
  async (transaction: ITransaction, { rejectWithValue, getState }) => {
    try {
      const response = await transactionAPI.create(transaction);

      // Update cache for the month the transaction belongs to
      try {
        const created = response.data?.transaction ?? response.data;
        await appendTransactionToCache(created);
      } catch (err) {
        // ignore
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to create transaction");
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  "transactions/delete",
  async (transactionId: string, { rejectWithValue }) => {
    try {
      const response = await transactionAPI.delete(transactionId);
      // Try to update cache via helper (best-effort)
      try {
        const payload: any = response?.data ?? null;
        const deletedTx: any = payload?.transaction ?? null;
        if (deletedTx && deletedTx.date) {
          const d = new Date(deletedTx.date);
          await removeTransactionFromCacheById(
            transactionId,
            d.getFullYear(),
            d.getMonth()
          );
        } else {
          // If server didn't return the deleted tx date, attempt to remove across all cached months
          await removeTransactionFromCacheByIdAcrossAllMonths(transactionId);
        }
      } catch (e) {
        // ignore
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to delete transaction");
    }
  }
);

export const updateTransaction = createAsyncThunk(
  "transactions/update",
  async (
    { id, updates }: { id: string; updates: Partial<ITransaction> },
    { rejectWithValue }
  ) => {
    try {
      console.log("Updating transaction id:", id, "with updates:", updates);

      const response = await transactionAPI.update(id, updates);

      // update cache best-effort: overwrite in month cache if possible
      try {
        const updated = response.data?.transaction ?? response.data;
        if (updated && updated.id) {
          // Defensive: remove any stale copies across all months, then append to the correct month
          try {
            await removeTransactionFromCacheByIdAcrossAllMonths(updated.id);
          } catch (e) {
            // continue
          }

          if (updated.date) {
            const d = new Date(updated.date);
            await appendTransactionToCache(updated);
          }
        }
      } catch (e) {
        // ignore cache errors
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update transaction");
    }
  }
);

const transactionSlice = createSlice({
  name: "transaction",
  initialState,
  reducers: {
    // Synchronous actions can be defined here
  },
  extraReducers: (builder) => {
    builder
      // Fetch Transactions (initial load - replaces transactions)
      .addCase(fetchTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransaction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload.transaction;
        state.error = null;
        // Update pagination info
        if (action.payload.pagination) {
          state.pagination = {
            currentPage: action.payload.pagination.currentPage,
            totalPages: action.payload.pagination.totalPages,
            totalCount: action.payload.pagination.totalCount,
            hasNextPage: action.payload.pagination.hasNextPage,
            hasPrevPage: action.payload.pagination.hasPrevPage,
          };
        }
        // Update month summary (total amount for all transactions in filter)
        if (action.payload.summary) {
          state.monthSummary = {
            totalAmount: action.payload.summary.totalAmount || 0,
          };
        }
      })
      .addCase(fetchTransaction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Fetch More Transactions (infinite scroll - appends transactions)
      .addCase(fetchMoreTransactions.pending, (state) => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(fetchMoreTransactions.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        // Append new transactions to existing ones
        const newTransactions = action.payload.transaction || [];
        state.transactions = [...state.transactions, ...newTransactions];
        state.error = null;
        // Update pagination info
        if (action.payload.pagination) {
          state.pagination = {
            currentPage: action.payload.pagination.currentPage,
            totalPages: action.payload.pagination.totalPages,
            totalCount: action.payload.pagination.totalCount,
            hasNextPage: action.payload.pagination.hasNextPage,
            hasPrevPage: action.payload.pagination.hasPrevPage,
          };
        }
      })
      .addCase(fetchMoreTransactions.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.payload as string;
      })

      // Create Transaction
      .addCase(createTransaction.pending, (state) => {
        state.isAdding = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        console.log("Transaction Payload:", action.payload);

        state.isAdding = false;
        state.error = null;
        const created = action.payload.data?.transaction ?? action.payload.data;
        state.transactions.push(created);

        // Optimistically update monthSummary when an EXPENSE is added
        if (created && (created.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
          state.monthSummary.totalAmount += Number(created.amount || 0);
        }
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.isAdding = false;
        state.error = action.payload as string;
      })
      // Delete Transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.isDeleting = true;
        state.deleteError = null;
      })
      .addCase(deleteTransaction.fulfilled, (state, action: any) => {
        state.isDeleting = false;
        // API returns { data: { deletedTransactionId: id, ... } }
        const payload = action.payload ?? null;
        const deletedId = payload?.data?.deletedTransactionId ?? null;
        if (deletedId) {
          // Find the transaction before removing so we can adjust the summary
          const deletedTx = state.transactions.find((t) => t.id === deletedId);
          if (deletedTx && (deletedTx.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
            const amt = parseFloat(Number(deletedTx.amount || 0).toFixed(2));
            state.monthSummary.totalAmount = parseFloat(
              Math.max(0, state.monthSummary.totalAmount - amt).toFixed(2)
            );
          }
          state.transactions = state.transactions.filter(
            (t) => t.id !== deletedId
          );
          (async () => {
            try {
              await removeTransactionFromCacheById(deletedId);
            } catch (e) {
              // ignore
            }
          })();
        }
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.isDeleting = false;
        state.deleteError = action.payload as string;
      });

    builder
      .addCase(updateTransaction.pending, (state) => {
        state.isEditing = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action: any) => {
        state.isEditing = false;
        state.error = null;
        const updated = action.payload.data?.transaction ?? action.payload.data;
        if (updated && updated.id) {
          // Adjust monthSummary if the amount changed on an EXPENSE transaction
          const oldTx = state.transactions.find((t) => t.id === updated.id);
          if (oldTx && (oldTx.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
            const oldAmt = Number(oldTx.amount || 0);
            const newAmt = Number(updated.amount || 0);
            if (oldAmt !== newAmt) {
              state.monthSummary.totalAmount = Math.max(
                0,
                state.monthSummary.totalAmount - oldAmt + newAmt
              );
            }
          }
          state.transactions = state.transactions.map((t) =>
            t.id === updated.id ? updated : t
          );
        }
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.isEditing = false;
        state.error = action.payload as string;
      });
  },
});

// Optional action: replace transactions array directly (useful after forced re-fetch)
export const { reducer: transactionReducer } = transactionSlice;
export const replaceTransactions = (arr: ITransaction[]) => ({
  type: "transaction/replace",
  payload: arr,
});

export default transactionSlice.reducer;
