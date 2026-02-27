import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { formatDate, capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "../../utils/transaction/helpers";
import type { TransactionItem } from "../../types/transaction/types";
import { Feather } from "@expo/vector-icons";

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
  const budgets = useBudgets();
  const amt = safeAmount(tx.amount);

  const displayCategory = useMemo(() => {
    if (tx.budgetId) {
      const linked = budgets.find((b) => b.id === tx.budgetId);
      if (linked) return linked.category;
    }

    return tx.category;
  }, [tx.budgetId, tx.category, budgets]);

  const displayTxIcon = useMemo(() => {
    if (tx.budgetId) {
      const linked = budgets.find((b) => b.id === tx.budgetId);
      if (linked) return linked.icon;
    }

    return tx.icon;
  }, [tx.category, budgets]);

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
        <View
          className="items-center rounded-full p-3"
          style={{
            backgroundColor: THEME.inputBackground,
            borderColor: THEME.border,
            borderWidth: 1,
          }}
        >
          <Feather
            name={displayTxIcon as keyof typeof Feather.glyphMap}
            size={20}
            color={THEME.primary}
          />
        </View>
        <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
          <Text
            style={{ color: THEME.textPrimary, fontWeight: "700" }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {capitalizeFirst(displayCategory)}
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
