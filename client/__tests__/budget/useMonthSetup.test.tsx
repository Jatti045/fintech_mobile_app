/**
 * useMonthSetup hook tests.
 *
 * Covers the Smart Month Setup orchestrator: loading state, suggestion
 * population into editable rows, per-row editing, select/deselect, select-all,
 * apply success + failure paths, dedup, empty/invalid suggestions, and
 * re-open resets stale edits.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import api from "@/store/api/apiSlice";
import { useMonthSetup } from "@/hooks/budget/useMonthSetup";
import userReducer from "@/store/slices/userSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import themeReducer from "@/store/slices/themeSlice";
import budgetApiDefault from "@/api/budget";

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

const mockedSuggestions = budgetApiDefault.fetchSuggestions as jest.Mock;
const mockedApply = budgetApiDefault.applySuggestions as jest.Mock;

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

type Hooks = ReturnType<typeof useMonthSetup>;

const sampleSuggestions = {
  year: 2026,
  month: 8,
  suggestions: [
    {
      category: "Groceries",
      suggestedLimit: 450,
      source: "PREVIOUS_MONTH_BUDGET",
      inherited: true,
      existingBudgetId: null,
      autoCreated: false,
      spentToDate: 0,
      monthsSampled: 1,
    },
    {
      category: "Dining",
      suggestedLimit: 120,
      source: "HISTORICAL_SPENDING",
      inherited: false,
      existingBudgetId: "bud-2",
      autoCreated: true,
      spentToDate: 30,
      monthsSampled: 3,
    },
  ],
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Repeatedly act-flushes until the predicate holds (RTKQ fulfillment is async). */
async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for expected store/hook state");
}

/**
 * Test controller: mirrors the modal's open state with real React state so
 * open/close transitions re-render the hook (plain ref mutation would not).
 */
function createController(
  initialOpen = true,
  initialMonth = 8,
  initialYear = 2026,
) {
  const listeners: ((o: boolean) => void)[] = [];
  const monthListeners: ((my: { month: number; year: number }) => void)[] = [];
  return {
    v: initialOpen,
    month: initialMonth,
    year: initialYear,
    set(o: boolean) {
      this.v = o;
      listeners.forEach((l) => l(o));
    },
    setMonthYear(month: number, year: number) {
      this.month = month;
      this.year = year;
      monthListeners.forEach((l) => l({ month, year }));
    },
    _listeners: listeners,
    _monthListeners: monthListeners,
  };
}
type Controller = ReturnType<typeof createController>;

async function mountHook(
  controller: Controller = createController(),
  suggestions: any = sampleSuggestions,
) {
  mockedSuggestions.mockImplementation(async (args: any) => {
    let res: any;
    if (typeof suggestions === "function") {
      res = await suggestions(args);
    } else {
      res = suggestions;
    }
    return { data: res };
  });
  const store = makeStore();
  const captured: { current: Hooks | null } = { current: null };

  function Inner() {
    const [open, setOpen] = React.useState(controller.v);
    const [monthYear, setMonthYear] = React.useState({
      month: controller.month,
      year: controller.year,
    });
    React.useEffect(() => {
      const l = (o: boolean) => setOpen(o);
      controller._listeners.push(l);
      const ml = (my: { month: number; year: number }) => setMonthYear(my);
      controller._monthListeners.push(ml);
      return () => {
        controller._listeners.splice(controller._listeners.indexOf(l), 1);
        controller._monthListeners.splice(
          controller._monthListeners.indexOf(ml),
          1,
        );
      };
    }, []);
    captured.current = useMonthSetup({
      month: monthYear.month,
      year: monthYear.year,
      open,
      onOpenChange: (o) => controller.set(o),
      currencyCode: "USD",
    });
    return null;
  }

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Inner />
        </AlertProvider>
      </Provider>,
    );
  });
  await renderer.act(async () => {
    for (let i = 0; i < 10; i++) await flush();
  });

  return { captured, store };
}

beforeEach(() => {
  mockedSuggestions.mockReset();
  mockedApply.mockReset();
});

describe("useMonthSetup", () => {
  it("maps suggestions into editable rows, all selected by default", async () => {
    const { captured } = await mountHook();

    expect(captured.current!.isLoading).toBe(false);
    expect(captured.current!.isEmpty).toBe(false);
    expect(captured.current!.edits).toHaveLength(2);

    const groceries = captured.current!.edits.find(
      (e) => e.category === "Groceries",
    );
    expect(groceries).toBeDefined();
    expect(groceries!.limitInput).toBe("450");
    expect(groceries!.selected).toBe(true);
    expect(groceries!.inherited).toBe(true);

    expect(captured.current!.allSelected).toBe(true);
    expect(captured.current!.selectedCount).toBe(2);
  });

  it("updates a suggestion limit via setLimit", async () => {
    const { captured } = await mountHook();

    renderer.act(() => {
      captured.current!.setLimit("Groceries", "300");
    });

    expect(
      captured.current!.edits.find((e) => e.category === "Groceries")!
        .limitInput,
    ).toBe("300");
  });

  it("toggles individual selection", async () => {
    const { captured } = await mountHook();

    renderer.act(() => {
      captured.current!.toggleSelected("Groceries");
    });

    expect(captured.current!.selectedCount).toBe(1);
    expect(captured.current!.allSelected).toBe(false);
  });

  it("toggles select-all", async () => {
    const { captured } = await mountHook();

    renderer.act(() => {
      captured.current!.setAllSelected(false);
    });

    expect(captured.current!.selectedCount).toBe(0);
    expect(captured.current!.allSelected).toBe(false);

    renderer.act(() => {
      captured.current!.setAllSelected(true);
    });

    expect(captured.current!.selectedCount).toBe(2);
    expect(captured.current!.allSelected).toBe(true);
  });

  it("shows empty state when suggestions list is empty", async () => {
    const { captured } = await mountHook(createController(), {
      year: 2026,
      month: 8,
      suggestions: [],
    });

    expect(captured.current!.isEmpty).toBe(true);
    expect(captured.current!.edits).toHaveLength(0);
  });
});

describe("useMonthSetup apply flow", () => {
  it("applies only selected rows with positive limits", async () => {
    mockedApply.mockResolvedValue({
      success: true,
      data: {
        created: 1,
        updated: 0,
        skipped: 0,
        skippedItems: [],
        budgets: [],
      },
    });
    const controller = createController();
    const { captured } = await mountHook(controller);

    renderer.act(() => {
      captured.current!.toggleSelected("Dining");
      captured.current!.setLimit("Groceries", "400");
    });

    await renderer.act(async () => {
      await captured.current!.apply();
    });

    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(mockedApply).toHaveBeenCalledWith({
      month: 8,
      year: 2026,
      items: [{ category: "Groceries", limit: 400 }],
    });
    // Successful apply closes the sheet via onOpenChange(false).
    expect(controller.v).toBe(false);
  });

  it("skips rows with zero or invalid limits and alerts without applying", async () => {
    mockedApply.mockResolvedValue({
      success: true,
      data: {
        created: 1,
        updated: 0,
        skipped: 0,
        skippedItems: [],
        budgets: [],
      },
    });
    const { captured } = await mountHook();

    renderer.act(() => {
      captured.current!.setLimit("Groceries", "0");
      captured.current!.setLimit("Dining", "abc");
    });

    await renderer.act(async () => {
      await captured.current!.apply();
    });

    expect(mockedApply).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while applying", async () => {
    mockedApply.mockReturnValue(new Promise(() => {}));
    const { captured } = await mountHook();

    let p1: Promise<void> = Promise.resolve();
    renderer.act(() => {
      p1 = captured.current!.apply();
    });
    p1.catch(() => {});

    expect(captured.current!.applying).toBe(true);

    let p2: Promise<void> = Promise.resolve();
    renderer.act(() => {
      p2 = captured.current!.apply();
    });
    p2.catch(() => {});

    expect(mockedApply).toHaveBeenCalledTimes(1);
  });

  it("surfaces an apply failure instead of closing the sheet", async () => {
    mockedApply.mockResolvedValue({ error: { error: "boom" } });
    const controller = createController();
    const { captured } = await mountHook(controller);

    await renderer.act(async () => {
      await captured.current!.apply();
    });

    // Sheet stays open so the user can retry.
    expect(controller.v).toBe(true);
  });
});

describe("useMonthSetup reopen behavior", () => {
  it("resets editable state on every open so stale edits never carry over", async () => {
    const controller = createController();
    const { captured } = await mountHook(controller);

    // Edit a limit
    renderer.act(() => {
      captured.current!.setLimit("Groceries", "999");
    });
    expect(
      captured.current!.edits.find((e) => e.category === "Groceries")!
        .limitInput,
    ).toBe("999");

    // Close
    renderer.act(() => {
      controller.set(false);
    });
    await renderer.act(async () => {
      await flush();
    });

    // Reopen — edits must be re-seeded from authoritative suggestions.
    renderer.act(() => {
      controller.set(true);
    });
    await renderer.act(async () => {
      for (let i = 0; i < 10; i++) await flush();
    });

    expect(
      captured.current!.edits.find((e) => e.category === "Groceries")!
        .limitInput,
    ).toBe("450");
  });
});

describe("useMonthSetup month/year transition behavior", () => {
  const month8Suggestions = {
    year: 2026,
    month: 8,
    suggestions: [
      {
        category: "Groceries",
        suggestedLimit: 450,
        source: "PREVIOUS_MONTH_BUDGET",
        inherited: true,
        existingBudgetId: null,
        autoCreated: false,
        spentToDate: 0,
        monthsSampled: 1,
      },
    ],
  };

  const month9Suggestions = {
    year: 2026,
    month: 9,
    suggestions: [
      {
        category: "Rent",
        suggestedLimit: 1200,
        source: "HISTORICAL_SPENDING",
        inherited: false,
        existingBudgetId: null,
        autoCreated: false,
        spentToDate: 0,
        monthsSampled: 2,
      },
    ],
  };

  it("re-initializes state for new month when month changes while modal remains open", async () => {
    const controller = createController(true, 8, 2026);
    const { captured } = await mountHook(controller, (args: any) =>
      args.currentMonth === 8 ? month8Suggestions : month9Suggestions,
    );

    expect(captured.current!.edits).toHaveLength(1);
    expect(captured.current!.edits[0].category).toBe("Groceries");

    // Edit month 8 limit
    renderer.act(() => {
      captured.current!.setLimit("Groceries", "999");
    });
    expect(captured.current!.edits[0].limitInput).toBe("999");

    // Change month to 9 while modal remains open
    renderer.act(() => {
      controller.setMonthYear(9, 2026);
    });

    await until(
      () =>
        captured.current?.edits.length === 1 &&
        captured.current?.edits[0].category === "Rent",
    );

    // Edits must now strictly correspond to Month 9 authoritative data
    expect(captured.current!.edits).toHaveLength(1);
    expect(captured.current!.edits[0].category).toBe("Rent");
    expect(captured.current!.edits[0].limitInput).toBe("1200");
  });

  it("surfaces loading state during month transition while modal is open", async () => {
    let resolveMonth9: (val: any) => void;
    const month9Promise = new Promise((resolve) => {
      resolveMonth9 = resolve;
    });

    const controller = createController(true, 8, 2026);
    const { captured } = await mountHook(controller, (args: any) => {
      if (args.currentMonth === 8) return month8Suggestions;
      return month9Promise;
    });

    expect(captured.current!.edits).toHaveLength(1);
    expect(captured.current!.edits[0].category).toBe("Groceries");

    // Switch to month 9 while fetch is unresolved
    renderer.act(() => {
      controller.setMonthYear(9, 2026);
    });

    // Stale edits from month 8 should be cleared immediately and loader shown
    expect(captured.current!.isLoading).toBe(true);
    expect(captured.current!.edits).toHaveLength(0);

    // Resolve month 9
    resolveMonth9!(month9Suggestions);
    await until(
      () =>
        captured.current?.isLoading === false &&
        captured.current?.edits.length === 1,
    );

    expect(captured.current!.isLoading).toBe(false);
    expect(captured.current!.edits).toHaveLength(1);
    expect(captured.current!.edits[0].category).toBe("Rent");
  });

  it("surfaces error state and clears stale state if new month fetch fails", async () => {
    const controller = createController(true, 8, 2026);
    const { captured } = await mountHook(controller, (args: any) => {
      if (args.currentMonth === 8) return month8Suggestions;
      throw new Error("Network error fetching month 9");
    });

    expect(captured.current!.edits[0].category).toBe("Groceries");

    // Switch to month 9
    renderer.act(() => {
      controller.setMonthYear(9, 2026);
    });

    await until(
      () => captured.current?.error === "Network error fetching month 9",
    );

    expect(captured.current!.error).toBe("Network error fetching month 9");
    expect(captured.current!.edits).toHaveLength(0);
  });

  it("resets when switching back and forth between months while open", async () => {
    const controller = createController(true, 8, 2026);
    const { captured } = await mountHook(controller, (args: any) =>
      args.currentMonth === 8 ? month8Suggestions : month9Suggestions,
    );

    // Edit month 8
    renderer.act(() => {
      captured.current!.setLimit("Groceries", "777");
    });
    expect(captured.current!.edits[0].limitInput).toBe("777");

    // Switch to month 9
    renderer.act(() => {
      controller.setMonthYear(9, 2026);
    });
    await until(() => captured.current?.edits[0]?.category === "Rent");
    expect(captured.current!.edits[0].category).toBe("Rent");

    // Switch back to month 8 — must be re-seeded from authoritative data, not stale 777
    renderer.act(() => {
      controller.setMonthYear(8, 2026);
    });
    await until(() => captured.current?.edits[0]?.category === "Groceries");
    expect(captured.current!.edits[0].category).toBe("Groceries");
    expect(captured.current!.edits[0].limitInput).toBe("450");
  });

  it("applies only the newly selected month's items after a month transition", async () => {
    mockedApply.mockResolvedValue({
      success: true,
      data: {
        created: 1,
        updated: 0,
        skipped: 0,
        skippedItems: [],
        budgets: [],
      },
    });
    const controller = createController(true, 8, 2026);
    const { captured } = await mountHook(controller, (args: any) =>
      args.currentMonth === 8 ? month8Suggestions : month9Suggestions,
    );

    // Switch to month 9
    renderer.act(() => {
      controller.setMonthYear(9, 2026);
    });
    await until(() => captured.current?.edits[0]?.category === "Rent");

    await renderer.act(async () => {
      await captured.current!.apply();
    });

    expect(mockedApply).toHaveBeenCalledWith({
      month: 9,
      year: 2026,
      items: [{ category: "Rent", limit: 1200 }],
    });
  });
});
