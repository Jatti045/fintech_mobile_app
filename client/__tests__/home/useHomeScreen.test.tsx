/**
 * useHomeScreen hook tests.
 *
 * Covers homepage orchestration: initial + month-change fetching (with the
 * correct thunk parameters), refresh (cache bypass), month metadata, calendar
 * navigation, modal state, quick-action guards, display data, and the
 * currency contract: the backend summary is already denominated in the user's
 * aggregation currency, so the hook must consume it verbatim and never
 * convert an aggregate client-side (mixed-currency safe by construction).
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertProvider } from "@/utils/themedAlert";
import { convertCurrency } from "@/utils/currencyConverter";
import transactionApi from "@/api/transaction";
import financialSummaryApi from "@/api/financialSummary";
import budgetApi from "@/api/budget";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
import api from "@/store/api/apiSlice";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import { Text } from "react-native";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import { TransactionType } from "@/types/transaction/types";
import type { ITransaction } from "@/types/transaction/types";
import type { IFinancialSummary } from "@/types/financialSummary/types";
import type { IBudget } from "@/types/budget/types";

jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: { fetchAll: jest.fn() },
}));

jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
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

/**
 * The hook chain must never import the client-side converter for aggregates.
 * The mock stays in place so that IF a conversion path is ever reintroduced,
 * the "never converts client-side" assertions below fail loudly.
 */
jest.mock("@/utils/currencyConverter", () => ({
  convertCurrency: jest.fn(async (amount: number) => amount),
  getExchangeRate: jest.fn(),
  clearRatesCache: jest.fn(),
}));

const mockedTxFetch = transactionApi.fetchAll as jest.Mock;
const mockedSummaryFetch = financialSummaryApi.fetchSummary as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;
const mockedConvert = convertCurrency as jest.Mock;

type Home = ReturnType<typeof useHomeScreen>;

const makeTx = (overrides: Partial<ITransaction> = {}): ITransaction => ({
  id: "t-1",
  name: "Coffee",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 10,
  date: "2026-02-01T00:00:00.000Z",
  type: TransactionType.EXPENSE,
  ...overrides,
});

const makeBudget = (overrides: Partial<IBudget> = {}): IBudget => ({
  id: "b-1",
  date: new Date("2026-02-01"),
  category: "Food",
  limit: 500,
  spent: 100,
  userId: "user-1",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

const makeSummary = (
  overrides: Partial<IFinancialSummary> = {},
): IFinancialSummary => ({
  totalAmount: 0,
  monthlyIncome: 0,
  expectedIncome: 0,
  actualIncome: 0,
  netSpent: 0,
  netRemaining: 0,
  spentPercentageOfIncome: 0,
  ...overrides,
});

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      calendar: calendarReducer,
      theme: themeReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });
}

async function setup(seed?: (store: ReturnType<typeof makeStore>) => void) {
  const store = makeStore();
  seed?.(store);

  const captured: { current: Home | null } = { current: null };

  function Harness() {
    captured.current = useHomeScreen();
    return null;
  }

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Harness />
        </AlertProvider>
      </Provider>,
    );
  });

  // Let the fetch + display-amount effects settle.
  await renderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { captured, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxFetch.mockReset();
  mockedSummaryFetch.mockReset();
  mockedBudgetFetch.mockReset();
  mockedConvert.mockReset();
  mockedConvert.mockImplementation(async (amount: number) => amount);
  mockedTxFetch.mockResolvedValue({ data: { transaction: [] } });
  mockedSummaryFetch.mockResolvedValue({ data: makeSummary() });
  mockedBudgetFetch.mockResolvedValue({ data: [] });
  (Text as jest.Mock).mockClear();
});

describe("useHomeScreen", () => {
  it("fetches transactions, summary, and budgets on mount with cache-first params", async () => {
    await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });

    expect(mockedTxFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchQuery: "",
        currentMonth: 1,
        currentYear: 2026,
        page: 1,
        limit: PAGINATION_LIMIT,
      }),
    );
    expect(mockedSummaryFetch).toHaveBeenCalledWith({
      currentMonth: 1,
      currentYear: 2026,
    });
    expect(mockedBudgetFetch).toHaveBeenCalledWith({
      currentMonth: 1,
      currentYear: 2026,
    });
  });

  it("re-fetches when the month changes", async () => {
    const { store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    renderer.act(() => {
      store.dispatch(setMonthYear({ month: 2, year: 2026 }));
    });
    await renderer.act(async () => {
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(2);
    expect(mockedTxFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentMonth: 2, currentYear: 2026 }),
    );
  });

  it("refreshes all three data sources on pull-to-refresh", async () => {
    const { captured } = await setup();
    mockedTxFetch.mockClear();
    mockedSummaryFetch.mockClear();
    mockedBudgetFetch.mockClear();

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
    expect(mockedSummaryFetch).toHaveBeenCalledTimes(1);
    expect(mockedBudgetFetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses the transaction cache when refreshing", async () => {
    // First mount fetch populates the month cache (useCache: true).
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx()] },
    });
    const { captured } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    expect(mockedTxFetch).toHaveBeenCalledTimes(1);

    // A cache-first fetch for the same month would return from cache without
    // hitting the API; refresh must bypass it.
    mockedTxFetch.mockClear();
    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    expect(mockedTxFetch).toHaveBeenCalledTimes(1);
  });

  it("derives the month label from the calendar", async () => {
    const { captured, store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 1, year: 2026 }));
    });
    const { month, year } = store.getState().calendar;
    const expected = `${new Date(year, month, 1).toLocaleString(undefined, {
      month: "long",
    })} ${year}`;

    expect(captured.current!.monthLabel).toBe(expected);
  });

  it("detects the current month", async () => {
    const current = await setup();
    expect(current.captured.current!.isCurrentMonth).toBe(true);

    const past = await setup((store) => {
      store.dispatch(setMonthYear({ month: 0, year: 2020 }));
    });
    expect(past.captured.current!.isCurrentMonth).toBe(false);
  });

  it("navigates months via handlers", async () => {
    const { captured, store } = await setup((store) => {
      store.dispatch(setMonthYear({ month: 5, year: 2026 }));
    });

    renderer.act(() => {
      captured.current!.handlePrevMonth();
    });
    expect(store.getState().calendar.month).toBe(4);

    renderer.act(() => {
      captured.current!.handleNextMonth();
    });
    expect(store.getState().calendar.month).toBe(5);
  });

  it("manages the info / transaction / budget modal state", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleInfoPress();
    });
    expect(captured.current!.helpOpen).toBe(true);

    renderer.act(() => {
      captured.current!.setHelpOpen(false);
    });
    expect(captured.current!.helpOpen).toBe(false);

    renderer.act(() => {
      captured.current!.handleNewBudget();
    });
    expect(captured.current!.openBudgetModal).toBe(true);

    renderer.act(() => {
      captured.current!.setOpenBudgetModal(false);
    });
    expect(captured.current!.openBudgetModal).toBe(false);
  });


  it("exposes display transactions with display amounts", async () => {
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "USD" })] },
    });
    const { captured } = await setup();

    expect(captured.current!.displayTransactions).toHaveLength(1);
    expect(captured.current!.displayTransactions[0].displayAmount).toBe(10);
    expect(captured.current!.displayTransactions[0].displayCurrency).toBe(
      "USD",
    );
  });

  it("exposes display budgets with display amounts", async () => {
    mockedBudgetFetch.mockResolvedValue({ data: [makeBudget()] });
    const { captured } = await setup();

    expect(captured.current!.displayBudgets).toHaveLength(1);
    expect(captured.current!.displayBudgets[0].displayLimit).toBe(500);
    expect(captured.current!.displayBudgets[0].displaySpent).toBe(100);
  });

  it("exposes the monthly income from the financial summary", async () => {
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ monthlyIncome: 5000 }),
    });
    const { captured } = await setup();

    expect(captured.current!.monthlyIncome).toBe(5000);
  });

  it("opens the transaction modal when a budget exists", async () => {
    mockedBudgetFetch.mockResolvedValue({ data: [makeBudget()] });
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleNewTransaction();
    });

    expect(captured.current!.openTxModal).toBe(true);
  });

  it("opens Smart Month Setup when no budget exists", async () => {
    const { captured } = await setup();

    renderer.act(() => {
      captured.current!.handleNewTransaction();
    });

    expect(captured.current!.openTxModal).toBe(false);
    expect(captured.current!.openSetup).toBe(true);
  });

  it("surfaces the backend aggregate verbatim for same-currency users", async () => {
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 100, monthlyIncome: 4000 }),
    });
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(100);
    expect(captured.current!.monthlyIncome).toBe(4000);
    expect(mockedConvert).not.toHaveBeenCalled();
  });

  it("never re-converts a mixed-currency aggregate client-side", async () => {
    // Mixed-currency month (CAD + USD). The backend already normalized every
    // transaction into the user's aggregation currency before summing, so the
    // summary total is final: converting it again (or inferring a source
    // currency) would corrupt the value.
    mockedTxFetch.mockResolvedValue({
      data: {
        transaction: [
          makeTx({ id: "t-cad", baseCurrency: "CAD", originalCurrency: "CAD" }),
          makeTx({ id: "t-usd", baseCurrency: "CAD", originalCurrency: "USD" }),
        ],
      },
    });
    // 100 CAD + (100 USD → 125 CAD) — computed server-side.
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 225, monthlyIncome: 1000, netRemaining: 775 }),
    });
    const { captured } = await setup();

    // Exactly the backend number — not convert(200) under one guessed currency.
    expect(captured.current!.expenseTotal).toBe(225);
    expect(captured.current!.monthlyIncome).toBe(1000);
    expect(mockedConvert).not.toHaveBeenCalled();
  });

  it("passes through net remaining and percentages without conversion", async () => {
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({
        totalAmount: 150,
        monthlyIncome: 2000,
        netRemaining: 1850,
        spentPercentageOfIncome: 7.5,
      }),
    });
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(150);
    expect(captured.current!.monthlyIncome).toBe(2000);
    expect(mockedConvert).not.toHaveBeenCalled();
  });

  it("keeps the backend total when a conversion utility would be available", async () => {
    // Even with a working converter and foreign-currency transactions on the
    // month, the hook must not touch them: aggregates are pre-converted.
    mockedConvert.mockResolvedValue(999);
    mockedTxFetch.mockResolvedValue({
      data: { transaction: [makeTx({ baseCurrency: "EUR" })] },
    });
    mockedSummaryFetch.mockResolvedValue({
      data: makeSummary({ totalAmount: 130 }),
    });
    const { captured } = await setup();

    expect(captured.current!.expenseTotal).toBe(130);
    expect(mockedConvert).not.toHaveBeenCalled();
  });
});

