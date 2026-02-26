import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const dark = {
  // Background layers — true black with depth
  background: "#080808", // Absolute near-black, luxe base
  surface: "#111111", // Slightly lifted dark surface
  surfaceHover: "#1C1C1C", // Subtle card/interactive lift

  // Primary brand colors — Champagne Gold (timeless VIP)
  primary: "#D4AF6A", // Champagne gold, refined & warm
  primaryHover: "#B8942F", // Deeper antique gold on press
  secondary: "#F0D9A0", // Pale gold shimmer for accents

  // Text colors
  textPrimary: "#F7F3EC", // Warm cream white, feels premium
  textSecondary: "#9E9585", // Muted warm greige
  textDisabled: "#4A4540", // Dimmed warm shadow

  // Feedback colors
  success: "#4CAF82", // Muted emerald
  danger: "#E05555", // Deep muted red
  warning: "#D4A03A", // Gold-amber

  // UI elements
  border: "#222018", // Near-black warm border
  inputBackground: "#111111", // Matches surface
  placeholderText: "#5E5A52", // Warm dim placeholder

  // Chart accents
  chart1: "#D4AF6A", // Champagne gold
  chart2: "#F0D9A0", // Pale gold
  chart3: "#7BAECF", // Cool steel blue contrast
  chart4: "#4CAF82", // Emerald
};

const light = {
  // Background layers — warm ivory, pairs naturally with champagne gold
  background: "#FAFAF7", // Warm off-white canvas
  surface: "#F2EFE8", // Soft parchment for cards
  surfaceHover: "#E8E4DB", // Warmer hover lift

  // Primary brand colors — Gold, carries VIP brand across both themes
  primary: "#B8942F", // Deep warm gold, legible on light
  primaryHover: "#9E7D24", // Richer gold on press
  secondary: "#C8A84B", // Champagne tone accent

  // Text colors
  textPrimary: "#16130D", // Warm near-black, high contrast
  textSecondary: "#5C5549", // Warm charcoal for secondary
  textDisabled: "#A89E90", // Soft warm gray for inactive

  // Feedback colors
  success: "#2E7D52", // Deep muted green
  danger: "#B84040", // Deep muted red
  warning: "#B8800A", // Dark gold-amber

  // UI elements
  border: "#DED9D0", // Warm parchment border
  inputBackground: "#F5F2EB", // Cream input field
  placeholderText: "#9A9080", // Muted warm placeholder

  // Chart accents
  chart1: "#B8942F", // Deep gold
  chart2: "#C8A84B", // Champagne
  chart3: "#4A8AB5", // Muted steel blue contrast
  chart4: "#2E7D52", // Muted emerald
};

const ocean = {
  // Background layers — deep navy abyss
  background: "#020C18", // Near-black navy
  surface: "#071729", // Deep ocean surface
  surfaceHover: "#0D2540", // Lighter deep navy hover

  // Primary brand colors — Sky / Cyan (crisp ocean accent)
  primary: "#0EA5E9", // Sky-500, iconic and vibrant
  primaryHover: "#0284C7", // Sky-600
  secondary: "#22D3EE", // Cyan-400, electric teal complement

  // Text colors
  textPrimary: "#E0F2FE", // Sky-100, cool near-white
  textSecondary: "#94A3B8", // Slate-400, clean muted blue-gray
  textDisabled: "#334155", // Slate-700

  // Feedback colors
  success: "#34D399", // Emerald-400
  danger: "#F87171", // Red-400
  warning: "#FCD34D", // Amber-300

  // UI elements
  border: "#0F2540", // Deep navy border
  inputBackground: "#071729", // Matches surface
  placeholderText: "#475569", // Slate-600

  // Chart accents
  chart1: "#0EA5E9", // Sky blue
  chart2: "#22D3EE", // Cyan
  chart3: "#34D399", // Emerald
  chart4: "#A78BFA", // Violet accent
};

const rose = {
  // Background layers — Rose Pine inspired deep plum-dark
  background: "#191724", // Deep plum-black base
  surface: "#1F1D2E", // Dark mauve surface
  surfaceHover: "#26233A", // Soft purple hover lift

  // Primary brand colors — Rose / Iris (warm & dreamy)
  primary: "#EB6F92", // Rose, warm vibrant pink
  primaryHover: "#D4567B", // Deeper rose on press
  secondary: "#C4A7E7", // Iris, soft lilac complement

  // Text colors
  textPrimary: "#E0DEF4", // Warm lavender-white
  textSecondary: "#908CAA", // Muted cool purple-gray
  textDisabled: "#403D52", // Dimmed deep muted purple

  // Feedback colors
  success: "#9CCFD8", // Foam teal, gentle and fresh
  danger: "#EB6F92", // Rose red
  warning: "#F6C177", // Warm gold

  // UI elements
  border: "#26233A", // Subtle plum border
  inputBackground: "#1F1D2E", // Matches surface
  placeholderText: "#6E6A86", // Muted purple-gray

  // Chart accents
  chart1: "#EB6F92", // Rose
  chart2: "#C4A7E7", // Iris
  chart3: "#9CCFD8", // Foam teal
  chart4: "#F6C177", // Gold
};

const theme = {
  DARK: dark,
  LIGHT: light,
  OCEAN: ocean,
  ROSE: rose,
};

import type { ITheme, IThemeState } from "@/types/theme/types";

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
  },
);

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action) => {
      const key = action.payload.toUpperCase() as keyof typeof theme;
      state.selectedTheme = action.payload;
      state.THEME = theme[key] ?? theme.LIGHT;
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
        const key = storedTheme.toUpperCase() as keyof typeof theme;
        state.selectedTheme = theme[key] ? storedTheme : "Light";
        state.THEME = theme[key] ?? theme.LIGHT;
      })
      .addCase(loadThemeFromStorage.rejected, (state, action) => {
        console.error("Failed to load theme from storage:", action.error);
      });
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
