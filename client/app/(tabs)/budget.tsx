import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Touchable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useAppDispatch,
  useBudgets,
  useTheme,
  useTransactions,
  useCalendar,
} from "@/hooks/useRedux";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "@/store/slices/budgetSlice";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { capitalizeFirst, formatDate, getCategoryIcon } from "@/utils/helper";
import MaskedView from "@react-native-masked-view/masked-view";
import BudgetModal from "@/components/budget/BudgetModal";

export default function Goals() {
  const dispatch = useAppDispatch();
  const budgets = useBudgets();
  const transactions = useTransactions();
  const { THEME } = useTheme();
  const calendar = useCalendar();

  const [openSheet, setOpenSheet] = React.useState(false);
  const [category, setCategory] = React.useState("");
  const [limit, setLimit] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editingBudget, setEditingBudget] = React.useState<any | null>(null);

  const handleCreateBudget = async () => {
    // validation
    if (!category.trim() || !limit.trim()) {
      Alert.alert("Please enter category and limit");
      return;
    }

    const parsedCategory = capitalizeFirst(category.trim());

    const parsedLimit = Number(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      Alert.alert("Please enter a valid numeric limit");
      return;
    }
    const currentMonth = calendar.month;
    const currentYear = calendar.year;
    setSaving(true);
    try {
      const response = await dispatch(
        createBudget({
          category: parsedCategory,
          limit: parsedLimit,
          month: currentMonth,
          year: currentYear,
        })
      );

      const { success, message } = response.payload as {
        success: boolean;
        message: string;
      };

      if (!success) {
        Alert.alert("Error", message || "Failed to save");
        return;
      }
      Alert.alert("Success", "Budget created successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    } finally {
      setSaving(false);
      setOpenSheet(false);
      setCategory("");
      setLimit("");
    }
  };

  const resetForm = () => {
    setCategory("");
    setLimit("");
    setEditingBudget(null);
  };

  const handleUpdateBudget = async (id: string, updates: any) => {
    setSaving(true);
    try {
      const response = await dispatch(updateBudget({ id, updates }));
      const { success, message } = response.payload as {
        success: boolean;
        message: string;
      };
      if (!success) {
        Alert.alert("Error", message || "Failed to update budget");
        return;
      }
      Alert.alert("Success", "Budget updated successfully");
      setOpenSheet(false);
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update budget");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = (budgetId: string) => {
    // Client-side pre-check using local transactions cache
    try {
      const attached = transactions.filter((t: any) => t.budgetId === budgetId);
      const attachedCount = attached.length;
      if (attachedCount > 0) {
        Alert.alert(
          "Cannot delete budget",
          `This budget has ${attachedCount} transaction${attachedCount > 1 ? "s" : ""} attached. Remove or reassign those transactions first.`
        );
        return;
      }

      // proceed with confirmation if no attached transactions
      Alert.alert(
        "Delete Budget",
        "Are you sure you want to delete this budget?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const response = await dispatch(deleteBudget(budgetId));
                const { success, message } = response.payload as {
                  success: boolean;
                  message: string;
                };
                if (success) {
                  Alert.alert("Success", "Budget deleted successfully");
                  return;
                }
                Alert.alert("Error", message || "Failed to delete budget");
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to delete budget");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      // fallback to previous delete flow in case of an unexpected error
      Alert.alert(
        "Delete Budget",
        "Are you sure you want to delete this budget?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const response = await dispatch(deleteBudget(budgetId));
                const { success, message } = response.payload as {
                  success: boolean;
                  message: string;
                };
                if (success) {
                  Alert.alert("Success", "Budget deleted successfully");
                  return;
                }
                Alert.alert("Error", message || "Failed to delete budget");
              } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to delete budget");
              }
            },
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      <ScrollView>
        <View className="flex-1 px-4" style={{ paddingTop: 18 }}>
          {/* Header */}
          <View style={{ marginBottom: 12 }}>
            <Text
              className="text-2xl text-center font-bold mb-2"
              style={{ color: THEME.textPrimary }}
            >
              Budgets
            </Text>
          </View>
          {budgets && budgets.length > 0 ? (
            budgets.map((budget) => {
              const limit = Number(budget.limit) || 0;
              const spent = Number(budget.spent) || 0;
              const rawRatio = limit > 0 ? spent / limit : 0;
              const ratio = Math.max(0, Math.min(1, rawRatio));
              const percent = Math.round(ratio * 100);
              const overspent = spent > limit && limit > 0;

              return (
                <TouchableOpacity
                  key={budget.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    setEditingBudget(budget);
                    setCategory(String(budget.category ?? ""));
                    setLimit(String(budget.limit ?? ""));
                    setOpenSheet(true);
                  }}
                  onLongPress={() => handleDeleteBudget(budget.id)}
                >
                  <View
                    style={{
                      backgroundColor: THEME.surface,
                      borderColor: THEME.border,
                      borderWidth: 1,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.06,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                    className="p-4 mb-4 rounded-2xl"
                  >
                    <View className="flex-row justify-between items-start">
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: THEME.textSecondary }}
                          className="text-sm"
                        >
                          {capitalizeFirst(budget.category)}
                        </Text>
                        <Text
                          style={{ color: THEME.textPrimary }}
                          className="text-2xl font-extrabold mt-1"
                        >
                          ${limit.toFixed(2)}
                        </Text>
                        <View className="flex-row items-center mt-2">
                          <Text
                            style={{
                              color: overspent
                                ? THEME.danger
                                : THEME.textSecondary,
                            }}
                            className="text-sm"
                          >
                            Spent ${spent.toFixed(2)}
                          </Text>
                          {overspent && (
                            <View
                              className="ml-3 px-2 py-1 rounded-full"
                              style={{ backgroundColor: THEME.danger }}
                            >
                              <Text
                                style={{ color: THEME.textPrimary }}
                                className="text-xs font-bold"
                              >
                                Over
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View className="items-center ml-4">
                        {getCategoryIcon(
                          budget.category,
                          overspent ? THEME.danger : THEME.secondary,
                          64
                        )}
                        <View
                          className="mt-2 px-2 py-1 rounded-md"
                          style={{
                            backgroundColor: overspent
                              ? "#FFF6F6"
                              : THEME.background,
                          }}
                        >
                          <Text
                            style={{
                              color: overspent
                                ? THEME.danger
                                : THEME.textSecondary,
                            }}
                            className="font-bold"
                          >
                            {percent}%
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <View
                      className="mt-4 rounded-full overflow-hidden"
                      style={{ backgroundColor: THEME.border, height: 12 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          width: "100%",
                          height: 12,
                        }}
                      >
                        <LinearGradient
                          colors={
                            overspent
                              ? [THEME.danger, THEME.danger]
                              : [THEME.primary, THEME.secondary]
                          }
                          start={[0, 0]}
                          end={[1, 0]}
                          style={{ flex: ratio }}
                        />
                        <View style={{ flex: 1 - ratio }} />
                      </View>
                    </View>

                    {/* Warning text when overspent */}
                    {overspent && (
                      <View className="mt-3 flex-row items-center">
                        <Feather
                          name="alert-circle"
                          size={18}
                          color={THEME.danger}
                        />
                        <Text className="ml-2" style={{ color: THEME.danger }}>
                          You have exceeded this budget by $
                          {Math.abs(limit - spent).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View className="flex-1 justify-center items-center px-6 pt-12">
              <MaskedView
                maskElement={
                  <Text
                    className="text-3xl font-extrabold text-center"
                    style={{ color: THEME.textPrimary }}
                  >
                    No budgets for this month
                  </Text>
                }
              >
                <LinearGradient
                  colors={[THEME.primary, THEME.secondary]}
                  start={[0, 0]}
                  end={[1, 1]}
                >
                  {/* Text is invisible but used to size the mask */}
                  <Text
                    className="text-3xl font-extrabold text-center"
                    style={{ opacity: 0 }}
                  >
                    No budgets for this month
                  </Text>
                </LinearGradient>
              </MaskedView>

              <Text
                className="text-center mt-4 text-base"
                style={{ color: THEME.textSecondary }}
              >
                Create budgets to track spending by category for the selected
                month. Tap "New Budget" to get started.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      {/* Add new activity button */}
      <View className="absolute bottom-0 right-0 p-4">
        <TouchableOpacity onPress={() => setOpenSheet(true)}>
          <LinearGradient
            colors={[THEME.primary, THEME.secondary]}
            start={[0, 0]}
            end={[1, 1]}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              alignItems: "center",
              justifyContent: "center",

              borderRadius: 1000,
              shadowColor: THEME.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 16,
              elevation: 16, // For Android
            }}
          >
            <View className="items-center justify-center flex-row gap-1">
              <Feather name="plus" size={24} color={THEME.textPrimary} />
              <Text
                style={{ color: THEME.textPrimary }}
                className="font-bold text-base"
              >
                New Budget
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Create Budget Sheet */}
      <BudgetModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        category={category}
        setCategory={setCategory}
        limit={limit}
        setLimit={setLimit}
        saving={saving}
        handleCreateBudget={handleCreateBudget}
        // edit-mode props
        editingBudget={editingBudget}
        handleUpdateBudget={handleUpdateBudget}
        isUpdating={saving}
        onClose={() => {
          setOpenSheet(false);
          resetForm();
        }}
      />

      {/* Budget transactions modal removed: budgets no longer open a modal on tap */}
    </SafeAreaView>
  );
}
