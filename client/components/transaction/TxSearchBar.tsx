import { useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import { TextInput, TouchableOpacity, View } from "react-native";

function SearchTransaction({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}) {
  const { THEME } = useTheme();
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search transactions..."
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

export default SearchTransaction;
