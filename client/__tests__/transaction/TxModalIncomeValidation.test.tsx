/**
 * TxModal income-validation regression tests.
 *
 * Income transactions require only name + amount (currency and date always
 * have defaults). The category selector is expense-only, so it must never
 * block an income save. Expense validation remains strict.
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
import TransactionModal from "@/components/transaction/TxModal";
import userReducer from "@/store/slices/userSlice";
import calendarReducer, { setMonthYear } from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import api from "@/store/api/apiSlice";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { TransactionType } from "@/types/transaction/types";
import type { TransactionItem } from "@/types/transaction/types";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

jest.mock("@/api/transaction", () => ({
  __esModule: true,
  default: { fetchAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));

jest.mock("@/api/budget", () => ({
  __esModule: true,
  default: { fetchAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));

jest.mock("@/api/financialSummary", () => ({
  __esModule: true,
  default: { fetchSummary: jest.fn() },
}));

const mockedTxCreate = transactionApi.create as jest.Mock;
const mockedTxUpdate = transactionApi.update as jest.Mock;
const mockedBudgetFetch = budgetApi.fetchAll as jest.Mock;

const mockBudgets = [
  { id: "b-groceries", category: "Groceries", allocatedAmount: 500, spentAmount: 100 },
];

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

function touchableContainsText(children: unknown, text: string): boolean {
  if (typeof children === "string") return children.includes(text);
  if (Array.isArray(children)) {
    return children.some((child) => touchableContainsText(child, text));
  }
  if (React.isValidElement(children)) {
    const elementChildren = (children.props as { children?: unknown }).children;
    return touchableContainsText(elementChildren, text);
  }
  return false;
}

function lastProps(
  mock: jest.Mock,
  matcher: (props: Record<string, unknown>) => boolean,
): Record<string, any> | undefined {
  const calls = mock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && matcher(props)) return props;
  }
  return undefined;
}

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children) ? children.join("") : String(children ?? "");
    return text.includes(matches);
  });
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for condition");
}

const nameInput = () =>
  lastProps(textInputMock, (p) => p.accessibilityLabel === "Transaction name");
const amountInput = () =>
  lastProps(textInputMock, (p) => p.accessibilityLabel === "Transaction amount");
const incomeToggle = () =>
  lastProps(touchableOpacityMock, (p) => p.accessibilityLabel === "Income transaction");
const submitButton = () => lastTouchableContaining("Save Transaction");

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedTxCreate.mockReset();
  mockedTxUpdate.mockReset();
  mockedBudgetFetch.mockReset();
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();

  mockedBudgetFetch.mockResolvedValue({ success: true, data: mockBudgets });
  (financialSummaryApi.fetchSummary as jest.Mock).mockResolvedValue({
    success: true,
    data: { totalAmount: 0, monthlyIncome: 3000, actualIncome: 3000, expectedIncome: 3000 },
  });
});

function renderModal(props: Record<string, unknown> = {}) {
  const setOpenSheet = jest.fn();
  const store = makeStore();
  store.dispatch(setMonthYear({ month: 1, year: 2026 }));

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <TransactionModal openSheet={true} setOpenSheet={setOpenSheet} {...(props as any)} />
        </AlertProvider>
      </Provider>,
    );
  });
  return { setOpenSheet };
}

function lastTouchableContaining(text: string) {
  const calls = touchableOpacityMock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && touchableContainsText(props.children, text)) return props;
  }
  return undefined;
}

describe("TxModal - income transaction creation", () => {
  it("saves a valid income with only name + amount (no category/budget)", async () => {
    mockedTxCreate.mockResolvedValue({
      success: true,
      message: "Transaction created successfully",
      data: {
        id: "tx-income-1",
        name: "Paycheck",
        amount: 3200,
        type: TransactionType.INCOME,
        budgetId: null,
      },
    });

    const { setOpenSheet } = renderModal();
    await until(() => submitButton() != null);

    renderer.act(() => {
      nameInput()!.onChangeText("Paycheck");
      amountInput()!.onChangeText("3200");
    });

    // Switch to income — the category selector disappears entirely.
    expect(incomeToggle()).toBeDefined();
    renderer.act(() => {
      incomeToggle()!.onPress();
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    expect(mockedTxCreate).toHaveBeenCalledTimes(1);
    const [payload] = mockedTxCreate.mock.calls[0];
    expect(payload.type).toBe(TransactionType.INCOME);
    expect(payload.name).toBe("Paycheck");
    expect(Number(payload.amount)).toBe(3200);
    // Income must not be assigned to any budget
    expect(payload.budgetId).toBeNull();
    expect(payload.category).not.toBe("Groceries");
    // Modal closed on success (cache invalidation happens in the mutation)
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });

  it("does not require a category for income (regression: 'Please fill all fields')", async () => {
    mockedTxCreate.mockResolvedValue({ success: true, data: {} });
    const { setOpenSheet } = renderModal();
    await until(() => submitButton() != null);

    renderer.act(() => {
      nameInput()!.onChangeText("Freelance invoice");
      amountInput()!.onChangeText("500");
    });
    renderer.act(() => {
      incomeToggle()!.onPress();
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    // The save went through — no "fill all fields" alert blocked it.
    expect(mockedTxCreate).toHaveBeenCalled();
    expect(setOpenSheet).toHaveBeenCalledWith(false);
    expect(renderedText("Please fill all fields")).toBe(false);
  });

  it.each([
    ["name", () => { amountInput()!.onChangeText("100"); }],
    ["amount", () => { nameInput()!.onChangeText("Salary"); }],
  ])("income missing %s is rejected", async (_field, fill) => {
    const { setOpenSheet } = renderModal();
    await until(() => submitButton() != null);

    renderer.act(() => {
      fill();
    });
    renderer.act(() => {
      incomeToggle()!.onPress();
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    expect(mockedTxCreate).not.toHaveBeenCalled();
    expect(setOpenSheet).not.toHaveBeenCalledWith(false);
    expect(renderedText("Please fill all fields")).toBe(true);
  });

  it("zero amounts are rejected by amount validation", async () => {
    const { setOpenSheet } = renderModal();
    await until(() => submitButton() != null);

    renderer.act(() => {
      nameInput()!.onChangeText("Refund");
      amountInput()!.onChangeText("0");
    });
    renderer.act(() => {
      incomeToggle()!.onPress();
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    expect(mockedTxCreate).not.toHaveBeenCalled();
    expect(setOpenSheet).not.toHaveBeenCalledWith(false);
    expect(renderedText("Invalid Amount")).toBe(true);
  });
});

describe("TxModal - expense validation stays strict", () => {
  it("rejects an expense without a category", async () => {
    const { setOpenSheet } = renderModal();
    await until(() => submitButton() != null);

    renderer.act(() => {
      nameInput()!.onChangeText("Coffee");
      amountInput()!.onChangeText("4.50");
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    expect(mockedTxCreate).not.toHaveBeenCalled();
    expect(setOpenSheet).not.toHaveBeenCalledWith(false);
    expect(renderedText("Please select a category")).toBe(true);
  });

  it("still saves a valid expense with a category selected", async () => {
    mockedTxCreate.mockResolvedValue({ success: true, data: {} });
    const { setOpenSheet } = renderModal();
    await until(() => renderedText("Groceries"));

    renderer.act(() => {
      nameInput()!.onChangeText("Coffee");
      amountInput()!.onChangeText("4.50");
    });
    renderer.act(() => {
      lastTouchableContaining("Groceries")!.onPress();
    });

    await renderer.act(async () => {
      await submitButton()!.onPress();
      await flush();
    });

    expect(mockedTxCreate).toHaveBeenCalledTimes(1);
    const [payload] = mockedTxCreate.mock.calls[0];
    expect(payload.type).toBe(TransactionType.EXPENSE);
    expect(payload.budgetId).toBe("b-groceries");
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });
});

describe("TxModal - editing income", () => {
  it("updates an existing income without forcing a budget assignment", async () => {
    const existingTx: TransactionItem = {
      id: "tx-income-2",
      name: "Paycheck",
      amount: 3000,
      date: "2026-02-10T12:00:00.000Z",
      category: "Uncategorized",
      baseCurrency: "USD",
      type: TransactionType.INCOME,
    };
    mockedTxUpdate.mockResolvedValue({
      success: true,
      message: "Transaction updated",
      data: existingTx,
    });

    const { setOpenSheet } = renderModal({ editingTransaction: existingTx });
    await until(() => lastTouchableContaining("Update Transaction") != null);

    renderer.act(() => {
      amountInput()!.onChangeText("3200");
    });

    await renderer.act(async () => {
      await lastTouchableContaining("Update Transaction")!.onPress();
      await flush();
    });

    expect(mockedTxUpdate).toHaveBeenCalledTimes(1);
    const [calledId, updates] = mockedTxUpdate.mock.calls[0];
    expect(calledId).toBe("tx-income-2");
    expect(updates.amount).toBe(3200);
    // No budget reassignment should be forced for income
    expect(updates.budgetId).toBeUndefined();
    expect(setOpenSheet).toHaveBeenCalledWith(false);
  });
});
