import {
  Feather,
  FontAwesome,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  createTransaction,
  fetchTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/store/slices/transactionSlice";
import { useAppDispatch } from "@/store";
import {
  useBudgets,
  useTheme,
  useTransactions,
  useTransactionStatus,
  useCalendar,
} from "@/hooks/useRedux";
import { TransactionType } from "@/api/transaction";
import Loader from "@/utils/loader";
import { formatDate, capitalizeFirst, getCategoryIcon } from "@/utils/helper";
import TransactionModal from "@/components/transaction/transactionModal";
import SearchTransaction from "@/components/transaction/searchTransaction";
import AddNewTransactionButton from "@/components/transaction/addNewTransactionButton";
import FilterTransaction from "@/components/transaction/filterTransaction";

export default function Index() {
  // transaction, budget, theme, calendar state
  const transactions = useTransactions();
  const budgets = useBudgets();
  const { THEME } = useTheme();
  const calendar = useCalendar();

  // Transaction loading/editing state
  const { isAdding, isEditing } = useTransactionStatus();

  // Local state
  const [openSheet, setOpenSheet] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(
    null
  );
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date());
  const [selectedCategoryAndId, setSelectedCategoryAndId] = useState({
    id: budgets[0]?.id || "",
    name: budgets[0]?.category || "",
  });
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string | "all">(
    "all"
  );
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const dispatch = useAppDispatch();

  const clearFilters = () => {
    setFilterCategoryId("all");
    setMinAmount("");
    setMaxAmount("");
  };

  // Precompute filtered transactions to keep JSX clean
  const filteredTransactions = transactions.filter((t) => {
    // category filter
    if (filterCategoryId !== "all") {
      if (t.budgetId) {
        if (t.budgetId !== filterCategoryId) return false;
      } else if (
        String(t.category).toLowerCase() !==
        String(
          budgets.find((b) => b.id === filterCategoryId)?.category ?? ""
        ).toLowerCase()
      ) {
        return false;
      }
    }

    // only show expenses for now
    if ((t.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") return false;

    // amount filters
    const amt = Number(t.amount ?? 0) || 0;
    if (minAmount.trim() !== "") {
      const m = Number(minAmount) || 0;
      if (amt < m) return false;
    }
    if (maxAmount.trim() !== "") {
      const M = Number(maxAmount) || 0;
      if (amt > M) return false;
    }

    // (date range filter removed)

    // searchQuery
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      if (
        !String(t.name).toLowerCase().includes(q) &&
        !String(t.category).toLowerCase().includes(q)
      )
        return false;
    }

    return true;
  });

  // Group transactions by day (date-only) for SectionList
  // Helper: friendly label for a day
  const friendlyDayLabel = (dayKey: string) => {
    const d = new Date(dayKey);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString();
  };

  const groupedSections = Object.values(
    filteredTransactions.reduce((acc: Record<string, any>, t) => {
      const dayKey = new Date(t.date).toDateString();
      if (!acc[dayKey]) acc[dayKey] = { title: dayKey, data: [] };
      acc[dayKey].data.push(t);
      return acc;
    }, {})
  );

  // Sort sections by date (newest first) and sort items within each section (newest first)
  groupedSections.sort(
    (a: any, b: any) =>
      new Date(b.title).getTime() - new Date(a.title).getTime()
  );

  // Sort items within each section
  groupedSections.forEach((s: any) =>
    s.data.sort(
      (x: any, y: any) =>
        new Date(y.date).getTime() - new Date(x.date).getTime()
    )
  );

  // Compute totals per section
  const sectionsWithTotals = groupedSections.map((s: any) => ({
    ...s,
    total: s.data.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount || 0),
      0
    ),
  }));

  // Handle creating a new transaction
  const handleCreateTransaction = async () => {
    // Validate inputs
    if (!name || !date || !selectedCategoryAndId || amount === "") {
      Alert.alert("Please fill all fields");
      return;
    }

    const currentMonth = calendar.month;
    const currentYear = calendar.year;

    const newTransaction = {
      name,
      month: currentMonth,
      year: currentYear,
      category: selectedCategoryAndId.name,
      budgetId: selectedCategoryAndId.id,
      amount: parseFloat(amount),
      date: date.toISOString(),
      type: TransactionType.EXPENSE,
    };

    // Dispatch create transaction action here
    const response = await dispatch(createTransaction(newTransaction));

    const { success, message } = response.payload as {
      success: boolean;
      message: string;
    };

    if (success) {
      setOpenSheet(false);

      // Reset form
      setName("");
      setDate(new Date());
      setSelectedCategoryAndId({
        id: budgets[0]?.id || "",
        name: budgets[0]?.category || "",
      });
      setAmount("");
      setEditingTransaction(null);

      // Show success message
      Alert.alert("Transaction added successfully!");
    } else {
      Alert.alert("Error", message || "Failed to add transaction");
    }
  };

  // Handle updating an existing transaction
  const handleUpdateTransaction = async (id: string, updates: any) => {
    const noChange =
      editingTransaction.name === name &&
      Number(editingTransaction.amount) === Number(amount) &&
      (editingTransaction.budgetId || "") ===
        (selectedCategoryAndId.id || "") &&
      new Date(editingTransaction.date).toISOString() ===
        new Date(date).toISOString();

    if (noChange) {
      Alert.alert(
        "No changes detected",
        "No changes were made to the transaction."
      );
      return;
    }

    const txUpdates: any = {};
    if (editingTransaction.name !== name) txUpdates.name = name;
    if (Number(editingTransaction.amount) !== Number(amount))
      txUpdates.amount = Number(amount);
    if (
      (editingTransaction.budgetId || "") !== (selectedCategoryAndId.id || "")
    )
      txUpdates.budgetId = selectedCategoryAndId.id || null;
    if (
      new Date(editingTransaction.date).toISOString() !==
      new Date(date).toISOString()
    )
      txUpdates.date = date.toISOString();

    console.log("txUpdates before dispatch: ", txUpdates);

    try {
      const response = await dispatch(
        updateTransaction({ id: editingTransaction.id, updates: txUpdates })
      );
      console.log("Transaction update response: ", response);

      const { success, message } = response.payload as {
        success: boolean;
        message: string;
      };

      if (success) {
        Alert.alert("Updated", "Transaction updated successfully");
        setOpenSheet(false);
      } else {
        Alert.alert("Error", message || "Failed to update transaction");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update transaction");
    }
  };

  // Reset form when modal closes
  const resetForm = () => {
    setName("");
    setDate(new Date());
    setSelectedCategoryAndId({
      id: budgets[0]?.id || "",
      name: budgets[0]?.category || "",
    });
    setAmount("");
    setEditingTransaction(null);
  };

  const monthStartDate = new Date(calendar.year, calendar.month, 1);
  // Current day of the selected month
  const monthLastMoment = new Date(
    calendar.year,
    calendar.month + 1,
    0,
    23,
    59,
    59,
    999
  );
  // End of today (local) — prevents selecting future dates
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  // Use the earlier of month end and today end so user can't pick future days
  const monthEndDate = todayEnd < monthLastMoment ? todayEnd : monthLastMoment;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ backgroundColor: THEME.background, flex: 1 }}
      className="px-4"
    >
      <View className="items-center justify-center my-4 mb-6">
        <Text
          style={{ color: THEME.textPrimary }}
          className="text-2xl font-bold"
        >
          Transactions
        </Text>
      </View>
      <SearchTransaction
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      {/* Transaction filters */}
      <FilterTransaction
        budgets={budgets}
        filterCategoryId={filterCategoryId}
        setFilterCategoryId={setFilterCategoryId}
        minAmount={minAmount}
        setMinAmount={setMinAmount}
        maxAmount={maxAmount}
        setMaxAmount={setMaxAmount}
        clearFilters={clearFilters}
      />
      {sectionsWithTotals.length === 0 ? (
        <View className="py-12 items-center">
          <Text style={{ color: THEME.textSecondary }}>
            No transactions match filters.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sectionsWithTotals}
          keyExtractor={(item, index) => item.id ?? index.toString()}
          renderSectionHeader={({ section: { title, total } }: any) => (
            <View
              style={{
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ color: THEME.textSecondary, flex: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {friendlyDayLabel(title)}
              </Text>
              <Text
                style={{ color: THEME.textPrimary, marginLeft: 8 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                ${Number(total).toFixed(2)}
              </Text>
            </View>
          )}
          renderItem={({ item: tx, index }) => (
            <TouchableOpacity
              key={tx.id ?? index}
              style={{
                backgroundColor: THEME.surface,
                borderColor: THEME.border,
                borderWidth: 1,
              }}
              className="flex-row p-3 items-center justify-between mb-3 rounded-lg"
              activeOpacity={0.8}
              onPress={() => {
                // Open modal in edit mode
                setEditingTransaction(tx);
                setOpenSheet(true);
              }}
              onLongPress={() => {
                Alert.alert(
                  "Delete Transaction",
                  "Are you sure you want to delete this transaction?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const response = await dispatch(
                            deleteTransaction(tx.id ?? "")
                          );
                          const payload: any = response?.payload ?? null;
                          const success: boolean = payload?.success ?? false;
                          const message: string = payload?.message ?? "";
                          if (success) {
                            Alert.alert(
                              "Deleted",
                              "Transaction deleted successfully."
                            );
                          } else {
                            Alert.alert(
                              "Error",
                              message || "Failed to delete transaction"
                            );
                          }
                        } catch (err: any) {
                          Alert.alert(
                            "Error",
                            err.message || "Failed to delete transaction"
                          );
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
              >
                <View
                  style={{
                    backgroundColor: THEME.border,
                    padding: 12,
                    borderRadius: 999,
                  }}
                  className="rounded-full"
                >
                  {getCategoryIcon(tx.category)}
                </View>
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
                  - ${Number(tx.amount).toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sheet Modal to add new transaction */}
      <TransactionModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        name={name}
        setName={setName}
        amount={amount}
        setAmount={setAmount}
        selectedCategoryAndId={selectedCategoryAndId}
        setSelectedCategoryAndId={setSelectedCategoryAndId}
        date={date}
        setDate={setDate}
        monthStartDate={monthStartDate}
        monthEndDate={monthEndDate}
        budgets={budgets}
        handleCreateTransaction={handleCreateTransaction}
        getCategoryIcon={getCategoryIcon}
        capitalizeFirst={capitalizeFirst}
        editingTransaction={editingTransaction}
        handleUpdateTransaction={handleUpdateTransaction}
        isSaving={isEditing}
        onClose={resetForm}
      />

      {/* Add new transaction button */}
      <AddNewTransactionButton setOpenSheet={setOpenSheet} budgets={budgets} />

      {/* Loader */}
      {isAdding && <Loader msg="Adding transaction..." />}
    </SafeAreaView>
  );
}
