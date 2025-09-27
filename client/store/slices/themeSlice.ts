import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const dark = {
  // Background layers
  background: "#1E1E1E", // Dark gray, similar to the app background
  surface: "#282828", // Slightly lighter dark gray for containers
  surfaceHover: "#3C3C3C", // Hover state for interactive surfaces

  // Primary brand colors (purple/pink neon vibes)
  // The login button uses a gradient, so these are the start and end points
  primary: "#9B5DE5", // Vibrant purple
  primaryHover: "#7A3CC1", // Deeper purple for hover state
  secondary: "#F15BB5", // Neon pink accent

  // Text colors
  textPrimary: "#FFFFFF", // Pure white for titles and primary text
  textSecondary: "#B4B4B4", // Lighter gray for secondary text like the welcome message
  textDisabled: "#6C6C6C", // Dimmed gray for disabled/inactive text

  // Feedback colors
  success: "#4ADE80", // Green for positive states
  danger: "#F87171", // Red for errors/alerts
  warning: "#FBBF24", // Amber for warnings

  // UI elements
  border: "#333333", // Subtle border for inputs and sections
  inputBackground: "#282828", // Dark input field background, matching the surface
  placeholderText: "#8A8F9E", // Muted gray for placeholders

  // Chart accents
  chart1: "#9B5DE5", // Purple
  chart2: "#F15BB5", // Pink
  chart3: "#00BBF9", // Aqua
  chart4: "#00F5D4", // Teal
};

const light = {
  // Background layers
  background: "#FFFFFF", // Pure white for a clean light base
  surface: "#F0F0F0", // Light gray for cards/containers
  surfaceHover: "#E0E0E0", // Hover state for interactive surfaces

  // Primary brand colors (purple/pink neon vibes - kept vibrant for brand consistency)
  primary: "#9B5DE5", // Vibrant purple for key actions
  primaryHover: "#7A3CC1", // Slightly deeper purple on hover
  secondary: "#F15BB5", // Neon pink accent for highlights

  // Text colors
  textPrimary: "#1A1A1A", // Very dark gray for strong contrast on light background
  textSecondary: "#555555", // Medium gray for secondary text
  textDisabled: "#AAAAAA", // Light gray for disabled/inactive text

  // Feedback colors
  success: "#28A745", // Standard green for positive states
  danger: "#DC3545", // Standard red for errors/alerts
  warning: "#FFC107", // Standard amber for warnings

  // UI elements
  border: "#CCCCCC", // Light gray border between sections
  inputBackground: "#F8F8F8", // Very light gray input field background
  placeholderText: "#888888", // Medium gray for placeholders

  // Chart accents (can be adjusted for better visibility on light background if needed)
  chart1: "#9B5DE5", // Purple
  chart2: "#F15BB5", // Pink
  chart3: "#00BBF9", // Aqua
  chart4: "#00F5D4", // Teal
};

const forest = {
  // Background layers
  background: "#E9F5EC", // Very light mint green
  surface: "#CDE8D5", // Soft pale green for containers
  surfaceHover: "#B7DCC4", // Slightly deeper green on hover

  // Primary brand colors (gentle greens)
  primary: "#6BAF85", // Soft muted green
  primaryHover: "#5A9E74", // Slightly darker for hover
  secondary: "#A5D6A7", // Pastel leaf green accent

  // Text colors
  textPrimary: "#1E293B", // Dark gray-blue for natural contrast
  textSecondary: "#4B5563", // Softer medium gray
  textDisabled: "#9CA3AF", // Muted gray for inactive

  // Feedback colors (toned down)
  success: "#81C784", // Soft green
  danger: "#C62828", // Gentle coral red
  warning: "#FFB74D", // Warm, muted orange

  // UI elements
  border: "#A7CBB7", // Pale sage border
  inputBackground: "#DDEEE3", // Soft greenish white for inputs
  placeholderText: "#94A3B8", // Cool muted gray

  // Chart accents
  chart1: "#6BAF85", // Soft green
  chart2: "#A5D6A7", // Pastel green
  chart3: "#90CAF9", // Soft sky blue
  chart4: "#FFD54F", // Muted sunlight yellow
};

const coffee = {
  // Background layers
  background: "#F8F5F2", // Light cream
  surface: "#E6DCD3", // Soft latte beige
  surfaceHover: "#DCCFC3", // Slightly warmer hover

  // Primary brand colors (warm muted browns)
  primary: "#B08968", // Soft caramel brown
  primaryHover: "#9C7659", // Slightly darker roast
  secondary: "#D2B48C", // Tan / cappuccino foam accent

  // Text colors
  textPrimary: "#3E2C23", // Dark espresso brown
  textSecondary: "#6B4F3B", // Muted warm brown
  textDisabled: "#A88F7C", // Soft taupe for inactive

  // Feedback colors (softer but still distinct)
  success: "#A5D6A7", // Pastel green
  danger: "#C62828", // Muted rose red
  warning: "#FFCC80", // Light warm orange

  // UI elements
  border: "#CBB8A9", // Soft mocha border
  inputBackground: "#F1E8E1", // Pale latte beige
  placeholderText: "#9E8E7A", // Muted cocoa gray

  // Chart accents
  chart1: "#B08968", // Caramel
  chart2: "#D2B48C", // Cappuccino
  chart3: "#E6CCB2", // Latte foam beige
  chart4: "#A1887F", // Mocha gray-brown
};

const theme = {
  DARK: dark,
  LIGHT: light,
  FOREST: forest,
  COFFEE: coffee,
};

interface ITheme {
  background: string;
  surface: string;
  surfaceHover: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
  inputBackground: string;
  placeholderText: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
}

interface IThemeState {
  selectedTheme: string;
  THEME: ITheme;
}

const initialState: IThemeState = {
  selectedTheme: "Light",
  THEME: theme.LIGHT,
};

export const loadThemeFromStorage = createAsyncThunk(
  "theme/loadFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      const storedTheme = await AsyncStorage.getItem("selectedTheme");
      return storedTheme;
    } catch (error) {
      console.error("Failed to load theme from storage:", error);
      return rejectWithValue("Failed to load theme");
    }
  }
);

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.selectedTheme = action.payload;
      state.THEME = theme[action.payload.toUpperCase() as keyof typeof theme];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadThemeFromStorage.fulfilled, (state, action) => {
        const storedTheme = action.payload;
        if (!storedTheme) {
          state.selectedTheme = "Light";
          state.THEME = theme.LIGHT;
          return;
        }
        state.selectedTheme = storedTheme || "Light";
        state.THEME = theme[storedTheme.toUpperCase() as keyof typeof theme];
      })
      .addCase(loadThemeFromStorage.rejected, (state, action) => {
        console.error("Failed to load theme from storage:", action.error);
      });
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
