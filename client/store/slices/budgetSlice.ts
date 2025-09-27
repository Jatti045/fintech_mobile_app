import { ITransaction } from "@/api/transaction";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import budgetAPI from "@/api/budget";
import {
  getBudgetsCache,
  setBudgetsCache,
  appendBudgetToCache,
  removeBudgetFromCacheById,
  removeBudgetFromCacheByIdAcrossAllMonths,
} from "../../utils/cache";
import { createTransaction } from "./transactionSlice";
import { deleteTransaction } from "./transactionSlice";

export interface IBudget {
  id: string;
  date: Date;
  category: string;
  limit: number;
  spent: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  transactions?: ITransaction[];
}

export interface BudgetState {
  budgets: IBudget[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  loading: false,
  error: null,
};

export const createBudget = createAsyncThunk(
  "budget/createBudget",
  async (
    budgetData: {
      category: string;
      limit: number;
      month: number;
      year: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await budgetAPI.create(budgetData);

      // Update cache for this month/year
      try {
        await appendBudgetToCache(
          response.data,
          budgetData.year,
          budgetData.month
        );
      } catch (e) {
        // ignore
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBudgets = createAsyncThunk(
  "budget/fetchBudgets",
  async (
    {
      currentMonth,
      currentYear,
    }: { currentMonth: number; currentYear: number },
    { rejectWithValue }
  ) => {
    try {
      // First try to use network and update cache
      const response = await budgetAPI.fetchAll({
        currentMonth,
        currentYear,
      });

      // persist budgets cache
      try {
        const toStore = response.data ?? [];
        await setBudgetsCache(currentYear, currentMonth, toStore);
      } catch (e) {
        // ignore
      }

      return response.data;
    } catch (error: any) {
      // attempt to read cache on failure
      try {
        const cached = await getBudgetsCache(currentYear, currentMonth);
        if (cached) {
          // Background revalidation: try to fetch from network and refresh cache
          (async () => {
            try {
              const fresh = await budgetAPI.fetchAll({
                currentMonth,
                currentYear,
              });
              const toStore = fresh.data ?? [];
              await setBudgetsCache(currentYear, currentMonth, toStore);
            } catch (err) {
              // ignore
            }
          })();
          return cached;
        }
      } catch (e) {
        // ignore
      }
      return rejectWithValue(error.message);
    }
  }
);

export const deleteBudget = createAsyncThunk(
  "budget/deleteBudget",
  async (budgetId: string, { rejectWithValue }) => {
    try {
      const response = await budgetAPI.delete(budgetId);
      // remove from cache (best-effort)
      try {
        await removeBudgetFromCacheById(budgetId);
        // Also attempt cross-month invalidation
        await removeBudgetFromCacheByIdAcrossAllMonths(budgetId);
      } catch (e) {
        // ignore
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateBudget = createAsyncThunk(
  "budget/updateBudget",
  async (
    { id, updates }: { id: string; updates: Partial<IBudget> },
    { rejectWithValue }
  ) => {
    try {
      const response = await budgetAPI.update(id, updates as any);
      // try to update cache best-effort
      try {
        const updated = response.data;
        if (updated) {
          await removeBudgetFromCacheById(String(updated.id));
          // add to current month cache
          const d = new Date(updated.date ?? updated.createdAt ?? Date.now());
          await appendBudgetToCache(updated, d.getFullYear(), d.getMonth());
        }
      } catch (e) {
        // ignore
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const budgetSlice = createSlice({
  name: "budget",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBudget.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets.push(action.payload.data);
        (async () => {
          try {
            await appendBudgetToCache(action.payload.data);
          } catch (e) {
            // ignore
          }
        })();
        state.error = null;
      })
      .addCase(createBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = action.payload;
        state.error = null;
        (async () => {
          try {
            const arr = action.payload ?? [];
            if (arr.length > 0) {
              const d = new Date(arr[0].createdAt ?? arr[0].date ?? Date.now());
              await setBudgetsCache(d.getFullYear(), d.getMonth(), arr);
            }
          } catch (e) {
            // ignore
          }
        })();
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteBudget.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload?.data ?? null;
        state.budgets = state.budgets.filter(
          (budget) => budget.id !== deletedId
        );
        (async () => {
          try {
            const id = action.payload?.data ?? null;
            if (id) {
              await removeBudgetFromCacheById(String(id));
              await removeBudgetFromCacheByIdAcrossAllMonths(String(id));
            }
          } catch (e) {
            // ignore
          }
        })();
      })
      .addCase(deleteBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateBudget.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload?.data ?? null;
        if (updated) {
          state.budgets = state.budgets.map((b) =>
            b.id === String(updated.id) ? { ...b, ...updated } : b
          );
        }
      })
      .addCase(updateBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createTransaction.fulfilled, (state, action: any) => {
        // normalize payload (safe for different API shapes)
        const payload = action.payload ?? null;
        const tx =
          (payload && (payload.data?.transaction ?? payload.data ?? payload)) ||
          null;
        if (!tx) return;

        const amount = Math.abs(Number(tx.amount ?? tx.value ?? 0));
        if (!amount || isNaN(amount)) return;
        // round the incoming amount to 2 decimals
        const amt = parseFloat(amount.toFixed(2));

        const txType = String(
          tx.type ?? tx.transactionType ?? "EXPENSE"
        ).toUpperCase();
        // only increment spent for expenses
        if (txType !== "EXPENSE") return;

        const txBudgetId = tx.budgetId ?? tx.budget?.id;

        if (txBudgetId) {
          state.budgets = state.budgets.map((b) => {
            if (b.id !== txBudgetId) return b;
            const current = Number(b.spent ?? 0);
            const newSpent = parseFloat((current + amt).toFixed(2));
            return { ...b, spent: newSpent };
          });
        } else if (tx.category) {
          const txCat = String(tx.category).toLowerCase();
          state.budgets = state.budgets.map((b) => {
            if (String(b.category).toLowerCase() !== txCat) return b;
            const current = Number(b.spent ?? 0);
            const newSpent = parseFloat((current + amt).toFixed(2));
            return { ...b, spent: newSpent };
          });
        }
      })
      .addCase(deleteTransaction.fulfilled, (state, action: any) => {
        const payload = action.payload ?? null;
        // server returns restored budget info under data.restoredBudget
        const restored = payload?.data?.restoredBudget ?? null;
        // If API provided restoredBudget with budgetId and amountRestored, use that
        if (restored && restored.budgetId) {
          const budgetId = restored.budgetId;
          const amt = Number(restored.amountRestored ?? 0) || 0;
          if (amt && !isNaN(amt)) {
            state.budgets = state.budgets.map((b) => {
              if (b.id !== budgetId) return b;
              const current = Number(b.spent ?? 0);
              const newSpent = parseFloat(
                Math.max(0, current - amt).toFixed(2)
              );
              return { ...b, spent: newSpent };
            });
            return;
          }
        }

        // Fallback: try to deduce from returned deletedTransactionId by no-op
        // or from payload.data (some APIs may return the deleted transaction)
        const deletedTx = payload?.data?.transaction ?? payload?.data ?? null;
        if (deletedTx) {
          const amount = Math.abs(Number(deletedTx.amount ?? 0)) || 0;
          if (!amount || isNaN(amount)) return;
          const amt = parseFloat(amount.toFixed(2));

          const txBudgetId = deletedTx.budgetId ?? deletedTx.budget?.id;
          if (txBudgetId) {
            state.budgets = state.budgets.map((b) => {
              if (b.id !== txBudgetId) return b;
              const current = Number(b.spent ?? 0);
              const newSpent = parseFloat(
                Math.max(0, current - amt).toFixed(2)
              );
              return { ...b, spent: newSpent };
            });
          } else if (deletedTx.category) {
            const txCat = String(deletedTx.category).toLowerCase();
            state.budgets = state.budgets.map((b) => {
              if (String(b.category).toLowerCase() !== txCat) return b;
              const current = Number(b.spent ?? 0);
              const newSpent = parseFloat(
                Math.max(0, current - amt).toFixed(2)
              );
              return { ...b, spent: newSpent };
            });
          }
        }
      });
  },
});

export default budgetSlice.reducer;
