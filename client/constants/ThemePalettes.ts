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

// "Ember" — a minimal, warm, developer-focused aesthetic: warm paper
// neutrals with a terracotta/clay accent, generous contrast, no cool tones.
const ember = {
  background: "#1B1512",
  surface: "#241C18",
  surfaceHover: "#2F2520",
  primary: "#E8865A",
  primaryHover: "#D06E44",
  secondary: "#F2B48C",
  textPrimary: "#F5EDE6",
  textSecondary: "#A8988C",
  textDisabled: "#57493F",
  success: "#7FBF7F",
  danger: "#E06C5C",
  warning: "#E0A458",
  border: "#3A2E26",
  inputBackground: "#241C18",
  placeholderText: "#6E5F53",
  chart1: "#E8865A",
  chart2: "#F2B48C",
  chart3: "#8FB8A8",
  chart4: "#7FBF7F",
};

// "Aurora" — a clean, modern, highly polished AI-chat aesthetic: soft
// violet-tinted surfaces with an indigo→violet accent, crisp hierarchy.
const aurora = {
  background: "#101018",
  surface: "#181826",
  surfaceHover: "#212130",
  primary: "#7C6CF6",
  primaryHover: "#6553E0",
  secondary: "#A78BFA",
  textPrimary: "#EEEDF7",
  textSecondary: "#9B98B3",
  textDisabled: "#43415A",
  success: "#5ECFA0",
  danger: "#F0708A",
  warning: "#E8B95E",
  border: "#2B2A3E",
  inputBackground: "#181826",
  placeholderText: "#5D5A76",
  chart1: "#7C6CF6",
  chart2: "#A78BFA",
  chart3: "#5ECFA0",
  chart4: "#E8B95E",
};

export const THEME_PALETTES = {
  DARK: dark,
  LIGHT: light,
  EMBER: ember,
  AURORA: aurora,
} as const;

export type ThemePaletteKey = keyof typeof THEME_PALETTES;
export type ThemePalette = (typeof THEME_PALETTES)[ThemePaletteKey];
