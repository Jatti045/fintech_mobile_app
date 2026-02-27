/**
 * Theme color palettes.
 *
 * Extracted from `themeSlice.ts` so the palette definitions are decoupled
 * from Redux boilerplate.  The slice now imports this map and stays lean.
 */

const dark = {
  background: "#080808",
  surface: "#111111",
  surfaceHover: "#1C1C1C",
  primary: "#D4AF6A",
  primaryHover: "#B8942F",
  secondary: "#F0D9A0",
  textPrimary: "#F7F3EC",
  textSecondary: "#9E9585",
  textDisabled: "#4A4540",
  success: "#4CAF82",
  danger: "#E05555",
  warning: "#D4A03A",
  border: "#222018",
  inputBackground: "#111111",
  placeholderText: "#5E5A52",
  chart1: "#D4AF6A",
  chart2: "#F0D9A0",
  chart3: "#7BAECF",
  chart4: "#4CAF82",
};

const light = {
  background: "#FAFAF7",
  surface: "#F2EFE8",
  surfaceHover: "#E8E4DB",
  primary: "#B8942F",
  primaryHover: "#9E7D24",
  secondary: "#C8A84B",
  textPrimary: "#16130D",
  textSecondary: "#5C5549",
  textDisabled: "#A89E90",
  success: "#2E7D52",
  danger: "#B84040",
  warning: "#B8800A",
  border: "#DED9D0",
  inputBackground: "#F5F2EB",
  placeholderText: "#9A9080",
  chart1: "#B8942F",
  chart2: "#C8A84B",
  chart3: "#4A8AB5",
  chart4: "#2E7D52",
};

const ocean = {
  background: "#020C18",
  surface: "#071729",
  surfaceHover: "#0D2540",
  primary: "#0EA5E9",
  primaryHover: "#0284C7",
  secondary: "#22D3EE",
  textPrimary: "#E0F2FE",
  textSecondary: "#94A3B8",
  textDisabled: "#334155",
  success: "#34D399",
  danger: "#F87171",
  warning: "#FCD34D",
  border: "#0F2540",
  inputBackground: "#071729",
  placeholderText: "#475569",
  chart1: "#0EA5E9",
  chart2: "#22D3EE",
  chart3: "#34D399",
  chart4: "#A78BFA",
};

const rose = {
  background: "#191724",
  surface: "#1F1D2E",
  surfaceHover: "#26233A",
  primary: "#EB6F92",
  primaryHover: "#D4567B",
  secondary: "#C4A7E7",
  textPrimary: "#E0DEF4",
  textSecondary: "#908CAA",
  textDisabled: "#403D52",
  success: "#9CCFD8",
  danger: "#EB6F92",
  warning: "#F6C177",
  border: "#26233A",
  inputBackground: "#1F1D2E",
  placeholderText: "#6E6A86",
  chart1: "#EB6F92",
  chart2: "#C4A7E7",
  chart3: "#9CCFD8",
  chart4: "#F6C177",
};

export const THEME_PALETTES = {
  DARK: dark,
  LIGHT: light,
  OCEAN: ocean,
  ROSE: rose,
} as const;

export type ThemePaletteKey = keyof typeof THEME_PALETTES;
export type ThemePalette = (typeof THEME_PALETTES)[ThemePaletteKey];
