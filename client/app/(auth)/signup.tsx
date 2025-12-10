import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import {
  clearSignupError,
  signupUser,
  useAppDispatch,
  useAuth,
  useAuthStatus,
} from "@/store";
import Loader from "@/utils/loader";

const { width, height } = Dimensions.get("window");
const isSmallScreen = width < 380;
const isTablet = width > 768;

const SignUpScreen = () => {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { isLoading } = useAuthStatus();
  const dispatch = useAppDispatch();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    dispatch(clearSignupError());

    try {
      // Validation
      if (
        !username.trim() ||
        !email.trim() ||
        !password.trim() ||
        !confirmPassword.trim()
      ) {
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

      if (password !== confirmPassword) {
        showAlert({
          title: "Validation Error",
          message: "Passwords do not match",
        });
        return;
      }

      // Dispatch signup action
      const normalizedEmail = email.trim().toLowerCase();
      const response = await dispatch(
        signupUser({
          username,
          email: normalizedEmail,
          password,
          confirmPassword,
        })
      ).unwrap();

      // Debugging log
      console.log("Signup response:", response);

      showAlert({
        title: "Signup Successful",
        message: "Your account has been created. Please log in.",
      });

      // Navigate to login on successful signup
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Signup error:", error);
      // Error is already handled by Redux state, no need to set local error
      showAlert({
        title: "Signup Failed",
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
                    Create your account to get started with budgeting.
                  </Text>
                </View>
              </View>

              {/* Sign Up Form */}
              <View className="space-y-4 mb-6">
                {/* Username Input */}
                <View>
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-sm font-medium mb-2"
                  >
                    Username
                  </Text>
                  <View className="relative">
                    <TextInput
                      style={{
                        backgroundColor: THEME.inputBackground,
                        borderColor: username ? THEME.primary : THEME.border,
                        color: THEME.textPrimary,
                        shadowColor: THEME.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: username ? 0.1 : 0,
                        shadowRadius: 8,
                      }}
                      className={`border-2 py-4 px-4 rounded-xl text-base ${
                        username ? "border-opacity-50" : ""
                      }`}
                      placeholder="Choose a username"
                      placeholderTextColor={THEME.placeholderText}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                    />
                    {username && (
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

                {/* Email Input */}
                <View>
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-sm font-medium mb-2 mt-2"
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
                      className={`border-2 py-4 px-4 rounded-xl text-base ${
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
                    className="text-sm font-medium mb-2 mt-2"
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
                      className={`border-2 py-4 px-4 pr-12 rounded-xl text-base ${
                        password ? "border-opacity-50" : ""
                      }`}
                      placeholder="Create a password"
                      placeholderTextColor={THEME.placeholderText}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
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

                {/* Confirm Password Input */}
                <View>
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className="text-sm font-medium mb-2 mt-2"
                  >
                    Confirm Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      style={{
                        backgroundColor: THEME.inputBackground,
                        borderColor: confirmPassword
                          ? THEME.primary
                          : THEME.border,
                        color: THEME.textPrimary,
                        shadowColor: THEME.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: confirmPassword ? 0.1 : 0,
                        shadowRadius: 8,
                      }}
                      className={`border-2 py-4 px-4 pr-12 rounded-xl text-base ${
                        confirmPassword ? "border-opacity-50" : ""
                      }`}
                      placeholder="Confirm your password"
                      placeholderTextColor={THEME.placeholderText}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoComplete="new-password"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        marginTop: -12,
                      }}
                      className="p-1"
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye-off" : "eye"}
                        size={20}
                        color={THEME.placeholderText}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                onPress={handleSignUp}
                disabled={
                  isLoading ||
                  !username ||
                  !email ||
                  !password ||
                  !confirmPassword
                }
                style={{
                  opacity:
                    isLoading ||
                    !username ||
                    !email ||
                    !password ||
                    !confirmPassword
                      ? 0.6
                      : 1,
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
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <View className="items-center">
                <Text
                  style={{ color: THEME.textSecondary }}
                  className="text-base"
                >
                  Already have an account?{" "}
                  <Link href="/(auth)/login">
                    <Text
                      style={{
                        color: THEME.secondary,
                        fontWeight: "600",
                      }}
                    >
                      Sign In
                    </Text>
                  </Link>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {isLoading && <Loader msg="Creating Account..." />}
    </SafeAreaView>
  );
};

export default SignUpScreen;
