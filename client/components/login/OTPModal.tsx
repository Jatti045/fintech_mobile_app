import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import ModalCloseButton from "../modalCloseButton";
import { useTheme, useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { resetPassword, selectIsLoading } from "@/store/slices/userSlice";

function OTPModal({
  visible,
  setVisible,
  email,
  onVerified,
}: {
  visible: boolean;
  setVisible: (v: boolean) => void;
  email: string;
  onVerified: (otp: string) => void;
}) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [otp, setOtp] = useState("");
  const prev = useRef(visible);
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectIsLoading);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible && prev.current) {
      setOtp("");
    }
    prev.current = visible;
  }, [visible]);

  const confirmClose = () => {
    showAlert({
      title: "Discard code?",
      message:
        "If you leave now the current code will be invalid and you'll need to request a new one.",
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
    if (!otp.trim()) {
      showAlert({ title: "Please enter the code" });
      return;
    }

    try {
      setIsSubmitting(true);
      // Use the resetPassword thunk with verifyOnly flag to validate the OTP
      const action = await dispatch(
        resetPassword({ email, otp, verifyOnly: true }) as any
      ).unwrap();

      // action should be the API response object { success, message, data }
      if (action?.success) {
        onVerified(otp);
      } else {
        showAlert({
          title: "Invalid code",
          message: action?.message || "Please try again",
        });
      }
    } catch (err: any) {
      showAlert({
        title: "Invalid code",
        message:
          err?.message || err?.response?.data?.message || "Please try again",
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
                Enter Code
              </Text>

              <Text
                style={{ color: THEME.textSecondary }}
                className="mb-2 text-center"
              >
                Enter the 6-digit code sent to {email}
              </Text>

              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                style={{
                  backgroundColor: THEME.inputBackground,
                  color: THEME.textPrimary,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  marginVertical: 12,
                  fontSize: 18,
                  textAlign: "center",
                }}
                placeholderTextColor={THEME.placeholderText}
                maxLength={6}
              />

              <View className="mt-4">
                <TouchableOpacity
                  onPress={isSubmitting ? undefined : handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                  style={{ opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <View
                    style={{
                      backgroundColor: THEME.primary,
                      padding: 12,
                      borderRadius: 8,
                      alignItems: "center",
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
                        style={{ color: THEME.textPrimary, fontWeight: "700" }}
                      >
                        Verify Code
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default OTPModal;
