import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProfile } from "@/hooks/profile/useProfile";
import { DEFAULT_CURRENCY } from "@/constants/Currencies";
import Loader from "@/utils/loader";

import {
  ProfileHeader,
  ThemeSwitcher,
  CurrencySelector,
  SettingsList,
  ChangePasswordModal,
  CurrencyPickerModal,
  BankConnections,
} from "@/components/profile";

export default function ProfileScreen() {
  const {
    user,
    THEME,
    selectedTheme,
    uploading,
    deleting,
    refreshing,
    onRefresh,
    handlePickImage,
    handleDeleteImage,
    handleThemeSelect,
    currencyPickerOpen,
    setCurrencyPickerOpen,
    handleCurrencySelect,
    changeOpen,
    closeChangeModal,
    handleChangePassword,
    pwSaving,
    settingsItems,
  } = useProfile();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        <ProfileHeader
          THEME={THEME}
          user={user}
          uploading={uploading}
          deleting={deleting}
          onPickImage={handlePickImage}
          onDeleteImage={handleDeleteImage}
        />

        <BankConnections THEME={THEME} />

        {/* Settings */}
        <View className="mb-8">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-xl font-bold mb-4"
          >
            Settings
          </Text>

          <ThemeSwitcher
            THEME={THEME}
            selectedTheme={selectedTheme}
            onThemeSelect={handleThemeSelect}
          />

          <CurrencySelector
            THEME={THEME}
            userCurrency={user?.currency || DEFAULT_CURRENCY}
            onPress={() => setCurrencyPickerOpen(true)}
          />

          <SettingsList THEME={THEME} items={settingsItems} />
        </View>
      </ScrollView>

      {/* Modals */}
      <ChangePasswordModal
        THEME={THEME}
        visible={changeOpen}
        onClose={closeChangeModal}
        onSubmit={handleChangePassword}
        saving={pwSaving}
      />

      <CurrencyPickerModal
        THEME={THEME}
        visible={currencyPickerOpen}
        userCurrency={user?.currency || DEFAULT_CURRENCY}
        onSelect={handleCurrencySelect}
        onClose={() => setCurrencyPickerOpen(false)}
      />

      {/* Full-screen loading overlays */}
      {uploading && <Loader msg="Uploading..." />}
      {deleting && <Loader msg="Deleting..." />}
    </SafeAreaView>
  );
}
