import React from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
};

/**
 * Reusable search bar used on both the Transaction and Budget screens.
 *
 * Previously two near-identical copies (`TxSearchBar` and `BudgetSearchBar`)
 * existed — this shared component eliminates that duplication.
 */
export default function SearchBar({
  searchQuery,
  setSearchQuery,
  placeholder = "Search...",
}: Props) {
  const { THEME } = useTheme();
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={placeholder}
        className="py-4 pl-12 rounded-full px-4 flex-1"
        style={{
          backgroundColor: THEME.inputBackground,
          color: THEME.textPrimary,
        }}
        placeholderTextColor={THEME.placeholderText}
      />
      <Feather
        className="absolute ml-4"
        name="search"
        size={20}
        color={THEME.placeholderText}
      />
      <TouchableOpacity
        className="absolute right-4 rounded-full p-2"
        onPress={() => setSearchQuery("")}
        activeOpacity={0.7}
      >
        <Feather name="x" size={20} color={THEME.placeholderText} />
      </TouchableOpacity>
    </View>
  );
}
