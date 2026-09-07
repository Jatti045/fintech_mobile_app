/**
 * Theme system tests:
 * - Light and Dark remain available; Ocean and Rose are fully removed.
 * - The two new themes (Ember, Aurora) are registered palettes.
 * - themeSlice resolves each theme by name and safely falls back to Light
 *   for persisted themes that no longer exist (e.g. "Ocean", "Rose").
 */

/// <reference types="jest" />

// profileService imports expo-image-picker (untranspiled ESM) at module load;
// stub it so the THEME_OPTIONS import stays testable.
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

import { THEME_PALETTES } from "@/constants/ThemePalettes";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import reducer, {
  loadThemeFromStorage,
  setTheme,
} from "@/store/slices/themeSlice";
import type { ITheme } from "@/types/theme/types";

const REQUIRED_TOKENS: (keyof ITheme)[] = [
  "background",
  "surface",
  "surfaceHover",
  "primary",
  "primaryHover",
  "secondary",
  "textPrimary",
  "textSecondary",
  "textDisabled",
  "success",
  "danger",
  "warning",
  "border",
  "inputBackground",
  "placeholderText",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
];

function expectCompletePalette(palette: ITheme) {
  for (const token of REQUIRED_TOKENS) {
    expect(typeof palette[token]).toBe("string");
    expect((palette[token] as string).length).toBeGreaterThan(0);
  }
}

describe("ThemePalettes", () => {
  it("keeps Light and Dark available", () => {
    expect(THEME_PALETTES.LIGHT).toBeDefined();
    expect(THEME_PALETTES.DARK).toBeDefined();
  });

  it("provides the two new themes", () => {
    expect(THEME_PALETTES.EMBER).toBeDefined();
    expect(THEME_PALETTES.AURORA).toBeDefined();
  });

  it("completely removes Ocean and Rose", () => {
    expect(THEME_PALETTES).not.toHaveProperty("OCEAN");
    expect(THEME_PALETTES).not.toHaveProperty("ROSE");
  });

  it("exposes exactly four themes", () => {
    expect(Object.keys(THEME_PALETTES).sort()).toEqual([
      "AURORA",
      "DARK",
      "EMBER",
      "LIGHT",
    ]);
  });

  it("gives every palette the full token set", () => {
    for (const key of Object.keys(THEME_PALETTES)) {
      expectCompletePalette(THEME_PALETTES[key as keyof typeof THEME_PALETTES]);
    }
  });

  it("does not expose product/company names in theme options", () => {
    const names = THEME_OPTIONS.map((o) => o.name);
    expect(names).toEqual(["Light", "Dark", "Ember", "Aurora"]);
    for (const name of names) {
      expect(name.toLowerCase()).not.toContain("anthropic");
      expect(name.toLowerCase()).not.toContain("chatgpt");
      expect(name.toLowerCase()).not.toContain("claude");
    }
  });
});

describe("themeSlice", () => {
  const initial = { selectedTheme: "Light", THEME: THEME_PALETTES.LIGHT };

  it("selects each of the four themes by display name", () => {
    for (const name of ["Light", "Dark", "Ember", "Aurora"]) {
      const state = reducer(initial, setTheme(name));
      expect(state.selectedTheme).toBe(name);
      expect(state.THEME).toBe(
        THEME_PALETTES[name.toUpperCase() as keyof typeof THEME_PALETTES],
      );
    }
  });

  it("falls back to Light for removed legacy themes loaded from storage", () => {
    for (const legacy of ["Ocean", "Rose"]) {
      const state = reducer(
        initial,
        loadThemeFromStorage.fulfilled(legacy, "", undefined as never),
      );
      expect(state.selectedTheme).toBe("Light");
      expect(state.THEME).toBe(THEME_PALETTES.LIGHT);
    }
  });

  it("loads each valid theme from storage by name", () => {
    const state = reducer(
      initial,
      loadThemeFromStorage.fulfilled("Ember", "", undefined as never),
    );
    expect(state.selectedTheme).toBe("Ember");
    expect(state.THEME).toBe(THEME_PALETTES.EMBER);
  });
});
