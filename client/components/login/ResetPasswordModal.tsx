import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalCloseButton from "../modalCloseButton";
import { useTheme, useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { resetPassword, selectIsLoading } from "@/store/slices/userSlice";
import { router } from "expo-router";

function ResetPasswordModal({
  visible,
  setVisible,
  email,
  otp,
}: {
  visible: boolean;
  setVisible: (v: boolean) => void;
  email: string;
  otp: string;
}) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectIsLoading);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prev = useRef(visible);

  useEffect(() => {
    if (!visible && prev.current) {
      setNewPassword("");
      setConfirmPassword("");
    }
    prev.current = visible;
  }, [visible]);

  const confirmClose = () => {
    showAlert({
      title: "Discard changes?",
      message:
        "If you leave now the reset will be cancelled and you'll need to request a new code to reset your password.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => setVisible(false),
        },
      ],
    });
  };

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      showAlert({ title: "Please fill both password fields" });
      return;
    }
    if (newPassword.length < 6) {
      showAlert({
        title: "Password too short",
        message: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: "Passwords do not match" });
      return;
    }

    try {
      setIsSubmitting(true);
      const action = await dispatch(
        resetPassword({ email, otp, newPassword, confirmPassword }) as any
      ).unwrap();

      if (action?.success) {
        showAlert({
          title: "Success",
          message: "Password reset successful",
          buttons: [
            { text: "OK", onPress: () => router.replace("/(auth)/login") },
          ],
        });
      } else {
        showAlert({
          title: "Error",
          message: action?.message || "Failed to reset password",
        });
      }
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to reset password",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: THEME.background }}
        >
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <View className="flex-1 px-4">
              <ModalCloseButton setOpenSheet={confirmClose as any} />

              <View className="mt-20 px-2">
                <Text
                  style={{ color: THEME.textPrimary }}
                  className="text-xl font-bold text-center mb-6"
                >
                  Set New Password
                </Text>

                <Text
                  style={{ color: THEME.textSecondary }}
                  className="mb-2 text-center"
                >
                  Enter your new password
                </Text>

                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  secureTextEntry
                  placeholderTextColor={THEME.placeholderText}
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginVertical: 8,
                  }}
                />

                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  secureTextEntry
                  placeholderTextColor={THEME.placeholderText}
                  style={{
                    backgroundColor: THEME.inputBackground,
                    color: THEME.textPrimary,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    marginVertical: 8,
                  }}
                />

                <View className="mt-4">
                  <TouchableWithoutFeedback
                    onPress={isSubmitting ? undefined : handleSubmit}
                  >
                    <View
                      style={{
                        backgroundColor: THEME.primary,
                        padding: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        opacity: isSubmitting ? 0.6 : 1,
                        flexDirection: "row",
                        justifyContent: "center",
                      }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator
                          size="small"
                          color={THEME.textPrimary}
                        />
                      ) : (
                        <Text
                          style={{
                            color: THEME.textPrimary,
                            fontWeight: "700",
                          }}
                        >
                          Save New Password
                        </Text>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default ResetPasswordModal;
