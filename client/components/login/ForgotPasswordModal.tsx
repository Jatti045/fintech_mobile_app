import {
  Modal,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { useState, useRef, useEffect } from "react";
import ModalCloseButton from "../global/modalCloseButton";
import Loader from "@/utils/loader";

function ForgotPasswordModal({
  isModalVisible,
  setModalVisible,
  onSubmit,
}: {
  isModalVisible: boolean;
  setModalVisible: (val: boolean) => void;
  onSubmit?: (email: string) => Promise<void> | void;
}) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevOpen = useRef(isModalVisible);

  useEffect(() => {
    if (!isModalVisible && prevOpen.current) {
      setEmail("");
    }
    prevOpen.current = isModalVisible;
  }, [isModalVisible]);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      showAlert({ title: "Please enter your email" });
      return;
    }
    // basic email pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      showAlert({ title: "Please enter a valid email address" });
      return;
    }

    try {
      setIsSubmitting(true);
      if (onSubmit) await onSubmit(trimmed);
      // Close modal and let parent show the generic, non-enumerating message
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to submit",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={true}
      visible={isModalVisible}
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
          <ModalCloseButton setOpenSheet={setModalVisible} />
        </View>
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1, backgroundColor: THEME.background }}
        >
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <View className="flex-1 px-4 ">
              <Text
                style={{ color: THEME.textPrimary }}
                className="text-xl  font-bold text-center mb-6"
              >
                Forgot Password
              </Text>

              <Text style={{ color: THEME.textSecondary }} className="mb-2">
                Enter the email associated with your account
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={THEME.placeholderText}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  backgroundColor: THEME.inputBackground,
                  color: THEME.textPrimary,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  marginBottom: 8,
                }}
              />

              <View className="mt-6">
                <TouchableOpacity
                  onPress={isSubmitting ? undefined : handleSubmit}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <LinearGradient
                    colors={[THEME.primary, THEME.secondary]}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={{
                      paddingVertical: 12,
                      borderRadius: 8,
                      alignItems: "center",
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
                        Send OTP
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default ForgotPasswordModal;
