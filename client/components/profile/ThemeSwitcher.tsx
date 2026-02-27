import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { THEME_OPTIONS } from "@/utils/profile/profileService";
import type { ThemeSwitcherProps } from "@/types/profile/types";

/**
 * Renders the row of selectable theme pills.
 */
export default function ThemeSwitcher({
  THEME,
  selectedTheme,
  onThemeSelect,
}: ThemeSwitcherProps) {
  return (
    <View
      style={{ backgroundColor: THEME.surface }}
      className="p-4 rounded-xl mb-3"
    >
      <Text
        style={{ color: THEME.textPrimary }}
        className="font-medium text-base mb-2"
      >
        Theme
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {THEME_OPTIONS.map((opt) => {
          const isActive = selectedTheme === opt.name;
          return (
            <TouchableOpacity
              key={opt.name}
              activeOpacity={0.85}
              onPress={() => onThemeSelect(opt.name)}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 12,
                borderWidth: isActive ? 2.5 : 1,
                borderColor: isActive ? THEME.primary : "#e0e0e0",
                backgroundColor: THEME.surface,
                marginHorizontal: 4,
                shadowColor: isActive ? THEME.primary : "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isActive ? 0.18 : 0.05,
                shadowRadius: 4,
                elevation: isActive ? 3 : 0,
                width: 72,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: opt.color,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: "#eee",
                }}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={18}
                  color={THEME.textPrimary}
                />
              </View>
              <Text
                style={{
                  color: isActive ? THEME.primary : THEME.textPrimary,
                  fontWeight: isActive ? "bold" : "500",
                  fontSize: 13,
                  letterSpacing: 0.2,
                }}
              >
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
