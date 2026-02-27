import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import ModalCloseButton from "@/components/global/modalCloseButton";
import type { ChangePasswordModalProps } from "@/types/profile/types";

/**
 * Full-screen modal for changing the user's password.
 * Manages its own local text-input state; delegates validation + dispatch to
 * the parent via `onSubmit`.
 */
export default function ChangePasswordModal({
  THEME,
  visible,
  onClose,
  onSubmit,
  saving,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  const handleSubmit = async () => {
    await onSubmit(currentPassword, newPassword, confirmPassword);
    // If the parent closes the modal on success the inputs will reset via
    // the `visible` guard below; if not we leave them for correction.
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: THEME.background,
          padding: 18,
          position: "relative",
        }}
      >
        <View className="relative mb-4">
          <ModalCloseButton setOpenSheet={handleClose} />
        </View>

        <View style={{ alignItems: "center", marginTop: 12 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Change Password
          </Text>
        </View>

        <ScrollView
          style={{ marginTop: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Current */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: THEME.textSecondary, marginBottom: 6 }}>
              Current Password
            </Text>
            <TextInput
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={THEME.placeholderText}
              style={{
                backgroundColor: THEME.inputBackground,
                color: THEME.textPrimary,
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>

          {/* New */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: THEME.textSecondary, marginBottom: 6 }}>
              New Password
            </Text>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={THEME.placeholderText}
              style={{
                backgroundColor: THEME.inputBackground,
                color: THEME.textPrimary,
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>

          {/* Confirm */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: THEME.textSecondary, marginBottom: 6 }}>
              Confirm New Password
            </Text>
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={THEME.placeholderText}
              style={{
                backgroundColor: THEME.inputBackground,
                color: THEME.textPrimary,
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>

          {/* Submit */}
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit}>
              <LinearGradient
                colors={[THEME.primary, THEME.secondary]}
                start={[0, 0]}
                end={[1, 1]}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                {saving ? (
                  <ActivityIndicator color={THEME.textPrimary} />
                ) : (
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    Update Password
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
