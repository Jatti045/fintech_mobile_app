import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import type { ProfileAvatarProps } from "@/types/profile/types";

/**
 * Renders the gradient-bordered avatar with tap-to-upload and long-press-to-delete.
 */
export default function ProfileAvatar({
  THEME,
  user,
  onPickImage,
  onDeleteImage,
}: ProfileAvatarProps) {
  return (
    <View className="relative mb-4">
      <LinearGradient
        colors={[THEME.primary, THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          padding: 3,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 114,
            height: 114,
            borderRadius: 57,
            backgroundColor: THEME.surface,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {user?.profilePic ? (
            <TouchableOpacity onPress={onPickImage} onLongPress={onDeleteImage}>
              <Image
                source={{ uri: user.profilePic }}
                style={{ width: 108, height: 108, borderRadius: 54 }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onPickImage}
              style={{
                width: 108,
                height: 108,
                borderRadius: 54,
                backgroundColor: THEME.textSecondary + "33",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera" size={48} color={THEME.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}
