import React, { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useRedux";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ModalCloseButton from "../global/modalCloseButton";
import { LinearGradient } from "expo-linear-gradient";
import Loader from "@/utils/loader";
import { SafeAreaView } from "react-native-safe-area-context";
import IconSelectorModal from "./IconSelectorModal";

function BudgetModal({
  openSheet,
  setOpenSheet,
  editingBudget,
  onClose,
}: {
  openSheet: boolean;
  setOpenSheet: (val: boolean) => void;
  editingBudget?: any;
  onClose?: () => void;
}) {
  const { THEME } = useTheme();

  const {
    budgetCategory: category,
    setBudgetCategory: setCategory,
    budgetIcon: icon,
    setBudgetIcon: setIcon,
    budgetLimit: limit,
    setBudgetLimit: setLimit,
    budgetSaving: saving,
    handleCreateBudget,
    handleUpdateBudget,
  } = useBudgetOperations();

  const [openIconSelector, setOpenIconSelector] = React.useState(false);

  const prevOpenRef = useRef(openSheet);
  useEffect(() => {
    if (!openSheet && prevOpenRef.current) {
      // Modal closed — reset form fields
      try {
        setCategory("");
        setIcon("");
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
      setIcon(String(editingBudget.icon ?? ""));
    }
  }, [editingBudget]);
  return (
    <Modal
      visible={openSheet}
      animationType="slide"
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
        <View className="relative mb-4">
          <ModalCloseButton setOpenSheet={setOpenSheet} />
        </View>

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
              Category Name
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

          {/* Icon Selector Modal */}
          <View className="mt-4">
            <Text style={{ color: THEME.textSecondary }} className="mb-2">
              Category Icon
            </Text>

            <TouchableOpacity
              onPress={() => setOpenIconSelector(true)}
              className="py-3 px-3 rounded-md"
              style={{ backgroundColor: THEME.inputBackground }}
            >
              <Text
                style={{
                  color: icon === "" ? THEME.textSecondary : THEME.textPrimary,
                }}
              >
                {icon === "" ? "Choose an icon" : icon}
              </Text>
            </TouchableOpacity>

            <Text
              style={{ color: THEME.textSecondary, marginTop: 6 }}
              className="text-sm"
            >
              Tip: Pick an icon that helps you recognize this category at a
              glance.
            </Text>
          </View>

          {openIconSelector && (
            <IconSelectorModal
              openIconSelector={openIconSelector}
              setOpenIconSelector={setOpenIconSelector}
              editingBudget={editingBudget}
              setIcon={setIcon}
            />
          )}

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
              onPress={() => {
                if (editingBudget) {
                  handleUpdateBudget(editingBudget, setOpenSheet);
                } else {
                  handleCreateBudget(setOpenSheet);
                }
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
                    ? saving
                      ? "Updating..."
                      : "Update Budget"
                    : "Save Budget"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {saving && <Loader msg="Saving budget..." />}
      </SafeAreaView>
    </Modal>
  );
}

export default BudgetModal;
