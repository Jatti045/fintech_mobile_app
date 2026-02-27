import React from "react";
import { View, Text, TouchableOpacity, FlatList, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CURRENCIES, DEFAULT_CURRENCY } from "@/constants/Currencies";
import type { CurrencyPickerModalProps } from "@/types/profile/types";

/**
 * Bottom-sheet style modal for selecting the default currency.
 */
export default function CurrencyPickerModal({
  THEME,
  visible,
  userCurrency,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: THEME.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "70%",
            paddingBottom: 30,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: THEME.border,
            }}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Select Default Currency
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={THEME.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={CURRENCIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected =
                item.code === (userCurrency || DEFAULT_CURRENCY);
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.code)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    paddingHorizontal: 20,
                    backgroundColor: isSelected
                      ? THEME.primary + "20"
                      : "transparent",
                    borderBottomWidth: 0.5,
                    borderBottomColor: THEME.border,
                  }}
                >
                  <Text style={{ fontSize: 22, marginRight: 12 }}>
                    {item.flag}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontWeight: isSelected ? "700" : "500",
                        fontSize: 15,
                      }}
                    >
                      {item.code}{" "}
                      <Text
                        style={{
                          color: THEME.textSecondary,
                          fontWeight: "400",
                        }}
                      >
                        — {item.name}
                      </Text>
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: THEME.textSecondary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {item.symbol}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={THEME.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
