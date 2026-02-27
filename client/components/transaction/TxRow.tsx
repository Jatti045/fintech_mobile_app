import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { formatDate, capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "../../utils/transaction/helpers";
import type { TransactionItem } from "../../types/transaction/types";
import { Feather } from "@expo/vector-icons";
import { hapticHeavy } from "@/utils/haptics";

/**
 * Single transaction row with press-to-edit, long-press-to-delete, and
 * swipe-right-to-reveal-delete behaviour.
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
  const swipeableRef = useRef<Swipeable>(null);

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

  /** Red delete button revealed when the user swipes right-to-left. */
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={[styles.deleteAction, { backgroundColor: THEME.danger }]}
        activeOpacity={0.7}
        onPress={() => {
          hapticHeavy();
          swipeableRef.current?.close();
          onDelete(tx.id);
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather name="trash-2" size={22} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={{
          backgroundColor: THEME.surface,
          borderColor: THEME.border,
          borderWidth: 1,
        }}
        className="flex-row p-3 items-center justify-between mb-3 rounded-lg"
        activeOpacity={0.8}
        onPress={() => onEdit(tx)}
        onLongPress={() => {
          hapticHeavy();
          onDelete(tx.id);
        }}
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
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 8,
    marginBottom: 12,
    marginLeft: 8,
  },
  deleteText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});

export default TransactionRow;
