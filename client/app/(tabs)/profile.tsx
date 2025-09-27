import {
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { useAppDispatch, useAppSelector, useAuth } from "@/hooks/useRedux";
import {
  deleteUserAccount,
  logoutUser,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
} from "@/store/slices/userSlice";
import ModalCloseButton from "@/components/modalCloseButton";
import { router } from "expo-router";
import Loader from "@/utils/loader";
import { useTheme } from "@/hooks/useRedux";
import { setTheme } from "@/store/slices/themeSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen() {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dispatch = useAppDispatch();
  const { user, error } = useAuth();
  const { THEME, selectedTheme } = useTheme();

  // Show error alerts for Redux state errors
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error);
    }
  }, [error]);

  const bankConnections = [
    {
      name: "Bank of America",
      accountNumber: "4567",
      balance: "$5,230.50",
    },
    {
      name: "Chase",
      accountNumber: "8910",
      balance: "$12,780.12",
    },
  ];

  const settingsItems = [
    {
      title: "Log Out",
      icon: "log-out-outline",
      onPress: () => handleLogout(),
    },
    {
      title: "Change Password",
      icon: "key-outline",
      onPress: () => setChangeOpen(true),
    },
    {
      title: "Delete Account",
      icon: "chevron-forward",
      onPress: () => handleDeleteAccount(),
      isDestructive: true,
    },
  ];

  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const closeChangeModal = (open: boolean) => {
    // when closing, clear inputs
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangeOpen(open);
  };

  // Handler for picking and uploading image
  const handlePickImage = async () => {
    // Request permission
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Permission to access gallery is required!"
      );
      return;
    }
    // Pick image (use MediaType array per new API)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
    });

    if (!result.canceled && user?.id) {
      const image = result.assets ? result.assets[0] : result;

      const imageFile = {
        uri: image.uri,
        type: image?.mimeType || "image/jpeg",
        name: image?.fileName || "profile.jpg",
      };

      try {
        setUploading(true);
        const resultAction = await dispatch(
          uploadProfilePicture({ userId: user.id, imageFile })
        );

        if (uploadProfilePicture.fulfilled.match(resultAction)) {
          router.push("/(tabs)/profile");
          /* Alert.alert("Success", "Profile picture uploaded successfully!"); */
        } else if (uploadProfilePicture.rejected.match(resultAction)) {
          Alert.alert(
            "Upload Failed",
            (resultAction.payload as string) ||
              "Failed to upload profile picture"
          );
        }
      } catch (error) {
        Alert.alert("Upload Failed", "An unexpected error occurred");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => dispatch(logoutUser()),
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Confirm Delete Account",
      "Are you sure you want to delete your account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            // Second layer of protection: irreversible warning
            Alert.alert(
              "Delete Account — Irreversible",
              "This action is permanent. Once you delete your account, all your data will be lost and cannot be recovered. Are you absolutely sure you want to continue?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Account",
                  style: "destructive",
                  onPress: async () => {
                    if (user?.id) {
                      const response = await dispatch(
                        deleteUserAccount(user.id)
                      );

                      const { success, message } = response.payload as {
                        success: boolean;
                        message: string;
                      };
                      if (success) {
                        Alert.alert(
                          "Account Deleted",
                          "Your account has been deleted successfully."
                        );
                        router.push("/login");
                      } else {
                        Alert.alert(
                          "Deletion Failed",
                          message || "Failed to delete account."
                        );
                      }
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleThemeSelect = async (themeName: string) => {
    dispatch(setTheme(themeName));
    await AsyncStorage.setItem("selectedTheme", themeName);
    Alert.alert("Theme Changed", `Theme changed to ${themeName}`);
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6">
        {/* Header */}
        <View className="items-center justify-center mt-4 mb-8">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-2xl font-bold"
          >
            Profile
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Profile Section */}
        <View className="items-center mb-8">
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
                  <TouchableOpacity
                    onPress={handlePickImage}
                    onLongPress={() => {
                      Alert.alert(
                        "Delete Profile Picture",
                        "Are you sure you want to delete your profile picture?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              if (!user?.id) return;
                              try {
                                setDeleting(true);
                                const res: any = await dispatch(
                                  deleteProfilePicture(user.id)
                                );
                                if (deleteProfilePicture.fulfilled.match(res)) {
                                  Alert.alert(
                                    "Deleted",
                                    "Profile picture deleted."
                                  );
                                } else {
                                  Alert.alert(
                                    "Deletion Failed",
                                    (res.payload as string) ||
                                      "Failed to delete profile picture"
                                  );
                                }
                              } catch (e: any) {
                                Alert.alert(
                                  "Deletion Failed",
                                  e?.message ||
                                    "Failed to delete profile picture"
                                );
                              } finally {
                                setDeleting(false);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Image
                      source={{ uri: user.profilePic }}
                      style={{ width: 108, height: 108, borderRadius: 54 }}
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={{
                      width: 108,
                      height: 108,
                      borderRadius: 54,
                      backgroundColor: THEME.textSecondary + "33", // greyed out
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="camera"
                      size={48}
                      color={THEME.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>

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

        {/* Bank Connections (Coming Soon) */}
        <View className="mb-8">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-xl font-bold mb-4"
          >
            Bank Connections
          </Text>

          <View
            style={{ backgroundColor: THEME.surface }}
            className="p-6 rounded-xl"
          >
            <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
              Coming soon
            </Text>
            <Text style={{ color: THEME.textSecondary, marginTop: 8 }}>
              Bank linking will be available in a future update. When released,
              you'll be able to securely connect your bank accounts to import
              transactions automatically, reconcile balances, and categorize
              spending.
            </Text>
            <Text style={{ color: THEME.textSecondary, marginTop: 12 }}>
              For now, you can manually add transactions and budgets. We will
              announce bank connections and secure integrations in the app
              release notes.
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View className="mb-8">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-xl font-bold mb-4"
          >
            Settings
          </Text>

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
              {[
                { name: "Light", color: "#E0E0E0", icon: "sunny-outline" },
                { name: "Dark", color: "#778899", icon: "moon-outline" },
                { name: "Forest", color: "#8FBC8F", icon: "leaf-outline" },
                { name: "Coffee", color: "#A48275", icon: "cafe-outline" },
              ].map((themeOption) => (
                <TouchableOpacity
                  key={themeOption.name}
                  activeOpacity={0.85}
                  onPress={() => handleThemeSelect(themeOption.name)}
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: 12,
                    borderWidth: selectedTheme === themeOption.name ? 2.5 : 1,
                    borderColor:
                      selectedTheme === themeOption.name
                        ? THEME.primary
                        : "#e0e0e0",
                    backgroundColor: THEME.surface,
                    marginHorizontal: 4,
                    shadowColor:
                      selectedTheme === themeOption.name
                        ? THEME.primary
                        : "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity:
                      selectedTheme === themeOption.name ? 0.18 : 0.05,
                    shadowRadius: 4,
                    elevation: selectedTheme === themeOption.name ? 3 : 0,
                    width: 72,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: themeOption.color,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: "#eee",
                    }}
                  >
                    <Ionicons
                      name={themeOption.icon as any}
                      size={18}
                      color={THEME.textPrimary}
                    />
                  </View>
                  <Text
                    style={{
                      color:
                        selectedTheme === themeOption.name
                          ? THEME.primary
                          : THEME.textPrimary,
                      fontWeight:
                        selectedTheme === themeOption.name ? "bold" : "500",
                      fontSize: 13,
                      letterSpacing: 0.2,
                    }}
                  >
                    {themeOption.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Other Settings */}
          {settingsItems.map((item, index) => (
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
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      {changeOpen && (
        <Modal
          visible={changeOpen}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: THEME.background, padding: 18 }}
          >
            {/* close button (top-right) will clear inputs via closeChangeModal */}
            <ModalCloseButton setOpenSheet={closeChangeModal} />

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

              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={async () => {
                    // Basic validation
                    if (!currentPassword || !newPassword || !confirmPassword) {
                      Alert.alert("Please fill all fields");
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      Alert.alert("New passwords do not match");
                      return;
                    }
                    setPwSaving(true);
                    try {
                      const response: any = await dispatch(
                        changePassword({
                          currentPassword,
                          newPassword,
                          confirmPassword,
                        })
                      );
                      if (changePassword.fulfilled.match(response)) {
                        Alert.alert(
                          "Success",
                          response.payload?.message || "Password changed"
                        );
                        closeChangeModal(false);
                      } else {
                        const err =
                          response.payload ||
                          response.error?.message ||
                          "Failed to change password";
                        Alert.alert("Error", err);
                      }
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e?.message || "Failed to change password"
                      );
                    } finally {
                      setPwSaving(false);
                    }
                  }}
                >
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
                    {pwSaving ? (
                      <ActivityIndicator color={THEME.textPrimary} />
                    ) : (
                      <Text
                        style={{ color: THEME.textPrimary, fontWeight: "700" }}
                      >
                        Update Password
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Full-screen loading overlay during upload */}
      {uploading && <Loader msg="Uploading..." />}
      {deleting && <Loader msg="Deleting..." />}
    </SafeAreaView>
  );
}
