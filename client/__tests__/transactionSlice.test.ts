/**
 * Transaction slice – reducer-level unit tests.
 *
 * These tests exercise the synchronous reducer cases that are triggered by the
 * extraReducers builder (pending / fulfilled / rejected) for every transaction
 * async thunk.  The async thunks themselves hit the network; here we only care
 * about how the reducer mutates state in response to those action types.
 */

import transactionReducer, {
  TransactionState,
  fetchTransaction,
  fetchMoreTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/store/slices/transactionSlice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  filter: { category: null, dateRange: { start: null, end: null } },
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
  monthSummary: { totalAmount: 0 },
  isLoadingMore: false,
};

/** Factory for a minimal transaction object used in tests. */
const makeTx = (overrides: Record<string, any> = {}) => ({
  id: "tx-1",
  name: "Coffee",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 5.5,
  date: "2026-02-01T00:00:00.000Z",
  type: "EXPENSE",
  ...overrides,
});

// ---------------------------------------------------------------------------
// fetchTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – fetchTransaction", () => {
  it("1. sets isLoading=true on pending", () => {
    const action = { type: fetchTransaction.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("2. stores transactions and pagination on fulfilled", () => {
    const payload = {
      transaction: [makeTx()],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalCount: 15,
        hasNextPage: true,
        hasPrevPage: false,
      },
      summary: { totalAmount: 42 },
    };
    const action = { type: fetchTransaction.fulfilled.type, payload };
    const state = transactionReducer(initialState, action);

    expect(state.isLoading).toBe(false);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].name).toBe("Coffee");
    expect(state.pagination.totalCount).toBe(15);
    expect(state.pagination.hasNextPage).toBe(true);
    expect(state.monthSummary.totalAmount).toBe(42);
  });

  it("3. sets error on rejected", () => {
    const action = {
      type: fetchTransaction.rejected.type,
      payload: "Network error",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network error");
  });

  it("4. clears previous error on new pending", () => {
    const errorState = { ...initialState, error: "old error" };
    const action = { type: fetchTransaction.pending.type };
    const state = transactionReducer(errorState, action);
    expect(state.error).toBeNull();
  });

  it("5. replaces (not appends) transactions on fulfilled", () => {
    const stateWithExisting = {
      ...initialState,
      transactions: [makeTx({ id: "old-1" })] as any[],
    };
    const payload = {
      transaction: [makeTx({ id: "new-1" })],
      pagination: initialState.pagination,
    };
    const action = { type: fetchTransaction.fulfilled.type, payload };
    const state = transactionReducer(stateWithExisting, action);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].id).toBe("new-1");
  });
});

// ---------------------------------------------------------------------------
// fetchMoreTransactions (infinite scroll)
// ---------------------------------------------------------------------------

describe("transactionSlice – fetchMoreTransactions", () => {
  it("6. sets isLoadingMore=true on pending", () => {
    const action = { type: fetchMoreTransactions.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isLoadingMore).toBe(true);
  });

  it("7. appends transactions on fulfilled", () => {
    const stateWith = {
      ...initialState,
      transactions: [makeTx({ id: "a" })] as any[],
    };
    const payload = {
      transaction: [makeTx({ id: "b" })],
      pagination: {
        currentPage: 2,
        totalPages: 3,
        totalCount: 25,
        hasNextPage: true,
        hasPrevPage: true,
      },
    };
    const action = { type: fetchMoreTransactions.fulfilled.type, payload };
    const state = transactionReducer(stateWith, action);
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions[1].id).toBe("b");
    expect(state.pagination.currentPage).toBe(2);
  });

  it("8. sets error on rejected", () => {
    const action = {
      type: fetchMoreTransactions.rejected.type,
      payload: "timeout",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isLoadingMore).toBe(false);
    expect(state.error).toBe("timeout");
  });

  it("9. handles empty page gracefully", () => {
    const stateWith = {
      ...initialState,
      transactions: [makeTx({ id: "a" })] as any[],
    };
    const payload = {
      transaction: [],
      pagination: {
        currentPage: 2,
        totalPages: 2,
        totalCount: 1,
        hasNextPage: false,
        hasPrevPage: true,
      },
    };
    const action = { type: fetchMoreTransactions.fulfilled.type, payload };
    const state = transactionReducer(stateWith, action);
    expect(state.transactions).toHaveLength(1);
    expect(state.pagination.hasNextPage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – createTransaction", () => {
  it("10. sets isAdding=true on pending", () => {
    const action = { type: createTransaction.pending.type };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(true);
    expect(state.error).toBeNull();
  });

  it("11. pushes the created transaction on fulfilled", () => {
    const tx = makeTx({ id: "new-tx" });
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(false);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].id).toBe("new-tx");
  });

  it("12. increments monthSummary for EXPENSE on fulfilled", () => {
    const tx = makeTx({ amount: 25, type: "EXPENSE" });
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(
      { ...initialState, monthSummary: { totalAmount: 100 } },
      action,
    );
    expect(state.monthSummary.totalAmount).toBe(125);
  });

  it("13. does NOT increment monthSummary for INCOME on fulfilled", () => {
    const tx = makeTx({ amount: 25, type: "INCOME" });
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(
      { ...initialState, monthSummary: { totalAmount: 100 } },
      action,
    );
    expect(state.monthSummary.totalAmount).toBe(100);
  });

  it("14. sets error on rejected", () => {
    const action = {
      type: createTransaction.rejected.type,
      payload: "server down",
    };
    const state = transactionReducer(initialState, action);
    expect(state.isAdding).toBe(false);
    expect(state.error).toBe("server down");
  });

  it("15. uses default type EXPENSE when type is missing", () => {
    const tx = makeTx({ amount: 10 });
    delete (tx as any).type;
    const action = {
      type: createTransaction.fulfilled.type,
      payload: { data: { transaction: tx } },
    };
    const state = transactionReducer(
      { ...initialState, monthSummary: { totalAmount: 0 } },
      action,
    );
    // Default should be treated as EXPENSE → summary increases
    expect(state.monthSummary.totalAmount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – deleteTransaction", () => {
  const stateWithTx: TransactionState = {
    ...initialState,
    transactions: [
      makeTx({ id: "tx-1", amount: 30, type: "EXPENSE" }),
    ] as any[],
    monthSummary: { totalAmount: 30 },
  };

  it("16. sets isDeleting=true on pending", () => {
    const action = { type: deleteTransaction.pending.type };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(true);
    expect(state.deleteError).toBeNull();
  });

  it("17. removes transaction from state on fulfilled", () => {
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "tx-1" } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(false);
    expect(state.transactions).toHaveLength(0);
  });

  it("18. decrements monthSummary for deleted EXPENSE", () => {
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "tx-1" } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.monthSummary.totalAmount).toBe(0);
  });

  it("19. monthSummary never goes below 0", () => {
    const badState = {
      ...stateWithTx,
      monthSummary: { totalAmount: 5 }, // less than the tx amount of 30
    };
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "tx-1" } },
    };
    const state = transactionReducer(badState, action);
    expect(state.monthSummary.totalAmount).toBe(0);
  });

  it("20. no-ops if deletedTransactionId is missing from payload", () => {
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: {} },
    };
    const state = transactionReducer(stateWithTx, action);
    // Should remain unchanged
    expect(state.transactions).toHaveLength(1);
  });

  it("21. sets deleteError on rejected", () => {
    const action = {
      type: deleteTransaction.rejected.type,
      payload: "not found",
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isDeleting).toBe(false);
    expect(state.deleteError).toBe("not found");
  });

  it("22. does not decrement monthSummary for deleted INCOME transaction", () => {
    const incomeState: TransactionState = {
      ...initialState,
      transactions: [
        makeTx({ id: "inc-1", amount: 100, type: "INCOME" }),
      ] as any[],
      monthSummary: { totalAmount: 50 },
    };
    const action = {
      type: deleteTransaction.fulfilled.type,
      payload: { data: { deletedTransactionId: "inc-1" } },
    };
    const state = transactionReducer(incomeState, action);
    // Should still remove the transaction
    expect(state.transactions).toHaveLength(0);
    // But monthSummary (tracks expenses) should be untouched
    expect(state.monthSummary.totalAmount).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

describe("transactionSlice – updateTransaction", () => {
  const stateWithTx: TransactionState = {
    ...initialState,
    transactions: [
      makeTx({ id: "tx-1", amount: 20, name: "Old Name", type: "EXPENSE" }),
    ] as any[],
    monthSummary: { totalAmount: 20 },
  };

  it("23. sets isEditing=true on pending", () => {
    const action = { type: updateTransaction.pending.type };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(true);
    expect(state.error).toBeNull();
  });

  it("24. replaces matching transaction on fulfilled", () => {
    const updated = makeTx({ id: "tx-1", amount: 35, name: "New Name" });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(false);
    expect(state.transactions[0].name).toBe("New Name");
    expect(state.transactions[0].amount).toBe(35);
  });

  it("25. adjusts monthSummary when EXPENSE amount changes", () => {
    const updated = makeTx({ id: "tx-1", amount: 35, type: "EXPENSE" });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    // was 20, now 35 → summary should be 20 - 20 + 35 = 35
    expect(state.monthSummary.totalAmount).toBe(35);
  });

  it("26. does not adjust monthSummary when amount stays the same", () => {
    const updated = makeTx({
      id: "tx-1",
      amount: 20,
      name: "Renamed",
      type: "EXPENSE",
    });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.monthSummary.totalAmount).toBe(20);
  });

  it("27. sets error on rejected", () => {
    const action = {
      type: updateTransaction.rejected.type,
      payload: "forbidden",
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.isEditing).toBe(false);
    expect(state.error).toBe("forbidden");
  });

  it("28. no-ops if updated transaction id is not in state", () => {
    const updated = makeTx({ id: "unknown-id", amount: 999 });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(stateWithTx, action);
    expect(state.transactions[0].id).toBe("tx-1");
    expect(state.transactions[0].amount).toBe(20);
  });

  it("29. monthSummary never goes below 0 after update", () => {
    const weirdState = {
      ...stateWithTx,
      monthSummary: { totalAmount: 5 },
    };
    const updated = makeTx({ id: "tx-1", amount: 0, type: "EXPENSE" });
    const action = {
      type: updateTransaction.fulfilled.type,
      payload: { data: { transaction: updated } },
    };
    const state = transactionReducer(weirdState, action);
    expect(state.monthSummary.totalAmount).toBe(0);
  });
});
