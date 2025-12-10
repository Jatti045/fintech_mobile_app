import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useTheme,
  useTransactions,
  useBudgets,
  useCalendar,
} from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { useAppDispatch } from "@/store";
import {
  setMonthYear,
  nextMonth,
  prevMonth,
} from "@/store/slices/calendarSlice";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { LinearGradient } from "expo-linear-gradient";
import BudgeeLogo from "@/components/budgeeLogo";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import CreateTransactionModal from "@/components/transaction/transactionModal";
import { createTransaction } from "@/store/slices/transactionSlice";
import { TransactionType } from "@/api/transaction";
import BudgetModal from "@/components/budget/BudgetModal";
import { createBudget } from "@/store/slices/budgetSlice";
import InformationModal from "@/components/home/informationModal";

// Number formatter without currency symbol (two decimals)
const formatNumber = (n: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);

// Currency formatter that uses a simple dollar symbol to avoid locale prefixed 'US'
const formatCurrency = (n: number) => `$${formatNumber(Number(n || 0))}`;

const TopCategoriesChart = ({ label, THEME, totals, budgets }: any) => {
  // totals: Record<string, number>
  const entries = Object.entries(totals).sort((a: any, b: any) => b[1] - a[1]);
  const top = entries.slice(0, 5);
  const total = entries.reduce((s: number, e: any) => s + e[1], 0) || 1;

  // Helper: find total budget limit for a given category (case-insensitive match)
  const getBudgetLimitForCategory = (category: string) => {
    if (!budgets || budgets.length === 0) return 0;
    const cat = String(category).toLowerCase();
    return budgets
      .filter((b: any) => String(b.category || "").toLowerCase() === cat)
      .reduce((s: number, b: any) => s + Number(b.limit || 0), 0);
  };

  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 12,
        padding: 12,
        alignItems: "flex-start",
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: THEME.textPrimary,
          fontWeight: "700",
          fontSize: 16,
          alignSelf: "flex-start",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      {top.length === 0 ? (
        <Text style={{ color: THEME.textSecondary }}>No categories yet</Text>
      ) : (
        <View style={{ width: "100%" }}>
          {top.map(([cat, value]: any, idx: number) => {
            const spent = Number(value || 0);
            const budgetLimit = getBudgetLimitForCategory(cat);
            // percent: if budget exists, percent of budget; otherwise percent of total spending
            const rawPct =
              budgetLimit > 0
                ? (spent / budgetLimit) * 100
                : (spent / total) * 100;
            const pct = Math.round(rawPct);
            const barPct = Math.max(0, Math.min(100, Math.round(rawPct)));
            const gradientColors =
              idx % 2 === 0
                ? [THEME.primary, THEME.secondary]
                : [THEME.secondary, THEME.primary];
            return (
              <View key={cat} style={{ marginBottom: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    {cat}
                  </Text>
                  <Text style={{ color: THEME.textSecondary }}>
                    {formatCurrency(spent)} • {pct}%
                    {budgetLimit > 0 ? "" : " of spend"}
                  </Text>
                </View>
                <View
                  style={{
                    height: 14,
                    backgroundColor: THEME.border,
                    borderRadius: 999,
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <LinearGradient
                    colors={gradientColors as any}
                    start={[0, 0]}
                    end={[1, 0]}
                    style={{ width: `${barPct}%`, height: "100%" }}
                  />
                </View>
              </View>
            );
          })}
          {entries.length > 5 && (
            <Text style={{ color: THEME.textSecondary, marginTop: 6 }}>
              +{entries.length - 5} more
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default function Index() {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();
  const [helpOpen, setHelpOpen] = useState(false);
  const [openTxModal, setOpenTxModal] = useState(false);
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txSelectedCategoryAndId, setTxSelectedCategoryAndId] = useState({
    id: "",
    name: "",
  });
  const [txDate, setTxDate] = useState(new Date());
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Compute monthly totals for selected calendar month
  const monthStartDate = new Date(calendar.year, calendar.month, 1);
  const monthEndDate = new Date(
    calendar.year,
    calendar.month + 1,
    0,
    23,
    59,
    59,
    999
  );

  const monthTx = transactions.filter((t: any) => {
    const ts = new Date(t.date).getTime();
    return ts >= monthStartDate.getTime() && ts <= monthEndDate.getTime();
  });

  const incomeTotal = monthTx
    .filter((t: any) => (t.type ?? "EXPENSE").toUpperCase() === "INCOME")
    .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  const expenseTotal = monthTx
    .filter((t: any) => (t.type ?? "EXPENSE").toUpperCase() === "EXPENSE")
    .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  const monthlyBalance = incomeTotal - expenseTotal;

  // Biggest spending category
  const categoryTotals: Record<string, number> = {};
  monthTx.forEach((t: any) => {
    const cat = String(t.category || "Uncategorized");
    if ((t.type ?? "EXPENSE").toUpperCase() === "EXPENSE") {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
    }
  });

  // Recent transactions (latest 4)
  const recent = [...transactions]
    .sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 4);

  // Filter budgets to those created in the selected month/year
  const filteredBudgets = budgets.filter((b: any) => {
    try {
      const d = new Date(b.createdAt);
      return (
        d.getMonth() === calendar.month && d.getFullYear() === calendar.year
      );
    } catch (e) {
      return false;
    }
  });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <BudgeeLogo
              size={36}
              primary={THEME.primary}
              secondary={THEME.secondary}
            />
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 20,
                fontWeight: "800",
                marginLeft: 10,
              }}
            >
              Budgee
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setHelpOpen(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: THEME.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="info" size={18} color={THEME.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Month selector */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => dispatch(prevMonth())}
            activeOpacity={0.7}
            style={{
              padding: 8,
              marginRight: 12,
              backgroundColor: THEME.surface,
              borderRadius: 8,
            }}
          >
            <Feather name="chevron-left" size={20} color={THEME.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
            {monthStartDate.toLocaleString(undefined, { month: "long" })}{" "}
            {calendar.year}
          </Text>
          <TouchableOpacity
            onPress={() => dispatch(nextMonth())}
            activeOpacity={0.7}
            style={{
              padding: 8,
              marginLeft: 12,
              backgroundColor: THEME.surface,
              borderRadius: 8,
            }}
          >
            <Feather name="chevron-right" size={20} color={THEME.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Monthly Balance */}
        <View
          style={{
            backgroundColor: THEME.surface,
            padding: 18,
            borderRadius: 16,
            marginBottom: 18,
          }}
        >
          <Text style={{ color: THEME.textSecondary, marginBottom: 8 }}>
            Spent This Month
          </Text>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 34,
              fontWeight: "900",
            }}
          >
            ${formatNumber(expenseTotal)}
          </Text>
        </View>

        {/* Quick Actions */}
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 16,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          Quick Actions
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              marginRight: 8,
              backgroundColor: THEME.surface,
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
            onPress={() => {
              // Match exact Alert behavior from AddNewTransactionButton when no budgets
              if (!filteredBudgets || filteredBudgets.length === 0) {
                showAlert({
                  title: "No budgets available",
                  message:
                    "No budgets exist for this month. Please create a budget first.",
                });
                return;
              }
              setOpenTxModal(true);
            }}
          >
            <MaterialIcons name="payment" size={22} color={THEME.primary} />
            <Text style={{ color: THEME.textPrimary, marginTop: 8 }}>
              New Transaction
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              marginLeft: 8,
              backgroundColor: THEME.surface,
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
            onPress={() => setOpenBudgetModal(true)}
          >
            <MaterialIcons
              name="account-balance-wallet"
              size={22}
              color={THEME.primary}
            />
            <Text style={{ color: THEME.textPrimary, marginTop: 8 }}>
              New Budget
            </Text>
          </TouchableOpacity>
        </View>

        {/* Budget Summary */}
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 16,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          Budget Summary
        </Text>
        <View style={{ marginBottom: 16 }}>
          {filteredBudgets.length === 0 ? (
            <Text style={{ color: THEME.textSecondary }}>
              No budgets for this month.
            </Text>
          ) : (
            filteredBudgets.slice(0, 3).map((b: any) => {
              const spent = Number(b.spent || 0);
              const limit = Number(b.limit || 0);
              const ratio =
                limit > 0 ? Math.max(0, Math.min(1, spent / limit)) : 0;
              const pct = Math.round(ratio * 100);
              return (
                <View
                  key={b.id}
                  style={{
                    backgroundColor: THEME.surface,
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{ color: THEME.textPrimary, fontWeight: "700" }}
                    >
                      {b.category}
                    </Text>
                    <Text style={{ color: THEME.textSecondary }}>
                      {formatCurrency(spent)} / {formatCurrency(limit)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: THEME.border,
                      borderRadius: 999,
                      overflow: "hidden",
                      marginTop: 8,
                    }}
                  >
                    <View style={{ width: `${pct}%`, height: "100%" }}>
                      <LinearGradient
                        colors={
                          limit > 0 && spent > limit
                            ? [THEME.danger, THEME.danger]
                            : [THEME.primary, THEME.secondary]
                        }
                        start={[0, 0]}
                        end={[1, 0]}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Top Categories Mini Chart */}
        <TopCategoriesChart
          label="Top Categories"
          THEME={THEME}
          totals={categoryTotals}
          budgets={filteredBudgets}
        />

        {/* Recent Transactions Section */}
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 16,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          Recent Transactions
        </Text>
        <View style={{ marginBottom: 16 }}>
          {recent.length === 0 ? (
            <Text style={{ color: THEME.textSecondary }}>
              No recent transactions.
            </Text>
          ) : (
            recent.map((r: any) => (
              <View
                key={r.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  padding: 12,
                  backgroundColor: THEME.surface,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <View>
                  <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                    {r.name}
                  </Text>
                  <Text style={{ color: THEME.textSecondary }}>
                    {r.category} • {new Date(r.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
                  {formatCurrency(Number(r.amount || 0))}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Tip of the Day */}
        <View
          style={{
            backgroundColor: THEME.surface,
            padding: 14,
            borderRadius: 12,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: THEME.textPrimary,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            Tip of the Day
          </Text>
          <Text style={{ color: THEME.textSecondary }}>
            Auto-assign transactions to budgets by category to keep your
            spending on track. Long-press transactions to delete.
          </Text>
        </View>

        {/* Spending Overview */}

        {/* Bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>
      {/* Create Transaction Modal */}
      <CreateTransactionModal
        openSheet={openTxModal}
        setOpenSheet={setOpenTxModal}
        name={txName}
        setName={setTxName}
        amount={txAmount}
        setAmount={setTxAmount}
        selectedCategoryAndId={txSelectedCategoryAndId}
        setSelectedCategoryAndId={setTxSelectedCategoryAndId}
        date={txDate}
        setDate={setTxDate}
        monthStartDate={monthStartDate}
        monthEndDate={monthEndDate}
        budgets={filteredBudgets}
        getCategoryIcon={(category: string, color: string) => <View />}
        capitalizeFirst={(s: string) =>
          String(s).charAt(0).toUpperCase() + String(s).slice(1)
        }
        handleCreateTransaction={async () => {
          // basic validation
          if (!txName.trim() || !txAmount.trim()) {
            showAlert({ title: "Please enter a name and amount" });
            return;
          }
          const amt = Number(txAmount);
          if (isNaN(amt) || amt <= 0) {
            showAlert({ title: "Please enter a valid numeric amount" });
            return;
          }

          // Build transaction payload
          const payload: any = {
            name: txName.trim(),
            month: calendar.month,
            year: calendar.year,
            date: txDate.toISOString(),
            category: txSelectedCategoryAndId.name || "Uncategorized",
            type: TransactionType.EXPENSE,
            amount: amt,
            icon: null,
            budgetId: txSelectedCategoryAndId.id || null,
          };

          try {
            const response: any = await dispatch(createTransaction(payload));
            const { success, message } = response.payload ?? {};
            if (success) {
              showAlert({ title: "Success", message: "Transaction created" });
              // reset fields
              setTxName("");
              setTxAmount("");
              setTxSelectedCategoryAndId({ id: "", name: "" });
              setTxDate(new Date());
              setOpenTxModal(false);
              // optionally refresh transactions for current month
              dispatch(
                fetchTransaction({
                  searchQuery: "",
                  currentMonth: calendar.month,
                  currentYear: calendar.year,
                  useCache: false,
                } as any)
              );
              return;
            }
            showAlert({
              title: "Error",
              message: message || "Failed to create transaction",
            });
          } catch (err: any) {
            showAlert({
              title: "Error",
              message: err.message || "Failed to create transaction",
            });
          }
        }}
      />
      {/* Create Budget Modal */}
      <BudgetModal
        openSheet={openBudgetModal}
        setOpenSheet={setOpenBudgetModal}
        category={budgetCategory}
        setCategory={setBudgetCategory}
        limit={budgetLimit}
        setLimit={setBudgetLimit}
        saving={budgetSaving}
        handleCreateBudget={async () => {
          if (!budgetCategory.trim() || !budgetLimit.trim()) {
            showAlert({ title: "Please enter category and limit" });
            return;
          }
          const parsedCategory = String(budgetCategory.trim());
          const parsedLimit = Number(budgetLimit);
          if (isNaN(parsedLimit) || parsedLimit <= 0) {
            showAlert({ title: "Please enter a valid numeric limit" });
            return;
          }
          const currentMonth = calendar.month;
          const currentYear = calendar.year;
          setBudgetSaving(true);
          try {
            const response: any = await dispatch(
              createBudget({
                category: parsedCategory,
                limit: parsedLimit,
                month: currentMonth,
                year: currentYear,
              } as any)
            );
            const { success, message } = response.payload ?? {};
            if (!success) {
              showAlert({
                title: "Error",
                message: message || "Failed to save",
              });
              return;
            }
            showAlert({
              title: "Success",
              message: "Budget created successfully",
            });
          } catch (err: any) {
            showAlert({
              title: "Error",
              message: err.message || "Failed to save",
            });
          } finally {
            setBudgetSaving(false);
            setOpenBudgetModal(false);
            setBudgetCategory("");
            setBudgetLimit("");
            // re-fetch budgets for current month — optional
            // dispatch(fetchBudgets({ currentMonth: currentMonth, currentYear: currentYear } as any));
          }
        }}
      />
      {/* Help Modal */}
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
