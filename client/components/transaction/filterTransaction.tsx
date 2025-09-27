import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst } from "@/utils/helper";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function FilterTransaction({
  budgets,
  filterCategoryId,
  setFilterCategoryId,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  clearFilters,
}: {
  budgets: any[];
  filterCategoryId: string | "all";
  setFilterCategoryId: (id: string | "all") => void;
  minAmount: string;
  setMinAmount: (amount: string) => void;
  maxAmount: string;
  setMaxAmount: (amount: string) => void;
  clearFilters: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <View>
      <ScrollView
        showsHorizontalScrollIndicator={false}
        horizontal
        className="mb-4"
      >
        <TouchableOpacity
          onPress={clearFilters}
          className="mr-3 p-3 rounded-full"
          style={{ backgroundColor: THEME.secondary }}
        >
          <Text style={{ color: THEME.textPrimary }} className="text-sm px-2">
            Clear
          </Text>
        </TouchableOpacity>
        {/* Category chips */}
        <TouchableOpacity
          onPress={() => setFilterCategoryId("all")}
          className="mr-3 p-3 rounded-full"
          style={{
            backgroundColor:
              filterCategoryId === "all" ? THEME.primary : THEME.surface,
          }}
        >
          <Text style={{ color: THEME.textPrimary }} className="text-sm px-2">
            All
          </Text>
        </TouchableOpacity>
        {budgets.map((b) => (
          <TouchableOpacity
            key={b.id}
            onPress={() => setFilterCategoryId(b.id)}
            className="mr-3 p-3 rounded-full"
            style={{
              backgroundColor:
                filterCategoryId === b.id ? THEME.primary : THEME.surface,
            }}
          >
            <Text style={{ color: THEME.textPrimary }} className="text-sm px-2">
              {capitalizeFirst(b.category)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Consolidated horizontal filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        {/* Category dropdown trigger */}
        <TouchableOpacity
          className="mr-3 px-4 py-2 rounded-full"
          style={{
            backgroundColor:
              filterCategoryId === "all" ? THEME.primary : THEME.surface,
          }}
        >
          <Text style={{ color: THEME.textPrimary }}>
            {filterCategoryId === "all"
              ? "Category: All"
              : `Category: ${capitalizeFirst(budgets.find((b) => b.id === filterCategoryId)?.category || "")}`}
          </Text>
        </TouchableOpacity>

        {/* Min / Max Amount */}
        <View className="mr-3 flex-row items-center">
          <TextInput
            placeholder="Min"
            keyboardType="numeric"
            value={minAmount}
            onChangeText={setMinAmount}
            className="py-2 px-3 mr-2 rounded-md"
            style={{
              backgroundColor: THEME.inputBackground,
              color: THEME.textPrimary,
              width: 90,
            }}
            placeholderTextColor={THEME.placeholderText}
          />
          <TextInput
            placeholder="Max"
            keyboardType="numeric"
            value={maxAmount}
            onChangeText={setMaxAmount}
            className="py-2 px-3 rounded-md"
            style={{
              backgroundColor: THEME.inputBackground,
              color: THEME.textPrimary,
              width: 90,
            }}
            placeholderTextColor={THEME.placeholderText}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default FilterTransaction;
