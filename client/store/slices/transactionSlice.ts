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
};

export const fetchTransaction = createAsyncThunk(
  "transactions/fetchAll",
  async (
    {
      searchQuery = "",
      currentMonth,
      currentYear,
      startDate = null,
      endDate = null,
      useCache = true,
    }: {
      searchQuery: string;
      currentMonth: number;
      currentYear: number;
      startDate?: string | null;
      endDate?: string | null;
      useCache?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      // If allowed, return cached data immediately to avoid API call
      if (useCache) {
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
                });
                const toStore = fresh.data?.transaction ?? fresh.data ?? [];
                await setTransactionsCache(currentYear, currentMonth, toStore);
              } catch (err) {
                // ignore background revalidation errors
              }
            })();
            return { transaction: cached } as any;
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
      // Fetch Transactions
      .addCase(fetchTransaction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransaction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload.transaction;
        state.error = null;
      })
      .addCase(fetchTransaction.rejected, (state, action) => {
        state.isLoading = false;
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
        state.transactions.push(
          action.payload.data?.transaction ?? action.payload.data
        );
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
