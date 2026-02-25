/**
 * Budget slice – reducer-level unit tests.
 *
 * Tests the budgetSlice's own CRUD cases as well as the cross-slice effects
 * where createTransaction.fulfilled and deleteTransaction.fulfilled modify the
 * budget `spent` field.
 */

import budgetReducer, {
  BudgetState,
  IBudget,
  createBudget,
  fetchBudgets,
  deleteBudget,
  updateBudget,
} from "@/store/slices/budgetSlice";
import {
  createTransaction,
  deleteTransaction,
} from "@/store/slices/transactionSlice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initialState: BudgetState = {
  budgets: [],
  loading: false,
  error: null,
};

const makeBudget = (overrides: Partial<IBudget> = {}): IBudget => ({
  id: "b-1",
  date: new Date("2026-02-01"),
  category: "Food",
  icon: "coffee",
  limit: 500,
  spent: 100,
  userId: "user-1",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

const stateWith = (...budgets: IBudget[]): BudgetState => ({
  ...initialState,
  budgets,
});

// ---------------------------------------------------------------------------
// createBudget
// ---------------------------------------------------------------------------

describe("budgetSlice – createBudget", () => {
  it("30. sets loading=true on pending", () => {
    const action = { type: createBudget.pending.type };
    const state = budgetReducer(initialState, action);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("31. pushes budget to array on fulfilled", () => {
    const budget = makeBudget();
    const action = {
      type: createBudget.fulfilled.type,
      payload: { data: budget },
    };
    const state = budgetReducer(initialState, action);
    expect(state.loading).toBe(false);
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe("b-1");
  });

  it("32. sets error on rejected", () => {
    const action = {
      type: createBudget.rejected.type,
      payload: "Duplicate category",
    };
    const state = budgetReducer(initialState, action);
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Duplicate category");
  });
});

// ---------------------------------------------------------------------------
// fetchBudgets
// ---------------------------------------------------------------------------

describe("budgetSlice – fetchBudgets", () => {
  it("33. sets loading=true on pending", () => {
    const action = { type: fetchBudgets.pending.type };
    const state = budgetReducer(initialState, action);
    expect(state.loading).toBe(true);
  });

  it("34. replaces budgets array on fulfilled", () => {
    const existing = stateWith(makeBudget({ id: "old" }));
    const action = {
      type: fetchBudgets.fulfilled.type,
      payload: [makeBudget({ id: "new" })],
    };
    const state = budgetReducer(existing, action);
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe("new");
  });

  it("35. sets error on rejected", () => {
    const action = {
      type: fetchBudgets.rejected.type,
      payload: "Unauthorized",
    };
    const state = budgetReducer(initialState, action);
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// deleteBudget
// ---------------------------------------------------------------------------

describe("budgetSlice – deleteBudget", () => {
  it("36. sets loading=true on pending", () => {
    const action = { type: deleteBudget.pending.type };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.loading).toBe(true);
  });

  it("37. removes budget by id on fulfilled", () => {
    const action = {
      type: deleteBudget.fulfilled.type,
      payload: { data: "b-1" },
    };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.budgets).toHaveLength(0);
  });

  it("38. leaves other budgets intact on delete", () => {
    const two = stateWith(makeBudget({ id: "b-1" }), makeBudget({ id: "b-2" }));
    const action = {
      type: deleteBudget.fulfilled.type,
      payload: { data: "b-1" },
    };
    const state = budgetReducer(two, action);
    expect(state.budgets).toHaveLength(1);
    expect(state.budgets[0].id).toBe("b-2");
  });

  it("39. sets error on rejected", () => {
    const action = {
      type: deleteBudget.rejected.type,
      payload: "Budget not found",
    };
    const state = budgetReducer(initialState, action);
    expect(state.error).toBe("Budget not found");
  });
});

// ---------------------------------------------------------------------------
// updateBudget
// ---------------------------------------------------------------------------

describe("budgetSlice – updateBudget", () => {
  it("40. sets loading=true on pending", () => {
    const action = { type: updateBudget.pending.type };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.loading).toBe(true);
  });

  it("41. merges updated fields into matching budget on fulfilled", () => {
    const action = {
      type: updateBudget.fulfilled.type,
      payload: { data: { id: "b-1", limit: 800 } },
    };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.budgets[0].limit).toBe(800);
    // Other fields should be preserved via spread
    expect(state.budgets[0].category).toBe("Food");
  });

  it("42. no-ops when updated id is not in state", () => {
    const action = {
      type: updateBudget.fulfilled.type,
      payload: { data: { id: "unknown", limit: 999 } },
    };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.budgets[0].limit).toBe(500);
  });

  it("43. sets error on rejected", () => {
    const action = {
      type: updateBudget.rejected.type,
      payload: "Validation error",
    };
    const state = budgetReducer(stateWith(makeBudget()), action);
    expect(state.error).toBe("Validation error");
  });
});

// ---------------------------------------------------------------------------
// Cross-slice: createTransaction.fulfilled → budget spent
// ---------------------------------------------------------------------------

describe("budgetSlice – cross-slice createTransaction.fulfilled", () => {
  it("44. increments spent on matching budget by budgetId", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const tx = { amount: 50, type: "EXPENSE", budgetId: "b-1" };
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(150);
  });

  it("45. matches budget by category when budgetId is absent", () => {
    const budget = makeBudget({ id: "b-1", category: "Food", spent: 10 });
    const tx = { amount: 5, type: "EXPENSE", category: "food" }; // lowercase
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(15);
  });

  it("46. does not increment spent for INCOME transactions", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const tx = { amount: 50, type: "INCOME", budgetId: "b-1" };
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(100);
  });

  it("47. ignores transactions with zero amount", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const tx = { amount: 0, type: "EXPENSE", budgetId: "b-1" };
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(100);
  });

  it("48. rounds spent to 2 decimal places", () => {
    const budget = makeBudget({ id: "b-1", spent: 10.1 });
    const tx = { amount: 5.123, type: "EXPENSE", budgetId: "b-1" };
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    // 10.1 + 5.12 (rounded) = 15.22
    expect(state.budgets[0].spent).toBe(15.22);
  });
});

// ---------------------------------------------------------------------------
// Cross-slice: deleteTransaction.fulfilled → budget spent
// ---------------------------------------------------------------------------

describe("budgetSlice – cross-slice deleteTransaction.fulfilled", () => {
  it("49. decrements spent via restoredBudget payload", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: {
        data: {
          restoredBudget: { budgetId: "b-1", amountRestored: 30 },
        },
      },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(70);
  });

  it("50. spent never goes below 0 after decrement", () => {
    const budget = makeBudget({ id: "b-1", spent: 10 });
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: {
        data: {
          restoredBudget: { budgetId: "b-1", amountRestored: 50 },
        },
      },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(0);
  });

  it("51. falls back to deleted transaction payload when restoredBudget is absent", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const tx = { amount: 25, type: "EXPENSE", budgetId: "b-1" };
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(75);
  });

  it("52. matches by category in fallback when budgetId is absent", () => {
    const budget = makeBudget({ id: "b-1", category: "Food", spent: 50 });
    const tx = { amount: 10, type: "EXPENSE", category: "food" };
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(40);
  });

  it("53. no-op when payload has no useful data", () => {
    const budget = makeBudget({ id: "b-1", spent: 100 });
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "tx-1" } },
    };
    const state = budgetReducer(stateWith(budget), action);
    expect(state.budgets[0].spent).toBe(100);
  });
});
