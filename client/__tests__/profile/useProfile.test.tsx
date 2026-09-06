/**
 * useProfile hook tests for the pull-to-refresh flow.
 *
 * Regression coverage for "refreshing Profile navigates back to Home": the
 * refresh handler must revalidate server-backed Profile data WITHOUT re-running
 * the boot-time session-restoration thunk, so the global auth loading flag
 * never flips and the authenticated session/route is never disturbed.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { plaidAPI } from "@/api/plaid";
import { router } from "expo-router";
import { useProfile } from "@/hooks/profile/useProfile";
import userReducer, { loginUser } from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
import calendarReducer from "@/store/slices/calendarSlice";
import notificationReducer from "@/store/slices/notificationSlice";
import api from "@/store/api/apiSlice";
import { clearRatesCache } from "@/utils/currencyConverter";
import type { IUser } from "@/types/user/types";

jest.mock("@/api/user", () => ({
  userAPI: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    getStoredToken: jest.fn(),
    getStoredUser: jest.fn(),
    getMonthlyIncome: jest.fn(),
    uploadProfilePictureById: jest.fn(),
    deleteProfilePictureById: jest.fn(),
    changePassword: jest.fn(),
    hasAnyTransactions: jest.fn(),
    updateCurrency: jest.fn(),
    updateMonthlyIncome: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    googleAuth: jest.fn(),
  },
}));

jest.mock("@/api/plaid", () => {
  const plaidAPI = {
    fetchItems: jest.fn(),
    createLinkToken: jest.fn(),
    createUpdateLinkToken: jest.fn(),
    reauthComplete: jest.fn(),
    triggerManualSync: jest.fn(),
    exchangePublicToken: jest.fn(),
    disconnectItem: jest.fn(),
  };
  return {
    __esModule: true,
    plaidAPI,
    default: plaidAPI,
  };
});

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock("@/utils/profile/profileService", () => ({
  pickProfileImage: jest.fn(),
  persistTheme: jest.fn(),
}));

jest.mock("@/utils/notifications/permissions", () => ({
  getPermissionStatus: jest.fn(),
  requestPermission: jest.fn(),
  ensureAndroidChannel: jest.fn(),
}));

jest.mock("@/utils/currencyConverter", () => ({
  clearRatesCache: jest.fn(),
}));

const mockedGetMonthlyIncome = userAPI.getMonthlyIncome as jest.Mock;
const mockedFetchItems = (plaidAPI as any).fetchItems as jest.Mock;
const mockedRouterPush = router.push as jest.Mock;
const mockedRouterReplace = router.replace as jest.Mock;

type Profile = ReturnType<typeof useProfile>;

const user: IUser = {
  id: "u1",
  username: "Test User",
  email: "user@test.com",
  currency: "USD",
};

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      theme: themeReducer,
      calendar: calendarReducer,
      notifications: notificationReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (gDM) => gDM().concat(api.middleware),
  });
}

function setup() {
  const store = makeStore();
  // Authenticate the session exactly as a completed login would.
  renderer.act(() => {
    store.dispatch(
      loginUser.fulfilled({ user, token: "tok" }, "req-1", {
        email: "user@test.com",
        password: "secret1",
      }),
    );
  });

  const captured: { current: Profile | null } = { current: null };
  function Harness() {
    captured.current = useProfile();
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

  return { captured, store };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Resolves on demand, with a safety timeout so an unresolved gate can never wedge the suite. */
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

beforeEach(() => {
  mockedGetMonthlyIncome.mockReset();
  mockedFetchItems.mockReset();
  mockedRouterPush.mockReset();
  mockedRouterReplace.mockReset();
  (userAPI.getStoredToken as jest.Mock).mockReset();
  (userAPI.getStoredUser as jest.Mock).mockReset();
  (userAPI.hasAnyTransactions as jest.Mock).mockReset();
  (userAPI.updateCurrency as jest.Mock).mockReset();
  (clearRatesCache as jest.Mock).mockReset();
  // Mount effects default: some existing data so refresh deltas are visible.
  mockedGetMonthlyIncome.mockResolvedValue({
    data: { monthlyIncome: 3000, actualMonthlyIncome: 2900 },
  });
  mockedFetchItems.mockResolvedValue({ data: { items: [] } });
});

describe("useProfile refresh", () => {
  it("revalidates server-backed Profile data without touching the session store", async () => {
    const { captured, store } = setup();

    mockedGetMonthlyIncome.mockResolvedValue({
      data: { monthlyIncome: 5200, actualMonthlyIncome: 4980 },
    });
    mockedFetchItems.mockResolvedValue({
      data: { items: [{ id: "p-1", institutionName: "Acme Bank" }] },
    });

    await renderer.act(async () => {
      await captured.current!.onRefresh();
      await flush();
    });

    // The boot-time session restoration is never re-run by a refresh.
    expect(userAPI.getStoredToken).not.toHaveBeenCalled();
    expect(userAPI.getStoredUser).not.toHaveBeenCalled();

    // The authenticated session in Redux is untouched.
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.user?.id).toBe("u1");

    // Server-backed Profile data refreshed in place, with no navigation.
    expect(captured.current!.monthlyIncomeInput).toBe("5200");
    expect(captured.current!.actualMonthlyIncome).toBe(4980);
    expect(captured.current!.plaidItems).toEqual([
      { id: "p-1", institutionName: "Acme Bank" },
    ]);
    expect(captured.current!.refreshing).toBe(false);
    expect(mockedRouterPush).not.toHaveBeenCalled();
    expect(mockedRouterReplace).not.toHaveBeenCalled();
  });

  it("does not flip the global auth loading flag while a refresh is in flight", async () => {
    const { captured, store } = setup();

    const gate = gatedResponse({
      data: { monthlyIncome: 6400, actualMonthlyIncome: 6100 },
    });
    mockedGetMonthlyIncome.mockReturnValue(gate.promise);

    let inFlight: Promise<void> | undefined;
    renderer.act(() => {
      inFlight = captured.current!.onRefresh();
    });

    // While the refresh is pending, the session-restore flag used by the
    // root layout's splash gate must stay off — otherwise an authenticated
    // user would be bounced to Home.
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);

    await renderer.act(async () => {
      gate.resolve({
        data: { monthlyIncome: 6400, actualMonthlyIncome: 6100 },
      });
      await inFlight;
      await flush();
    });
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(captured.current!.refreshing).toBe(false);
    expect(captured.current!.monthlyIncomeInput).toBe("6400");
    expect(mockedRouterPush).not.toHaveBeenCalled();
  });
});

describe("useProfile currency change", () => {
  it("locks currency change when user has existing transactions", async () => {
    const { captured, store } = setup();
    (userAPI.hasAnyTransactions as jest.Mock).mockResolvedValue(true);

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("EUR");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).toHaveBeenCalled();
    expect(userAPI.updateCurrency).not.toHaveBeenCalled();
    expect(clearRatesCache).not.toHaveBeenCalled();
    expect(store.getState().user.user?.currency).toBe("USD");
  });

  it("allows currency change, updates user state, clears rates cache, and resets RTK Query state when user has no transactions", async () => {
    const { captured, store } = setup();
    (userAPI.hasAnyTransactions as jest.Mock).mockResolvedValue(false);
    (userAPI.updateCurrency as jest.Mock).mockResolvedValue({
      data: { currency: "EUR" },
    });

    // Seed RTK Query cache with query data
    renderer.act(() => {
      store.dispatch(
        api.util.upsertQueryData(
          "getTransactions",
          { currentMonth: 3, currentYear: 2026, limit: 20 },
          {
            data: [],
            page: 1,
            totalPages: 1,
            totalElements: 0,
          } as any,
        ),
      );
    });

    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(0);

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("EUR");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).toHaveBeenCalled();
    expect(userAPI.updateCurrency).toHaveBeenCalledWith("EUR");
    expect(clearRatesCache).toHaveBeenCalled();
    expect(store.getState().user.user?.currency).toBe("EUR");
    // resetApiState must have wiped the RTK Query cache
    expect(Object.keys(store.getState().api.queries).length).toBe(0);
  });

  it("ignores selection if same currency is selected", async () => {
    const { captured } = setup();

    await renderer.act(async () => {
      captured.current!.handleCurrencySelect("USD");
      await flush();
    });

    expect(userAPI.hasAnyTransactions).not.toHaveBeenCalled();
    expect(userAPI.updateCurrency).not.toHaveBeenCalled();
  });
});
