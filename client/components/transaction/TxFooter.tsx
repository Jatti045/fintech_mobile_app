import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

/**
 * Infinite-scroll footer: loading spinner, "Load More" button, or end-of-list.
 */
const ListFooter = React.memo(function ListFooter({
  hasNextPage,
  isLoadingMore,
  hasTransactions,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  hasTransactions: boolean;
  onLoadMore: () => void;
}) {
  const { THEME } = useTheme();

  if (hasNextPage) {
    return (
      <View className="py-4 items-center">
        {isLoadingMore ? (
          <>
            <ActivityIndicator size="small" color={THEME.secondary} />
            <Text style={{ color: THEME.textSecondary, marginTop: 8 }}>
              Loading more...
            </Text>
          </>
        ) : (
          <TouchableOpacity onPress={onLoadMore} activeOpacity={0.8}>
            <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
              Load More Transactions
            </Text>
            <Ionicons name="chevron-down" size={18} color={THEME.background} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (hasTransactions) {
    return (
      <View className="py-4 items-center">
        <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
          No more transactions
        </Text>
      </View>
    );
  }

  return null;
});

export default ListFooter;
