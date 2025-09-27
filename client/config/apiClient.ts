import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api";

// Configure axios defaults
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 5000,
});

// Attach token before each request if available
apiClient.interceptors.request.use(
  async (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);

    // Attach auth token (await AsyncStorage)
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Error reading auth token from storage:", err);
    }

    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  }
);

// Log responses and handle global errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    // Normalize error object so callers can rely on a `message` property.
    // Axios errors may include server payloads under error.response.data.
    const defaultMsg = "An unexpected error occurred.";
    const normalized: any = {
      message: error?.response?.data?.message || error?.message || defaultMsg,
      status: error?.response?.status,
      data: error?.response?.data,
    };

    console.error(`API Error: ${error.config?.url}`, normalized);

    // If unauthorized, clear stored auth data. Navigation should be
    // performed by the UI layer instead of the API client to avoid
    // surprising side-effects during background requests.
    if (normalized.status === 401) {
      try {
        await AsyncStorage.multiRemove(["authToken", "userData"]);
      } catch (e) {
        console.error("Failed to clear auth storage:", e);
      }
    }

    // Reject with a normalized error object so thunks can extract message
    return Promise.reject(normalized);
  }
);

export default apiClient;
