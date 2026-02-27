import { useTheme } from "@/hooks/useRedux";
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ICONS } from "@/constants/CategoryIcons";
import { Feather } from "@expo/vector-icons";

const IconSelectorModal = ({
  openIconSelector,
  setOpenIconSelector,
  editingBudget,
  setIcon,
}: {
  openIconSelector: boolean;
  setOpenIconSelector: (val: boolean) => void;
  editingBudget?: boolean | null;
  setIcon: (val: string) => void;
}) => {
  const { THEME } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // Memoized icons
  const MemoizedIcons = useMemo(() => {
    return ICONS;
  }, []);

  // Memoized filtered icons - searches both name and label
  const filteredIcons = useMemo(() => {
    if (searchTerm.trim() === "") {
      return MemoizedIcons;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return MemoizedIcons.filter(
      (icon) =>
        icon.name.toLowerCase().includes(lowerSearchTerm) ||
        icon.label.toLowerCase().includes(lowerSearchTerm),
    );
  }, [searchTerm]);

  const handleClearSearch = () => {
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  return (
    <Modal
      visible={openIconSelector}
      animationType="slide"
      transparent={true}
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
        <View className="mb-4 flex-row items-center justify-between">
          <TextInput
            ref={searchInputRef}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search icons by name or category..."
            className="py-4 pl-12 rounded-full px-4 flex-1"
            style={{
              backgroundColor: THEME.inputBackground,
              color: THEME.textPrimary,
            }}
            placeholderTextColor={THEME.placeholderText}
            clearButtonMode="never"
          />
          <Feather
            className="absolute ml-4"
            name="search"
            size={20}
            color={THEME.placeholderText}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              className="absolute right-4 rounded-full p-2"
              onPress={handleClearSearch}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color={THEME.placeholderText} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-2">
          {filteredIcons.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <Feather
                name="inbox"
                size={48}
                color={THEME.placeholderText}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{ color: THEME.textSecondary, marginBottom: 8 }}
                className="text-base font-semibold"
              >
                No icons found
              </Text>
              <Text
                style={{ color: THEME.placeholderText }}
                className="text-xs text-center px-6"
              >
                Try searching with different keywords or categories
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredIcons.map((icon) => (
                <TouchableOpacity
                  onPress={() => {
                    setIcon(icon.name);
                    setOpenIconSelector(false);
                  }}
                  key={icon.id}
                  className="items-center justify-center mb-4"
                  style={{ width: "22%" }} // 4 columns
                >
                  <View
                    className="rounded-xl items-center justify-center"
                    style={{
                      width: 64,
                      height: 64,
                      backgroundColor: THEME.inputBackground,
                    }}
                  >
                    <Feather
                      name={icon.name}
                      size={28}
                      color={THEME.secondary}
                    />
                  </View>

                  <Text
                    className="text-xs mt-1 text-center"
                    style={{ color: THEME.textSecondary }}
                    numberOfLines={1}
                  >
                    {icon.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default IconSelectorModal;
