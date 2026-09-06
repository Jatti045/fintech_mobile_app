/**
 * useTransactionScreen hook tests.
 *
 * Covers the orchestration moved out of the Transactions screen: initial
 * loading / empty state, search + search-clear skeleton suppression, filter
 * loader coordination, selected budget / min / max normalization, pull-to-
 * refresh, load-more wiring, edit/delete handlers, and loader messages.
 *
 * Data flows through the mocked API modules behind the RTK Query endpoints;
 * mounting the harness subscribes and auto-fetches (replacing the old slice
 * seeding), so helpers poll-within-act until queries settle.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import transactionApi from "@/api/transaction";
import budgetApi from "@/api/budget";
import financialSummaryApi from "@/api/financialSummary";
import { useTransactionScreen } from "@/hooks/transaction/useTransactionScreen";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { TransactionType } from "@/types/transaction/types";
import type { TransactionItem } from "@/types/transaction/types";

const textMock = Text as unknown as jest.Mock;
const activityIndicatorMock = ActivityIndicator as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

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
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;

type Screen = ReturnType<typeof useTransactionScreen>;

const makeTx = (overrides: Partial<TransactionItem> = {}): TransactionItem => ({
  id: "t-1",
  name: "Coffee",
  amount: 10,
  date: "2026-02-10T09:00:00.000Z",
  category: "Food",
  baseCurrency: "USD",
  type: TransactionType.EXPENSE,
  ...overrides,
});

const txEnvelope = (
  items: TransactionItem[],
  pagination?: Record<string, unknown>,
) => ({
  success: true,
  message: "ok",
  data: {
    transaction: items,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalCount: items.length,
      hasNextPage: false,
      hasPrevPage: false,
      limit: 20,
      ...pagination,
    },
  },
});

/**
 * Resolves on demand, but with a safety timeout so an unresolved gate can
 * never wedge the suite (the display-amount effects keep re-running while a
 * query is in flight, so pending requests must stay bounded in tests).
 */
function gatedResponse(value: any, safetyMs = 500) {
  let resolveNow!: (v: any) => void;
  const timer = setTimeout(() => resolveNow(value), safetyMs);
  const promise = new Promise<any>((res) => {
    resolveNow = (v: any) => {
      clearTimeout(timer);
      res(v);
    };
  });
  return { promise, resolve: resolveNow };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Repeatedly act-flushes until the predicate holds (RTKQ fulfillment is
 * async). The bare harness can miss external-store notifications in the test
 * renderer, so each pass forces a re-render via `tree.update` before the
 * predicate is evaluated.
 */
async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
    if (activeRoot) {
      renderer.act(() => {
        activeRoot!.tree.update(activeRoot!.build());
      });
    }
    if (pred()) return;
  }
  throw new Error("timed out waiting for expected store/hook state");
}

/** Force the active harness to re-render and observe latest store state. */
function refresh() {
  if (activeRoot) {
    renderer.act(() => {
      activeRoot!.tree.update(activeRoot!.build());
    });
  }
}

/** Root of the currently-mounted harness, for forced re-renders in `until`. */
let activeRoot: {
  tree: renderer.ReactTestRenderer;
  build: () => React.ReactElement;
} | null = null;

const txQueries = (store: { getState(): unknown }) =>
  Object.values((store.getState() as any).api.queries).filter(
    (q: any) => q.endpointName === "getTransactions",
  ) as any[];
/** Every started getTransactions request has landed (none left pending). */
const txSettled = (store: { getState(): unknown }) => {
  const list = txQueries(store);
  return list.length > 0 && list.every((q) => q.status === "fulfilled");
};

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
}

async function setup(options: { awaitData?: boolean } = {}) {
  const store = makeStore();

  const captured: { current: Screen | null } = { current: null };

  function Harness() {
    captured.current = useTransactionScreen();
    return null;
  }

  const build = () => (
    <Provider store={store}>
      <AlertProvider>
        <Harness />
      </AlertProvider>
    </Provider>
  );

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(build());
  });
  activeRoot = { tree, build };

  if (options.awaitData !== false) {
    // Wait for the seeded responses, then give the display-amount effect
    // (query data -> state mirror) two more observed renders.
    await until(() => txSettled(store));
    await renderer.act(async () => {
      await flush();
    });
    refresh();
    await renderer.act(async () => {
      await flush();
    });
  }

  return { captured, store };
}

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

function touchableContainsText(children: unknown, text: string): boolean {
  if (typeof children === "string") return children.includes(text);
  if (Array.isArray(children)) {
    return children.some((child) => touchableContainsText(child, text));
  }
  if (React.isValidElement(children)) {
    // Only walk props.children — never _owner (which can be circular).
    const elementChildren = (children.props as { children?: unknown }).children;
    return touchableContainsText(elementChildren, text);
  }
  return false;
}

function lastTouchableContaining(text: string) {
  const calls = touchableOpacityMock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && touchableContainsText(props.children, text)) {
      return props;
    }
  }
  return undefined;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedBudgetFetch.mockReset();
  textMock.mockClear();
  activityIndicatorMock.mockClear();
  touchableOpacityMock.mockClear();
  // Mounting a subscription auto-fetches; default to an empty month.
  mockedTxFetch.mockResolvedValue(txEnvelope([]));
  mockedBudgetFetch.mockResolvedValue({ success: true, data: [] });
  (financialSummaryApi.fetchSummary as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      totalAmount: 0,
      monthlyIncome: 0,
      actualIncome: 0,
      expectedIncome: 0,
    },
  });
});

describe("useTransactionScreen", () => {
  it("shows the initial-loading spinner, then the empty state", async () => {
    // An in-flight request stands in for the old `fetchTransaction.pending`
    // dispatch (bounded by a safety timeout instead of never resolving).
    const gate = gatedResponse(txEnvelope([]));
    mockedTxFetch.mockReturnValue(gate.promise);
    const { captured, store } = await setup({ awaitData: false });

    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBeGreaterThan(0);

    renderer.act(() => {
      gate.resolve(txEnvelope([]));
    });
    await until(() => txSettled(store));
    refresh();
    activityIndicatorMock.mockClear();

    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(renderedText("No transactions match filters.")).toBe(true);
  });

  it("tracks search state and arms skeleton suppression when clearing", async () => {
    const { captured, store } = await setup();

    renderer.act(() => {
      captured.current!.handleSearchQueryChange("coffee");
    });
    expect(captured.current!.searchQuery).toBe("coffee");
    expect(captured.current!.isSearching).toBe(true);

    // Let the debounce fire so the search fetch is genuinely in flight.
    const gate = gatedResponse(txEnvelope([]));
    mockedTxFetch.mockReturnValue(gate.promise);
    await until(() => mockedTxFetch.mock.calls.length >= 2);

    // While the clear-search fetch is still loading, the initial skeleton
    // must stay suppressed (no spinner in listEmpty).
    renderer.act(() => {
      captured.current!.handleSearchQueryChange("");
    });
    expect(captured.current!.searchQuery).toBe("");
    expect(captured.current!.isSearching).toBe(false);

    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBe(0);

    renderer.act(() => {
      gate.resolve(txEnvelope([]));
    });
    await until(() => txSettled(store));
  });

  it("switches All → Category → All repeatedly without a stuck loader", async () => {
    // Stage filtered vs unfiltered responses up front so the initial All
    // cache entry is seeded and the category entry always refetches (RTKQ
    // forceRefetch only forces fetches for args WITH active filters).
    mockedTxFetch.mockImplementation(async (args: any) =>
      args?.budgetId
        ? txEnvelope([
            makeTx({
              id: "budget-row",
              name: "Bacon",
              category: "Food",
              budgetId: "b-1",
            }),
          ])
        : txEnvelope([
            makeTx({
              id: "all-row",
              name: "Coffee",
              category: "Food",
              budgetId: "b-1",
            }),
          ]),
    );
    const { captured, store } = await setup();

    const rowIds = () =>
      captured.current!.sectionsWithTotals[0]?.data?.map((t) => t.id) ?? [];

    // All → Category
    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-1");
    });
    await until(() => txSettled(store));
    refresh();
    expect(rowIds()).toEqual(["budget-row"]);
    expect(captured.current!.loaderMessage).toBe("");
    expect(captured.current!.isLoaderVisible).toBe(false);

    // Category → All — the previously-broken transition. The unfiltered
    // args are served from the existing RTKQ cache entry, so isFetching
    // never flips; the screen must still reach a terminal state instantly.
    renderer.act(() => {
      captured.current!.setFilterCategoryId("all");
    });
    await until(() => txSettled(store));
    refresh();
    expect(rowIds()).toEqual(["all-row"]);
    expect(captured.current!.loaderMessage).toBe("");
    expect(captured.current!.isLoaderVisible).toBe(false);

    // Repeat the toggle cycle twice more: every transition must settle.
    for (const target of ["b-1", "all", "b-1", "all"]) {
      renderer.act(() => {
        captured.current!.setFilterCategoryId(target);
      });
      await until(() => txSettled(store));
      refresh();
      expect(rowIds()).toEqual(target === "b-1" ? ["budget-row"] : ["all-row"]);
      expect(captured.current!.loaderMessage).toBe("");
      expect(captured.current!.isLoaderVisible).toBe(false);
    }
  });

  it("shows the standard screen loader for a new filter fetch and never a Filtering overlay", async () => {
    const { captured, store } = await setup();

    const gate = gatedResponse(
      txEnvelope([
        makeTx({ id: "t-f", name: "Salad", category: "Food", budgetId: "b-9" }),
      ]),
    );
    mockedTxFetch.mockReturnValue(gate.promise);

    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-9");
    });
    // The new cache entry has no data yet and the request is in flight, so
    // the standard loader (isInitialLoading) must render — not an overlay.
    await until(() =>
      txQueries(store).some((q: any) => q.status === "pending"),
    );
    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBeGreaterThan(0);
    expect(renderedText("Filtering transactions…")).toBe(false);
    expect(captured.current!.loaderMessage).toBe("");
    expect(captured.current!.isLoaderVisible).toBe(false);

    renderer.act(() => {
      gate.resolve(
        txEnvelope([
          makeTx({
            id: "t-f",
            name: "Salad",
            category: "Food",
            budgetId: "b-9",
          }),
        ]),
      );
    });
    await until(() => txSettled(store));
    refresh();
    expect(captured.current!.sectionsWithTotals[0].data[0].id).toBe("t-f");
    expect(captured.current!.loaderMessage).toBe("");
    expect(captured.current!.isLoaderVisible).toBe(false);

    // Settled: the standard loader is no longer rendered.
    activityIndicatorMock.mockClear();
    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(activityIndicatorMock.mock.calls.length).toBe(0);
  });

  it("clears loading when a filter fetch lands on empty results", async () => {
    const { captured, store } = await setup();

    // beforeEach default serves an empty envelope; forceRefetch makes the
    // category args always hit the network.
    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-empty");
    });
    await until(() => txSettled(store));
    refresh();

    expect(captured.current!.sectionsWithTotals).toHaveLength(0);
    expect(captured.current!.loaderMessage).toBe("");
    expect(captured.current!.isLoaderVisible).toBe(false);
    renderer.act(() => {
      renderer.create(captured.current!.listEmpty);
    });
    expect(renderedText("No transactions match filters.")).toBe(true);
  });

  it("serves a previously-fetched filter set from cache without refetching", async () => {
    mockedTxFetch.mockImplementation(async (args: any) =>
      args?.budgetId
        ? txEnvelope([
            makeTx({ id: "budget-row", name: "Bacon", budgetId: "b-1" }),
          ])
        : txEnvelope([makeTx({ id: "all-row", name: "Coffee" })]),
    );
    const { captured } = await setup();
    mockedTxFetch.mockClear();

    // All → Category refetches (active filters always hit the network).
    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-1");
    });
    await until(() => mockedTxFetch.mock.calls.length === 1);
    const callsAfterCategory = mockedTxFetch.mock.calls.length;

    // Category → All reuses the cached unfiltered entry: no network request.
    renderer.act(() => {
      captured.current!.setFilterCategoryId("all");
    });
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(mockedTxFetch.mock.calls.length).toBe(callsAfterCategory);
    expect(captured.current!.sectionsWithTotals[0].data[0].id).toBe("all-row");
  });

  it("normalizes selected budget/min/max and passes them to the refresh fetch", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.setFilterCategoryId("b-1");
      captured.current!.setMinAmount("10");
      captured.current!.setMaxAmount("20");
    });
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        budgetId: "b-1",
        minAmount: 10,
        maxAmount: 20,
      }),
    );
  });

  it("treats a blank min/max as null and a non-numeric as zero", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.setMinAmount("");
      captured.current!.setMaxAmount("abc");
    });
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ minAmount: null, maxAmount: 0 }),
    );
  });

  it("refreshes transactions and budgets together", async () => {
    const { captured } = await setup();
    mockedTxFetch.mockClear();
    mockedBudgetFetch.mockClear();

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
  });

  it("wires the footer load-more action to fetch the next page", async () => {
    // Backend-authoritative pagination seeds the feed with more pages.
    mockedTxFetch.mockResolvedValue(
      txEnvelope([makeTx()], {
        currentPage: 1,
        totalPages: 3,
        totalCount: 45,
        hasNextPage: true,
      }),
    );
    const { captured, store } = await setup();
    mockedTxFetch.mockClear();

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>{captured.current!.listFooter}</Provider>,
      );
    });
    void tree;

    const loadMore = lastTouchableContaining("Load More Transactions");
    expect(loadMore).toBeDefined();
    renderer.act(() => {
      loadMore!.onPress();
    });
    await until(() => mockedTxFetch.mock.calls.length >= 1);

    expect(mockedTxFetch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("opens the edit modal and clears editing on close", async () => {
    const { captured } = await setup();
    const tx = makeTx();

    const row = captured.current!.renderItem({ item: tx });
    renderer.act(() => {
      row.props.onEdit(tx);
    });
    expect(captured.current!.openSheet).toBe(true);
    expect(captured.current!.editingTransaction?.id).toBe("t-1");

    renderer.act(() => {
      captured.current!.handleModalClose();
    });
    expect(captured.current!.editingTransaction).toBeNull();
  });

  it("wires the row delete action to the confirmation prompt", async () => {
    const { captured } = await setup();
    const tx = makeTx({ id: "t-9", name: "Ride", category: "Transport" });

    const row = captured.current!.renderItem({ item: tx });
    renderer.act(() => {
      row.props.onDelete(tx.id);
    });

    expect(renderedText("Delete Transaction")).toBe(true);
  });

  it("selects the correct loader message for each operation", async () => {
    const { captured, store } = await setup();

    // Mutation loaders read state.api.mutations.<name>.status === "pending",
    // so start real RTKQ mutations instead of dispatching thunk action types.
    let req: any = store.dispatch(
      api.endpoints.createTransaction.initiate({
        name: "New",
        month: 1,
        year: 2026,
        date: "2026-02-02T00:00:00.000Z",
        category: "Food",
        amount: 5,
        type: TransactionType.EXPENSE,
      } as any),
    );
    refresh();
    expect(captured.current!.loaderMessage).toBe("Adding transaction…");
    expect(captured.current!.isLoaderVisible).toBe(true);
    await renderer.act(async () => {
      await req.unwrap().catch(() => {});
      await flush();
    });

    req = store.dispatch(
      api.endpoints.updateTransaction.initiate({
        id: "t-1",
        updates: {},
        invalidateMonths: [{ year: 2026, month: 1 }],
      }),
    );
    refresh();
    expect(captured.current!.loaderMessage).toBe("Updating transaction…");
    await renderer.act(async () => {
      await req.unwrap().catch(() => {});
      await flush();
    });

    req = store.dispatch(
      api.endpoints.deleteTransaction.initiate({
        id: "t-1",
        invalidateMonths: [{ year: 2026, month: 1 }],
      }),
    );
    refresh();
    expect(captured.current!.loaderMessage).toBe("Deleting transaction…");
    await renderer.act(async () => {
      await req.unwrap().catch(() => {});
      await flush();
    });
  });

  it("collapses accumulated pages to an authoritative page 1 after a mutation settles", async () => {
    const { captured, store } = await setup();

    // Give the month two server pages: reconfigure the backend, then let a
    // real pull-to-refresh land the authoritative page-1 envelope.
    mockedTxFetch.mockImplementation(async ({ page }: any) =>
      (page ?? 1) === 1
        ? txEnvelope([makeTx()], {
            currentPage: 1,
            totalPages: 2,
            totalCount: 25,
            hasNextPage: true,
          })
        : txEnvelope([makeTx({ id: "t-2", name: "Second" })], {
            currentPage: 2,
            totalPages: 2,
            totalCount: 25,
            hasNextPage: false,
          }),
    );
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    const entryWith = (): any =>
      (Object.values((store.getState() as any).api.queries) as any[]).find(
        (q: any) => q.endpointName === "getTransactions",
      );
    const ids = () => entryWith()?.data?.transaction?.map((t: any) => t.id);

    await until(() => entryWith()?.data?.pagination?.hasNextPage === true);

    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <Provider store={store}>{captured.current!.listFooter}</Provider>,
      );
    });
    void tree;
    const loadMore = lastTouchableContaining("Load More Transactions");
    expect(loadMore).toBeDefined();
    renderer.act(() => {
      loadMore!.onPress();
    });
    await until(() =>
      mockedTxFetch.mock.calls.some((c) => (c[0] as any)?.page === 2),
    );
    await until(() => ids()?.length === 2);

    // A deletion settles → the feed must collapse to a fresh authoritative
    // page-1 fetch whose merge REPLACES the list (no ghost rows from the old
    // page-2 accumulation).
    mockedTxFetch.mockClear();
    await renderer.act(async () => {
      await store
        .dispatch(
          api.endpoints.deleteTransaction.initiate({
            id: "t-2",
            invalidateMonths: [{ year: 2026, month: 1 }],
          }),
        )
        .unwrap()
        .catch(() => {});
      await flush();
    });

    await until(() => mockedTxFetch.mock.calls.length > 0);
    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    await until(() => {
      const list = ids();
      return list?.length === 1 && list[0] === "t-1";
    });
  });

  it("groups seeded transactions into sections and exposes render callbacks", async () => {
    mockedTxFetch.mockResolvedValue(
      txEnvelope([
        makeTx({ id: "a", date: "2026-02-10T09:00:00.000Z" }),
        makeTx({ id: "b", date: "2026-02-10T18:00:00.000Z" }),
      ]),
    );
    const { captured } = await setup();

    expect(captured.current!.sectionsWithTotals).toHaveLength(1);
    expect(captured.current!.sectionsWithTotals[0].data).toHaveLength(2);
    expect(captured.current!.sectionsWithTotals[0].total).toBe(20);

    const header = captured.current!.renderSectionHeader({
      section: captured.current!.sectionsWithTotals[0],
    });
    expect(React.isValidElement(header)).toBe(true);

    const row = captured.current!.renderItem({ item: makeTx() });
    expect(React.isValidElement(row)).toBe(true);

    expect(captured.current!.keyExtractor(makeTx({ id: "abc" }), 0)).toBe(
      "abc",
    );
    expect(captured.current!.keyExtractor(makeTx({ id: undefined }), 3)).toBe(
      "3",
    );
  });
});
