import React from "react";
import { View, Text } from "react-native";

import ProfileAvatar from "./ProfileAvatar";
import type { ProfileHeaderProps } from "@/types/profile/types";

/**
 * Top section of the profile screen: avatar + user name + email.
 */
export default function ProfileHeader({
  THEME,
  user,
  uploading,
  deleting,
  onPickImage,
  onDeleteImage,
}: ProfileHeaderProps) {
  return (
    <>
      {/* Page title */}
      <View className="items-center justify-center mt-4 mb-8">
        <Text
          style={{ color: THEME.textPrimary }}
          className="text-2xl font-bold"
        >
          Profile
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Avatar + identity */}
      <View className="items-center mb-8">
        <ProfileAvatar
          THEME={THEME}
          user={user}
          uploading={uploading}
          deleting={deleting}
          onPickImage={onPickImage}
          onDeleteImage={onDeleteImage}
        />

        <Text
          style={{ color: THEME.textPrimary }}
          className="text-2xl font-bold mb-2"
        >
          {user?.username || "Your Name"}
        </Text>
        <Text style={{ color: THEME.textSecondary }} className="text-base">
          {user?.email || "your.email@email.com"}
        </Text>
      </View>
    </>
  );
}
