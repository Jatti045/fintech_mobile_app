import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { formatDate, capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "../../utils/transaction/helpers";
import type { TransactionItem } from "../../types/transaction/types";

/**
 * Single transaction row with press-to-edit and long-press-to-delete behaviour.
 * Reads theme colours from the `useTheme` hook internally.
 */
const TransactionRow = React.memo(function TransactionRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: TransactionItem;
  onEdit: (tx: TransactionItem) => void;
  onDelete: (id: string) => void;
}) {
  const { THEME } = useTheme();
  const amt = safeAmount(tx.amount);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: THEME.surface,
        borderColor: THEME.border,
        borderWidth: 1,
      }}
      className="flex-row p-3 items-center justify-between mb-3 rounded-lg"
      activeOpacity={0.8}
      onPress={() => onEdit(tx)}
      onLongPress={() => onDelete(tx.id)}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
          <Text
            style={{ color: THEME.textPrimary, fontWeight: "700" }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {capitalizeFirst(tx.category)}
          </Text>
          <Text
            style={{ color: THEME.textSecondary }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatDate(tx.date)} - {tx.name}
          </Text>
        </View>
      </View>
      <View style={{ marginLeft: 12, alignItems: "flex-end" }}>
        <Text
          style={{ color: THEME.danger, fontWeight: "700" }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          - {formatCurrency(amt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default TransactionRow;
