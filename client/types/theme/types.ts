// ─── Theme Domain Types ─────────────────────────────────────────────────────

export interface ITheme {
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

export interface IThemeState {
  selectedTheme: string;
  THEME: ITheme;
}
