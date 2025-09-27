import React, { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useRedux";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import ModalCloseButton from "../modalCloseButton";
import { LinearGradient } from "expo-linear-gradient";
import Loader from "@/utils/loader";

function BudgetModal({
  openSheet,
  setOpenSheet,
  category,
  setCategory,
  limit,
  setLimit,
  saving,
  handleCreateBudget,
  // optional edit-mode props
  editingBudget,
  handleUpdateBudget,
  isUpdating,
  onClose,
}: {
  openSheet: boolean;
  setOpenSheet: (val: boolean) => void;
  category: string;
  setCategory: (val: string) => void;
  limit: string;
  setLimit: (val: string) => void;
  saving: boolean;
  handleCreateBudget: () => void;
  editingBudget?: any;
  handleUpdateBudget?: (id: string, updates: any) => Promise<any>;
  isUpdating?: boolean;
  onClose?: () => void;
}) {
  const { THEME } = useTheme();

  const prevOpenRef = useRef(openSheet);
  useEffect(() => {
    if (!openSheet && prevOpenRef.current) {
      // Modal closed — reset form fields
      try {
        setCategory("");
        setLimit("");
      } catch (e) {
        // ignore
      }
      if (onClose) onClose();
    }
    prevOpenRef.current = openSheet;
  }, [openSheet]);

  useEffect(() => {
    if (editingBudget) {
      setCategory(String(editingBudget.category ?? ""));
      setLimit(String(editingBudget.limit ?? ""));
    }
  }, [editingBudget]);
  return (
    <Modal
      visible={openSheet}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View
        style={{ backgroundColor: THEME.background }}
        className="flex-1 px-4 pt-8"
      >
        <ModalCloseButton setOpenSheet={setOpenSheet} />

        <View className="items-center justify-center relative mb-4">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-lg text-center font-bold"
          >
            {editingBudget ? "Update Budget" : "Create Budget"}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="mt-4">
            <Text style={{ color: THEME.textSecondary }} className="mb-2">
              Category
            </Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Groceries"
              placeholderTextColor={THEME.placeholderText}
              accessibilityLabel="Budget category"
              className="py-3 px-3 rounded-md"
              style={{
                backgroundColor: THEME.inputBackground,
                color: THEME.textPrimary,
              }}
            />
            <Text
              style={{ color: THEME.textSecondary, marginTop: 6 }}
              className="text-sm"
            >
              Tip: Pick a short category name like 'Groceries' or 'Transport'.
            </Text>
          </View>

          <View className="mt-4">
            <Text style={{ color: THEME.textSecondary }} className="mb-2">
              Limit
            </Text>
            <View
              style={{
                backgroundColor: THEME.inputBackground,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: THEME.border,
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ color: THEME.textSecondary, fontWeight: "600" }}>
                $
              </Text>
              <TextInput
                value={limit}
                onChangeText={(v) => setLimit(v.replace(/[^0-9.]/g, ""))}
                placeholder="Amount"
                placeholderTextColor={THEME.placeholderText}
                keyboardType="numeric"
                accessibilityLabel="Budget limit amount"
                style={{
                  color: THEME.textPrimary,
                  flex: 1,
                  paddingVertical: 8,
                }}
              />
            </View>
            <Text
              style={{ color: THEME.textSecondary, marginTop: 6 }}
              className="text-sm"
            >
              Tip: Enter numbers only. Tap a preset below to quickly set a
              limit.
            </Text>

            {/* Preset chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
            >
              {[25, 50, 100, 200, 500].map((n) => (
                <TouchableOpacity
                  key={n}
                  activeOpacity={0.8}
                  onPress={() => setLimit(String(n))}
                  style={{
                    backgroundColor:
                      String(limit) === String(n)
                        ? THEME.primary
                        : THEME.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: THEME.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        String(limit) === String(n)
                          ? THEME.textPrimary
                          : THEME.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    ${n}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View className="mt-6">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                if (editingBudget && handleUpdateBudget) {
                  // basic validation
                  if (!category.trim() || !limit.trim()) {
                    Alert.alert("Please enter category and limit");
                    return;
                  }
                  const parsedCategory = category.trim();
                  const parsedLimit = Number(limit);
                  if (isNaN(parsedLimit) || parsedLimit < 0) {
                    Alert.alert("Please enter a valid numeric limit");
                    return;
                  }

                  // detect no-op
                  const noChange =
                    String(parsedCategory) === String(editingBudget.category) &&
                    Number(parsedLimit) === Number(editingBudget.limit);
                  if (noChange) {
                    Alert.alert("No changes detected", "Nothing to update");
                    return;
                  }

                  try {
                    await handleUpdateBudget(editingBudget.id, {
                      category: parsedCategory,
                      limit: parsedLimit,
                    });
                    if (onClose) onClose();
                  } catch (err: any) {
                    Alert.alert("Error", err?.message || "Failed to update");
                  }
                  return;
                }
                // create path
                handleCreateBudget();
              }}
            >
              <LinearGradient
                colors={[THEME.primary, THEME.secondary]}
                start={[0, 0]}
                end={[1, 1]}
                style={{
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                  {editingBudget
                    ? isUpdating
                      ? "Updating..."
                      : "Update Budget"
                    : "Save Budget"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {saving && <Loader msg="Saving budget..." />}
      </View>
    </Modal>
  );
}

export default BudgetModal;
