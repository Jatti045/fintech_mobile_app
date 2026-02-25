import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JSX } from "react/jsx-runtime";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState, useEffect, useRef } from "react";
import ModalCloseButton from "../modalCloseButton";
import { IBudget } from "@/store/slices/budgetSlice";
import { capitalizeFirst } from "@/utils/helper";
import { useTransactionOperations } from "@/hooks/transaction/useTransactionOperation";

function TransactionModal({
  openSheet,
  setOpenSheet,
  budgets,
  editingTransaction,
  onClose,
}: {
  openSheet: boolean;
  setOpenSheet: (val: boolean) => void;
  editingTransaction?: any;
  budgets: IBudget[];
  onClose?: () => void;
}) {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const [showPicker, setShowPicker] = useState(false);

  const {
    txName,
    setTxName,
    txAmount,
    setTxAmount,
    txDate,
    setTxDate,
    txSelectedCategoryAndId,
    setTxSelectedCategoryAndId,
    monthStartDate,
    monthEndDate,
    handleCreateTransaction,
    handleUpdateTransaction,
  } = useTransactionOperations();

  // Track openSheet transitions so we can clear form on close
  const prevOpenRef = useRef(openSheet);
  useEffect(() => {
    if (!openSheet && prevOpenRef.current) {
      // Modal transitioned from open -> closed: clear form fields
      try {
        setTxName("");
        setTxAmount("");
        setTxSelectedCategoryAndId({ id: "", name: "" });
        setTxDate(new Date());
      } catch (e) {
        // ignore
      }
      if (onClose) onClose();
    }
    prevOpenRef.current = openSheet;
  }, [openSheet]);

  // Populate fields when editingTransaction is provided
  useEffect(() => {
    if (editingTransaction) {
      try {
        setTxName(editingTransaction.name || "");
        setTxAmount(String(editingTransaction.amount ?? ""));
        setTxDate(
          editingTransaction.date
            ? new Date(editingTransaction.date)
            : new Date(),
        );
        setTxSelectedCategoryAndId({
          id: editingTransaction.budgetId || "",
          name: editingTransaction.category || "",
        });
      } catch (e) {
        // ignore
      }
    }
  }, [editingTransaction]);

  const clampDate = (d: Date) => {
    if (d < monthStartDate) return new Date(monthStartDate);
    if (d > monthEndDate) return new Date(monthEndDate);
    return d;
  };

  const formatShortDate = (d: Date) => {
    try {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return d.toDateString();
    }
  };

  return (
    <Modal
      visible={openSheet}
      animationType="slide"
      transparent={true}
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
        {/* Close button */}
        <View className="relative">
          <ModalCloseButton setOpenSheet={setOpenSheet} />
        </View>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <Text
              className="text-center text-xl font-bold py-8"
              style={{ color: THEME.textPrimary }}
            >
              {editingTransaction ? "Edit Transaction" : "Add New Transaction"}
            </Text>
            <View className="flex-1 gap-6">
              {/* Name Input (simplified + example) */}
              <View>
                <Text style={{ color: THEME.textPrimary }} className="mb-2">
                  Name
                </Text>
                <TextInput
                  placeholder="e.g., Coffee at Joe's, Grocery shopping"
                  value={txName}
                  onChangeText={setTxName}
                  placeholderTextColor={THEME.placeholderText}
                  accessibilityLabel="Transaction name"
                  className="py-3"
                  style={{
                    backgroundColor: THEME.inputBackground,
                    borderColor: THEME.border,
                    color: THEME.textPrimary,
                    borderRadius: 8,
                    borderWidth: 1,
                    padding: 12,
                  }}
                />
                <Text
                  style={{ color: THEME.textSecondary, marginTop: 6 }}
                  className="text-sm"
                >
                  Tip: Use a short descriptive name — store, merchant or note.
                </Text>
              </View>
              {/* Amount Input (simplified + example) */}
              <View>
                <Text style={{ color: THEME.textPrimary }} className="mb-2">
                  Amount
                </Text>
                <TextInput
                  placeholder="e.g., 4.50 or 120.00"
                  value={txAmount}
                  onChangeText={setTxAmount}
                  keyboardType="numeric"
                  placeholderTextColor={THEME.placeholderText}
                  accessibilityLabel="Transaction amount"
                  className="py-3"
                  style={{
                    backgroundColor: THEME.inputBackground,
                    borderColor: THEME.border,
                    color: THEME.textPrimary,
                    borderRadius: 8,
                    borderWidth: 1,
                    padding: 12,
                  }}
                />
                <Text
                  style={{ color: THEME.textSecondary, marginTop: 6 }}
                  className="text-sm"
                >
                  Tip: Enter the numeric amount without currency symbol. Use a
                  dot for decimals.
                </Text>
              </View>
              {/* Category Selector */}
              <View>
                <Text style={{ color: THEME.textPrimary }} className="mb-4">
                  Category
                </Text>
                {budgets.map((budget) => (
                  <TouchableOpacity
                    key={budget.id}
                    activeOpacity={1}
                    style={{
                      backgroundColor: THEME.inputBackground,
                      borderColor: THEME.border,
                    }}
                    onPress={() =>
                      setTxSelectedCategoryAndId({
                        id: budget.id,
                        name: budget.category,
                      })
                    }
                    className={`py-3 px-4 mb-2 flex-row items-center gap-4 rounded-lg border ${
                      txSelectedCategoryAndId.id === budget.id
                        ? "border-4 py-4"
                        : "border-1"
                    }`}
                  >
                    <Feather
                      name={budget.icon as keyof typeof Feather.glyphMap}
                      size={24}
                      color={THEME.secondary}
                    />
                    <Text style={{ color: THEME.textPrimary }}>
                      {capitalizeFirst(budget.category)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Date Picker (compact) */}
              <View className="mx-auto w-full">
                <Text className="mb-2" style={{ color: THEME.textPrimary }}>
                  Date
                </Text>
                <ScrollView
                  horizontal
                  contentContainerStyle={{
                    alignItems: "center",
                    paddingHorizontal: 4,
                    gap: 8,
                  }}
                  showsHorizontalScrollIndicator={false}
                >
                  <View
                    style={{
                      backgroundColor: THEME.inputBackground,
                      borderColor: THEME.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      padding: 8,
                      minWidth: 220,
                    }}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        accessibilityLabel="Previous day"
                        onPress={() => {
                          const prev = new Date(txDate);
                          prev.setDate(prev.getDate() - 1);
                          setTxDate(clampDate(prev));
                        }}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={20}
                          color={THEME.textPrimary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Open date picker"
                        onPress={() => setShowPicker((s) => !s)}
                        className="py-2 px-3"
                      >
                        <Text style={{ color: THEME.textPrimary }}>
                          {formatShortDate(txDate)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        accessibilityLabel="Next day"
                        activeOpacity={0.7}
                        onPress={() => {
                          const next = new Date(txDate);
                          next.setDate(next.getDate() + 1);
                          setTxDate(clampDate(next));
                        }}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={THEME.textPrimary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={{
                      justifyContent: "center",
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text
                      style={{ color: THEME.textSecondary }}
                      className="text-sm"
                    >
                      {formatShortDate(monthStartDate)} —{" "}
                      {formatShortDate(monthEndDate)}
                    </Text>
                  </View>
                </ScrollView>

                {showPicker && (
                  <DateTimePicker
                    minimumDate={monthStartDate}
                    maximumDate={monthEndDate}
                    value={txDate}
                    mode="date"
                    textColor={THEME.textPrimary}
                    display={Platform.OS === "ios" ? "spinner" : "calendar"}
                    onChange={(event: any, selectedDate?: Date | undefined) => {
                      // On Android the event.type can be 'dismissed' — only set when a date provided
                      if (selectedDate) {
                        setTxDate(clampDate(selectedDate));
                      }
                      // Close the picker on Android after selection
                      if (Platform.OS !== "ios") setShowPicker(false);
                    }}
                  />
                )}
                <Text
                  style={{ color: THEME.textSecondary, marginTop: 6 }}
                  className="text-sm"
                >
                  Tip: Tap the date to open the picker. Use the arrows for quick
                  day changes.
                </Text>
              </View>

              <View className="mb-12">
                <TouchableOpacity
                  onPress={async () => {
                    // Basic front-end validation
                    if (
                      !txName ||
                      txAmount === "" ||
                      !txSelectedCategoryAndId?.name
                    ) {
                      showAlert({ title: "Please fill all fields" });
                      return;
                    }

                    // If editing, call update handler, otherwise create
                    if (editingTransaction) {
                      handleUpdateTransaction(editingTransaction, setOpenSheet);
                    } else {
                      handleCreateTransaction(setOpenSheet);
                    }
                  }}
                >
                  <LinearGradient
                    colors={[THEME.primary, THEME.secondary]}
                    style={{ borderRadius: 8 }}
                  >
                    <Text
                      style={{ color: THEME.textPrimary }}
                      className="font-bold text-center py-4"
                    >
                      {editingTransaction
                        ? "Update Transaction"
                        : "Save Transaction"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default TransactionModal;
