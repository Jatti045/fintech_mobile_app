import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SettingsListProps } from "@/types/profile/types";

/**
 * Renders the list of action-rows (Log Out, Change Password, Delete Account).
 */
export default function SettingsList({ THEME, items }: SettingsListProps) {
  return (
    <>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          onPress={item.onPress}
          style={{ backgroundColor: THEME.surface }}
          className="flex-row items-center justify-between p-4 rounded-xl mb-3"
        >
          <Text
            className="font-medium text-base"
            style={{
              color: item.isDestructive ? THEME.danger : THEME.textPrimary,
            }}
          >
            {item.title}
          </Text>
          <Ionicons
            name={item.icon as any}
            size={20}
            color={item.isDestructive ? THEME.danger : THEME.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </>
  );
}
