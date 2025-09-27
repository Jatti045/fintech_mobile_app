import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";
import { store, loadUserFromStorage } from "../../store";
import { useEffect } from "react";
import { useAppDispatch, useCalendar, useTheme } from "@/hooks/useRedux";
import { loadThemeFromStorage } from "@/store/slices/themeSlice";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";

export default function TabsLayout() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const { month, year } = useCalendar();

  // Fetch transactions for the selected month whenever calendar changes
  useEffect(() => {
    const state = store.getState();
    const month = state.calendar.month;
    const year = state.calendar.year;
    dispatch(
      fetchTransaction({
        searchQuery: "",
        currentMonth: month,
        currentYear: year,
      })
    );
    dispatch(fetchBudgets({ currentMonth: month, currentYear: year }));
  }, [dispatch, month, year]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.inputBackground,
          borderTopColor: THEME.border,
        },
        tabBarActiveTintColor: THEME.textPrimary,
        tabBarInactiveTintColor: THEME.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="transaction"
        options={{
          tabBarLabel: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="budget"
        options={{
          tabBarLabel: "Budget",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
