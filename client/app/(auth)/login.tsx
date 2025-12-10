import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector, useTheme } from "@/hooks/useRedux";
import {
  loginUser,
  selectIsLoading,
  selectLoginError,
  clearLoginError,
} from "@/store/slices/userSlice";
import { useThemedAlert } from "@/utils/themedAlert";
import { forgotPassword } from "@/store/slices/userSlice";
import ForgotPasswordModal from "@/components/login/ForgotPasswordModal";
import OTPModal from "@/components/login/OTPModal";
import ResetPasswordModal from "@/components/login/ResetPasswordModal";
import apiClient from "@/config/apiClient";

const { width, height } = Dimensions.get("window");
const isSmallScreen = width < 380;
const isTablet = width > 768;

const LoginScreen = () => {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectLoginError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [currentOtp, setCurrentOtp] = useState("");
  const [pendingForgotEmail, setPendingForgotEmail] = useState<string | null>(
    null
  );

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    dispatch(clearLoginError());

    try {
      // Validation
      if (!email.trim() || !password.trim()) {
        showAlert({
          title: "Validation Error",
          message: "Please fill in all fields",
        });
        return;
      }

      if (!validateEmail(email)) {
        showAlert({
          title: "Validation Error",
          message: "Please enter a valid email address",
        });
        return;
      }

      if (password.length < 6) {
        showAlert({
          title: "Validation Error",
          message: "Password must be at least 6 characters",
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      // Dispatch login action
      const response = await dispatch(
        loginUser({ email: normalizedEmail, password })
      ).unwrap();

      // Debugging log
      console.log("Login response:", response);

      // Navigate to tabs on successful login
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Login error:", error);
      // Error is already handled by Redux state, no need to set local error
      showAlert({
        title: "Login Failed",
        message:
          (error as string) ||
          "Network error. Please check your connection and try again.",
      });
    }
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View
            className={`flex-1 justify-center px-6 ${isTablet ? "items-center" : ""}`}
          >
            <View className={`${isTablet ? "w-full max-w-lg" : "w-full"}`}>
              {/* App Title and Welcome */}
              <View className="items-center mb-8">
                <View className="mb-2">
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className={`${isSmallScreen ? "text-3xl" : "text-4xl"} font-bold text-center mb-2`}
                  >
                    Budgee
                  </Text>
                  <Text
                    style={{ color: THEME.textSecondary }}
                    className={`${isSmallScreen ? "text-sm" : "text-base"} text-center leading-5`}
                  >
                    Welcome back! Please enter your details.
                  </Text>
                </View>
              </View>

              {/* Login Form */}
              <View className="space-y-4 mb-6">
                {/* Error Message */}
                {error ? (
                  <View
                    style={{ backgroundColor: THEME.danger + "20" }}
                    className="p-4 rounded-xl border border-red-200"
                  >
                    <Text
                      style={{ color: THEME.danger }}
                      className="text-sm text-center"
                    >
                      {error}
                    </Text>
                  </View>
                ) : null}

                {/* Email Input */}
                <View>
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-sm font-medium mb-2"
                  >
                    Email
                  </Text>
                  <View className="relative">
                    <TextInput
                      style={{
                        backgroundColor: THEME.inputBackground,
                        borderColor: email ? THEME.primary : THEME.border,
                        color: THEME.textPrimary,
                        shadowColor: THEME.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: email ? 0.1 : 0,
                        shadowRadius: 8,
                      }}
                      className={`border-2 py-4 px-4 leading-tight rounded-xl text-base ${
                        email ? "border-opacity-50" : ""
                      }`}
                      placeholder="Enter your email"
                      placeholderTextColor={THEME.placeholderText}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                    />
                    {email && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={THEME.success}
                        style={{
                          position: "absolute",
                          right: 16,
                          top: "50%",
                          marginTop: -10,
                        }}
                      />
                    )}
                  </View>
                </View>

                {/* Password Input */}
                <View>
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-sm font-medium my-2"
                  >
                    Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      style={{
                        backgroundColor: THEME.inputBackground,
                        borderColor: password ? THEME.primary : THEME.border,
                        color: THEME.textPrimary,
                        shadowColor: THEME.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: password ? 0.1 : 0,
                        shadowRadius: 8,
                      }}
                      className={`border-2 py-4 px-4 leading-tight pr-12 rounded-xl text-base ${
                        password ? "border-opacity-50" : ""
                      }`}
                      placeholder="Enter your password"
                      placeholderTextColor={THEME.placeholderText}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        marginTop: -12,
                      }}
                      className="p-1"
                    >
                      <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={20}
                        color={THEME.placeholderText}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot Password */}
                <View className="items-end mt-2">
                  <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Text
                      style={{ color: THEME.secondary }}
                      className="text-sm font-medium"
                    >
                      Forgot Password?
                    </Text>{" "}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading || !email || !password}
                style={{
                  opacity: isLoading || !email || !password ? 0.6 : 1,
                }}
                className="mb-8"
              >
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    shadowColor: THEME.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  }}
                >
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-center text-lg font-semibold"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View className="items-center">
                <Text
                  style={{ color: THEME.textSecondary }}
                  className="text-base"
                >
                  Don't have an account?{" "}
                  <Link href="/(auth)/signup">
                    <Text
                      style={{
                        color: THEME.secondary,
                        fontWeight: "600",
                      }}
                    >
                      Sign Up
                    </Text>
                  </Link>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isModalVisible={isModalVisible}
        setModalVisible={setModalVisible}
        onSubmit={(email) => {
          // Start forgot flow; normalize and mark pending then close the forgot modal. After the modal closes we'll open OTP.
          const normalized = email.trim().toLowerCase();
          dispatch(forgotPassword({ email: normalized })).catch(() => {});
          setPendingForgotEmail(normalized);
          setModalVisible(false);
        }}
      />

      {/* When the forgot modal actually closes, open OTP modal and show generic OTP message */}
      {pendingForgotEmail &&
        !isModalVisible &&
        (() => {
          // open modal and clear pending
          setForgotEmail(pendingForgotEmail);
          setOtpModalVisible(true);
          setTimeout(() => {
            showAlert({
              title: "If an account exists, an OTP was sent to your email.",
            });
          }, 300);
          setPendingForgotEmail(null);
          return null;
        })()}

      <OTPModal
        visible={otpModalVisible}
        setVisible={setOtpModalVisible}
        email={forgotEmail}
        onVerified={(otp) => {
          // Move to reset password modal. The OTP modal validated the code via verifyOnly path.
          setCurrentOtp(otp);
          setOtpModalVisible(false);
          setResetModalVisible(true);
        }}
      />

      <ResetPasswordModal
        visible={resetModalVisible}
        setVisible={setResetModalVisible}
        email={forgotEmail}
        otp={currentOtp}
      />
    </SafeAreaView>
  );
};

export default LoginScreen;
