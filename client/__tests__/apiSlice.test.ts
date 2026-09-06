/**
 * apiSlice tests — the behavioral core of the RTK Query data layer.
 *
 * Pins the contracts that replaced the old thunk/cache machinery:
 *  - page-1 replaces, page-N appends with id deduping
 *  - pagination metadata is always the backend-authoritative envelope and is
 *    never fabricated (the old cache invented `totalPages: 1` / `hasNextPage:
 *    false`, permanently disabling infinite scroll for cached months)
 *  - month + filter sets form distinct cache entries; page is excluded from
 *    the key so load-more accumulates into one entry
 *  - mutations invalidate only the affected months' tags
 */

/// <reference types="jest" />

import { configureStore } from "@reduxjs/toolkit";
import transactionApi from "@/api/transaction";
import budgetApi from "@/api/budget";
import financialSummaryApi from "@/api/financialSummary";
import api from "@/store/api/apiSlice";
import type { GetTransactionsArgs } from "@/store/api/apiSlice";

jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: {
    fetchAll: jest.fn(),
    fetchSuggestions: jest.fn(),
    applySuggestions: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
}));

const mockedTxFetch = transactionApi.fetchAll as jest.Mock;
const mockedTxCreate = transactionApi.create as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;
const mockedSummaryFetch = financialSummaryApi.fetchSummary as jest.Mock;
const mockedSuggestionsFetch = budgetApi.fetchSuggestions as jest.Mock;
const mockedApplySuggestions = budgetApi.applySuggestions as jest.Mock;
const mockedBudgetCreate = budgetApi.create as jest.Mock;

const makeTx = (id: string) => ({
  id,
  name: `Tx ${id}`,
  month: 4,
  year: 2026,
  category: "Food",
  amount: 10,
  date: "2026-05-01T00:00:00.000Z",
  type: "EXPENSE",
});

const txResponse = (items: any[], page = 1, totalCount = items.length) => ({
  success: true,
  message: "ok",
  data: {
    transaction: items,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / 20),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / 20),
      hasPrevPage: page > 1,
      limit: 20,
    },
  },
});

function makeStore() {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      calendar: (s: any = { month: 4, year: 2026 }) => s,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
}

const args = (
  overrides: Partial<GetTransactionsArgs> = {},
): GetTransactionsArgs => ({
  currentMonth: 4,
  currentYear: 2026,
  searchQuery: "",
  page: 1,
  ...overrides,
});

beforeEach(() => {
  mockedTxFetch.mockReset();
  mockedTxCreate.mockReset();
  mockedBudgetFetch.mockReset();
  mockedSummaryFetch.mockReset();
  mockedSuggestionsFetch.mockReset();
  mockedApplySuggestions.mockReset();
  mockedSummaryFetch.mockResolvedValue({
    success: true,
    data: { totalAmount: 0, monthlyIncome: 0 },
  });
});

describe("getTransactions – merge & pagination", () => {
  it("stores backend-authoritative pagination metadata", async () => {
    // 45 total transactions → 3 pages. Page 1 must NOT claim one page.
    mockedTxFetch.mockResolvedValue(txResponse([makeTx("t-1")], 1, 45));

    const store = makeStore();
    await store.dispatch(api.endpoints.getTransactions.initiate(args()));

    const entry = (store.getState().api.queries as any)[
      Object.keys(store.getState().api.queries)[0]
    ];
    expect(entry?.data?.pagination).toEqual({
      currentPage: 1,
      totalPages: 3,
      totalCount: 45,
      hasNextPage: true,
      hasPrevPage: false,
      limit: 20,
    });
  });

  it("replaces the list on page 1 and appends on later pages without duplicates", async () => {
    mockedTxFetch.mockImplementation(async ({ page }: any) =>
      txResponse(
        page === 1 ? [makeTx("t-1"), makeTx("t-2")] : [makeTx("t-3")],
        page ?? 1,
        45,
      ),
    );

    const store = makeStore();
    const first = store.dispatch(
      api.endpoints.getTransactions.initiate(args()),
    );
    await first.unwrap();
    first.unsubscribe();

    const second = store.dispatch(
      api.endpoints.getTransactions.initiate(args({ page: 2 })),
    );
    await second.unwrap();
    second.unsubscribe();

    const entry = (store.getState().api.queries as any)[
      Object.keys(store.getState().api.queries)[0]
    ];
    expect(entry?.data?.transaction.map((t: any) => t.id)).toEqual([
      "t-1",
      "t-2",
      "t-3",
    ]);
    // Latest authoritative metadata wins.
    expect(entry?.data?.pagination?.currentPage).toBe(2);
    expect(entry?.data?.pagination?.hasNextPage).toBe(true);
  });

  it("a post-mutation page-1 refresh replaces the accumulated list without duplicates", async () => {
    let serverItems = ["t-1", "t-2"];
    mockedTxFetch.mockImplementation(async ({ page }: any) => {
      const p = page ?? 1;
      if (p === 1) return txResponse(serverItems.map(makeTx), 1, 40);
      // Page 2 overlaps page 1's tail (server list shifted by an insert).
      return txResponse([makeTx(serverItems[1]), makeTx("t-3")], p, 40);
    });

    const store = makeStore();
    const req1 = store.dispatch(api.endpoints.getTransactions.initiate(args()));
    await req1.unwrap();
    req1.unsubscribe();

    const req2 = store.dispatch(
      api.endpoints.getTransactions.initiate(args({ page: 2 })),
    );
    await req2.unwrap();
    req2.unsubscribe();

    // A create happens; the hook resets to page 1 and re-subscribes, which
    // must REPLACE the accumulated entry with the authoritative first window
    // (server now also includes t-0). No duplicates may ever appear.
    serverItems = ["t-0", "t-1", "t-2"];
    await store.dispatch(
      api.endpoints.createTransaction.initiate({
        name: "New",
        month: 4,
        year: 2026,
        category: "Food",
        amount: 5,
        date: "2026-05-02T00:00:00.000Z",
        type: "EXPENSE",
        budgetId: null,
        baseCurrency: "USD",
        originalCurrency: "USD",
        originalAmount: 5,
      } as any),
    );

    const refetch = store.dispatch(
      api.endpoints.getTransactions.initiate(args()),
    );
    await refetch.unwrap();

    const entry = (store.getState().api.queries as any)[
      Object.keys(store.getState().api.queries)[0]
    ];
    const ids = entry?.data?.transaction.map((t: any) => t.id);
    expect(ids).toEqual(["t-0", "t-1", "t-2"]); // authoritative replace
    expect(new Set(ids).size).toBe(ids.length); // no duplicates ever
  });

  it("keeps separate cache entries per filter set but excludes page from the key", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([], 1));
    const store = makeStore();

    await store
      .dispatch(api.endpoints.getTransactions.initiate(args()))
      .unwrap();
    await store
      .dispatch(api.endpoints.getTransactions.initiate(args({ page: 2 })))
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getTransactions.initiate(args({ searchQuery: "coffee" })),
      )
      .unwrap();

    const keys = Object.keys(store.getState().api.queries);
    expect(keys).toHaveLength(2); // unfiltered entry (pages 1+2 merged), search entry
  });
});

describe("mutation invalidation scoping", () => {
  it("invalidates only the affected months' tags on create", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([]));
    mockedTxCreate.mockResolvedValue({
      success: true,
      message: "created",
      data: { transaction: makeTx("t-new") },
    });

    const store = makeStore();
    await store
      .dispatch(api.endpoints.getTransactions.initiate(args()))
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getBudgets.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getFinancialSummary.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    // A different month must stay untouched.
    const otherMonth = store.dispatch(
      api.endpoints.getTransactions.initiate(
        args({ currentMonth: 5, currentYear: 2026 }),
      ),
    );
    await otherMonth.unwrap();
    otherMonth.unsubscribe();
    mockedTxFetch.mockClear();
    mockedBudgetFetch.mockClear();
    mockedSummaryFetch.mockClear();

    await store.dispatch(
      api.endpoints.createTransaction.initiate({
        name: "New",
        month: 4,
        year: 2026,
        category: "Food",
        amount: 5,
        date: "2026-05-01T00:00:00.000Z",
        type: "EXPENSE",
        budgetId: null,
        baseCurrency: "USD",
        originalCurrency: "USD",
        originalAmount: 5,
      } as any),
    );

    // Transaction mutations deliberately do NOT self-invalidate the
    // Transactions tag (the hook's page-1 reset drives that refresh instead —
    // see useTransactionSearch). The DERIVED month resources must still be
    // refreshed exactly once for the affected month.
    expect(mockedTxFetch).not.toHaveBeenCalled();
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
    expect(mockedSummaryFetch).toHaveBeenCalledTimes(1);
    expect(mockedSummaryFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
  });

  it("refetches budgets when the month tag is invalidated by a transaction mutation", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([]));
    mockedBudgetFetch.mockResolvedValue({ success: true, data: [] });
    const store = makeStore();

    const budgetsReq = store.dispatch(
      api.endpoints.getBudgets.initiate({ currentMonth: 4, currentYear: 2026 }),
    );
    await budgetsReq.unwrap();
    mockedBudgetFetch.mockClear();

    await store.dispatch(
      api.endpoints.deleteTransaction.initiate({
        id: "t-1",
        invalidateMonths: [{ year: 2026, month: 4 }],
      }),
    );

    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
  });
});

describe("month race safety", () => {
  it("keeps per-month entries independent — no cross-month clobbering", async () => {
    mockedTxFetch.mockImplementation(async ({ currentMonth }: any) =>
      txResponse([makeTx(`tx-${currentMonth}`)]),
    );

    const store = makeStore();
    const april = store.dispatch(
      api.endpoints.getTransactions.initiate(args({ currentMonth: 3 })),
    );
    const may = store.dispatch(
      api.endpoints.getTransactions.initiate(args({ currentMonth: 4 })),
    );
    // Resolve out of order.
    await Promise.all([may.unwrap().catch(() => {}), april.unwrap()]);
    may.unsubscribe();
    april.unsubscribe();

    const entries = Object.values(store.getState().api.queries);
    const ids = entries.map((e: any) => e.data?.transaction[0]?.id).sort();
    expect(ids).toEqual(["tx-3", "tx-4"]);
  });
});

describe("Smart Month Setup", () => {
  const suggestionsPayload = {
    success: true,
    data: { year: 2026, month: 4, suggestions: [] },
  };

  it("caches suggestions per month under the Suggestions tag", async () => {
    mockedSuggestionsFetch.mockResolvedValue(suggestionsPayload);
    const store = makeStore();

    await store
      .dispatch(
        api.endpoints.getBudgetSuggestions.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();

    // Second subscription to the SAME month is served from cache.
    await store
      .dispatch(
        api.endpoints.getBudgetSuggestions.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    expect(mockedSuggestionsFetch).toHaveBeenCalledTimes(1);

    // A different month hits the network again (distinct cache entry).
    await store
      .dispatch(
        api.endpoints.getBudgetSuggestions.initiate({
          currentMonth: 5,
          currentYear: 2026,
        }),
      )
      .unwrap();
    expect(mockedSuggestionsFetch).toHaveBeenCalledTimes(2);
  });

  it("apply invalidates Budgets, Summary, and Suggestions for the target month only", async () => {
    mockedSuggestionsFetch.mockResolvedValue(suggestionsPayload);
    mockedApplySuggestions.mockResolvedValue({
      success: true,
      message: "applied",
      data: {
        year: 2026,
        month: 4,
        created: 1,
        updated: 0,
        skipped: 0,
        skippedItems: [],
        budgets: [],
      },
    });
    mockedBudgetFetch.mockResolvedValue({ success: true, data: [] });

    const store = makeStore();

    // Prime the caches for April and May.
    await store
      .dispatch(
        api.endpoints.getBudgets.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getFinancialSummary.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getBudgetSuggestions.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    const mayBudgets = store.dispatch(
      api.endpoints.getBudgets.initiate({ currentMonth: 5, currentYear: 2026 }),
    );
    await mayBudgets.unwrap();
    mayBudgets.unsubscribe();

    mockedBudgetFetch.mockClear();
    mockedSummaryFetch.mockClear();
    mockedSuggestionsFetch.mockClear();

    await store
      .dispatch(
        api.endpoints.applyBudgetSuggestions.initiate({
          month: 4,
          year: 2026,
          items: [{ category: "Food", limit: 250 }],
        }),
      )
      .unwrap();

    // The applied month's budgets, summary, AND suggestions all refresh…
    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
    expect(mockedSummaryFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
    expect(mockedSuggestionsFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
    // …exactly once each.
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
    // …while May's cached budgets stay untouched.
    expect(mockedBudgetFetch).not.toHaveBeenCalledWith({
      currentMonth: 5,
      currentYear: 2026,
    });
  });

  it("createBudget invalidates Budgets and Suggestions for the target month", async () => {
    mockedSuggestionsFetch.mockResolvedValue(suggestionsPayload);
    mockedBudgetCreate.mockResolvedValue({
      success: true,
      data: {
        id: "b-new",
        category: "Entertainment",
        limit: 100,
        month: 4,
        year: 2026,
      },
    });
    mockedBudgetFetch.mockResolvedValue({ success: true, data: [] });

    const store = makeStore();

    // Prime the suggestions and budgets cache for April.
    await store
      .dispatch(
        api.endpoints.getBudgets.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        api.endpoints.getBudgetSuggestions.initiate({
          currentMonth: 4,
          currentYear: 2026,
        }),
      )
      .unwrap();

    mockedBudgetFetch.mockClear();
    mockedSuggestionsFetch.mockClear();

    await store
      .dispatch(
        api.endpoints.createBudget.initiate({
          category: "Entertainment",
          limit: 100,
          month: 4,
          year: 2026,
        }),
      )
      .unwrap();

    // Both budgets AND suggestions must be invalidated and refetched.
    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
    expect(mockedSuggestionsFetch).toHaveBeenCalledWith({
      currentMonth: 4,
      currentYear: 2026,
    });
  });
});

describe("getTransactions – canonical query arguments & cache keys", () => {
  it("canonicalizes omitted, undefined, null, and explicit limit to identical cache entry", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([makeTx("tx-canon-1")]));
    const store = makeStore();

    // 1. Omitted limit
    const req1 = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
      }),
    );
    await req1.unwrap();
    req1.unsubscribe();

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 20 }),
    );

    // 2. Explicit limit: 20 (must hit existing cache entry, no duplicate fetch)
    const req2 = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
        limit: 20,
      }),
    );
    await req2.unwrap();
    req2.unsubscribe();
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    // 3. limit: undefined (must hit existing cache entry, no duplicate fetch)
    const req3 = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
        limit: undefined,
      }),
    );
    await req3.unwrap();
    req3.unsubscribe();
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    // 4. limit: null (must hit existing cache entry, no duplicate fetch)
    const req4 = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
        limit: null as any,
      }),
    );
    await req4.unwrap();
    req4.unsubscribe();
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    // Exactly one cache entry in store
    const queryKeys = Object.keys(store.getState().api.queries);
    expect(queryKeys.filter((k) => k.includes("getTransactions"))).toHaveLength(
      1,
    );
  });

  it("preserves distinct cache entries when a different limit is requested", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([makeTx("tx-custom")]));
    const store = makeStore();

    const reqDefault = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
      }),
    );
    await reqDefault.unwrap();
    reqDefault.unsubscribe();

    const reqCustom = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
        limit: 10,
      }),
    );
    await reqCustom.unwrap();
    reqCustom.unsubscribe();

    expect(mockedTxFetch).toHaveBeenCalledTimes(2);
    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 10 }),
    );

    const queryKeys = Object.keys(store.getState().api.queries);
    expect(queryKeys.filter((k) => k.includes("getTransactions"))).toHaveLength(
      2,
    );
  });

  it("resetApiState completely wipes query cache", async () => {
    mockedTxFetch.mockResolvedValue(txResponse([makeTx("tx-wipe")]));
    const store = makeStore();

    const req = store.dispatch(
      api.endpoints.getTransactions.initiate({
        currentMonth: 4,
        currentYear: 2026,
        searchQuery: "",
        page: 1,
      }),
    );
    await req.unwrap();
    req.unsubscribe();

    expect(Object.keys(store.getState().api.queries)).toHaveLength(1);

    store.dispatch(api.util.resetApiState());

    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });
});
