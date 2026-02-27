import { useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ModalCloseButton from "../global/modalCloseButton";
import { useState, useRef } from "react";

function InformationModal({
  helpOpen,
  setHelpOpen,
}: {
  helpOpen: boolean;
  setHelpOpen: (val: boolean) => void;
}) {
  const { THEME } = useTheme();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(1);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  return (
    <Modal
      visible={helpOpen}
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
          <ModalCloseButton setOpenSheet={setHelpOpen} />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Help & Usage
          </Text>
        </View>

        <View
          style={{ marginTop: 12, flex: 1 }}
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        >
          <ScrollView
            ref={(r) => {
              scrollRef.current = r;
            }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            onContentSizeChange={(w, h) => setContentHeight(h)}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Quick Start — Add a Transaction
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Tap "New Transaction". Fill in a short name and the amount, choose
              a category or attach it to a budget, pick the correct date (the
              calendar will show the current month/year) and save. The app
              prevents future-dated transactions — the date is clamped to today
              for the current month.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Create or Edit a Budget
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Tap "New Budget" to create a budget for the selected month. To
              edit a budget, tap its card from the Budgets list — the same form
              will open pre-filled. You can change the category or limit. The
              app will prevent reducing a limit below the already spent amount.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Deleting — Important
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Swipe any transaction or budget card to the left to reveal a
              delete button — this is the quickest way to remove items. You can
              also long-press a transaction or budget card to delete it. Budgets
              that have transactions attached cannot be deleted — you'll be
              prompted to remove or reassign those transactions first. When you
              delete a transaction, the app updates the associated budget's
              spent amount automatically.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Profile Picture
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Uploading a new profile picture will automatically remove your
              previous picture from storage. If you'd like to remove your
              profile picture without uploading a new one, long-press your
              profile picture on the Profile screen and choose "Delete".
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Quick Actions & Home Overview
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Use the quick action buttons on the home screen for common tasks:
              "New Transaction" and "New Budget". The home overview shows the
              selected month's spending, top categories, and a small budget
              summary.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Search & Filter
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Both the Transactions and Budgets tabs include a search bar at the
              top. Type a keyword to instantly filter items by name or category.
              The search is case-insensitive and updates as you type.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Home Insights
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              The home screen features three analytics cards:{"\n"}• Budget
              Health Score — a quick gauge of how well you're staying within
              your budgets for the selected month.{"\n"}• Spending Trends — a
              bar chart comparing your spending over the last few months.{"\n"}•
              Category Comparison — a visual breakdown showing which categories
              consume the most of your budget.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Themes & Currency
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              Head to the Profile tab to switch between Light, Dark, Ocean, and
              Rose colour themes. You can also change your default display
              currency from the same screen — all monetary values will be shown
              in the selected currency.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Offline Cache & Performance
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              The app caches transactions and budgets per user and month for
              faster loading. Cached data is used when the network is
              unavailable and the app revalidates in the background when a
              network connection is detected. Creating or deleting items
              attempts to update the cache as well.
            </Text>

            <Text
              style={{
                color: THEME.textPrimary,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Tips & Best Practices
            </Text>
            <Text style={{ color: THEME.textSecondary, marginBottom: 12 }}>
              • Swipe left on any transaction or budget card to quickly delete
              it.
              {"\n"}• Use short category names (e.g. Groceries, Transport).
              {"\n"}• Tap a budget card to edit it (opens the same form used to
              create budgets). Long-press a budget to delete it (only possible
              when no transactions are attached).
              {"\n"}• If you change a budget limit, the app will block reducing
              the limit below the amount already spent for that period.
              {"\n"}• Use the search bar on the Transactions or Budgets tab to
              quickly find items by name or category.
              {"\n"}• Check the Budget Health Score on the home screen to see
              how your spending compares to your limits at a glance.
            </Text>
          </ScrollView>

          {/* Custom vertical scrollbar thumb */}
          {viewportHeight > 0 &&
            contentHeight > viewportHeight &&
            (() => {
              const trackHeight = viewportHeight;
              const thumbHeight = Math.max(
                (viewportHeight / contentHeight) * trackHeight,
                24,
              );
              const maxThumbTop = trackHeight - thumbHeight;
              const scrollableRange = Math.max(
                contentHeight - viewportHeight,
                1,
              );
              const thumbTop = Math.min(
                (scrollY / scrollableRange) * maxThumbTop,
                maxThumbTop,
              );
              return (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    right: -6,
                    top: 12 + thumbTop,
                    width: 4,
                    height: thumbHeight,
                    borderRadius: 2,
                    backgroundColor: THEME.border,
                    opacity: 0.95,
                  }}
                />
              );
            })()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default InformationModal;
