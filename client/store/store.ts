import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import transactionReducer from "./slices/transactionSlice";
import themeReducer from "./slices/themeSlice";
import budgetReducer from "./slices/budgetSlice";
import calendarReducer from "./slices/calendarSlice";

// Configure the store
export const store = configureStore({
  reducer: {
    user: userReducer,
    transaction: transactionReducer,
    budget: budgetReducer,
    calendar: calendarReducer,
    theme: themeReducer,
    // Add more reducers here as you build other features
    // budgets: budgetReducer,
    // categories: categoryReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializability check
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
  devTools: __DEV__, // Enable Redux DevTools in development only
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export the store as default
export default store;
