import "../global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store, loadUserFromStorage, useAuth } from "../store";
import { useEffect } from "react";
import { useAppDispatch, useCalendar, useTheme } from "@/hooks/useRedux";
import { ActivityIndicator, View, Text } from "react-native";
import { loadThemeFromStorage } from "@/store/slices/themeSlice";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { AlertProvider } from "@/utils/themedAlert";

function AppRoutes() {
  const dispatch = useAppDispatch();
  const { THEME } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const { month, year } = useCalendar();

  function SplashScreen() {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: THEME.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
        {/* <Text
        style={{
          marginTop: 16,
          fontSize: 18,
          fontWeight: "600",
          color: THEME.textPrimary,
        }}
      >
        Loading...
      </Text> */}
      </View>
    );
  }

  useEffect(() => {
    // Attempt to load stored auth on app start
    dispatch(loadUserFromStorage());
    dispatch(loadThemeFromStorage());
  }, [dispatch]);

  if (isLoading) {
    return SplashScreen();
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" redirect={!isAuthenticated} />
      <Stack.Screen name="(auth)" redirect={isAuthenticated} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AlertProvider>
        <AppRoutes />
      </AlertProvider>
    </Provider>
  );
}
