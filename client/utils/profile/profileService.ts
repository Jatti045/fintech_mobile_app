// ─── Profile Service ────────────────────────────────────────────────────────
// Pure / side-effect-only helpers extracted from the profile screen so the hook
// and components stay focused on state orchestration and rendering.

import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Image Picker ───────────────────────────────────────────────────────────

export interface PickedImage {
  uri: string;
  type: string;
  name: string;
}

/**
 * Requests gallery permission and launches the image picker.
 * Returns the selected image metadata or `null` if cancelled / denied.
 */
export async function pickProfileImage(): Promise<PickedImage | null> {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0] ?? result;
  return {
    uri: (asset as any).uri,
    type: (asset as any).mimeType || "image/jpeg",
    name: (asset as any).fileName || "profile.jpg",
  };
}

// ─── Theme Persistence ──────────────────────────────────────────────────────

/**
 * Persists the selected theme name to AsyncStorage.
 */
export async function persistTheme(themeName: string): Promise<void> {
  await AsyncStorage.setItem("selectedTheme", themeName);
}

// ─── Theme Options ──────────────────────────────────────────────────────────
// Static config – extracted so the UI component is purely presentational.

import type { ThemeOption } from "@/types/profile/types";

export const THEME_OPTIONS: ThemeOption[] = [
  { name: "Light", color: "#B8942F", icon: "sunny-outline" },
  { name: "Dark", color: "#D4AF6A", icon: "moon-outline" },
  { name: "Ocean", color: "#0EA5E9", icon: "water-outline" },
  { name: "Rose", color: "#EB6F92", icon: "rose-outline" },
];
