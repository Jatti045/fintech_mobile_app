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
import ModalCloseButton from "../modalCloseButton";
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
        style={{ flex: 1, backgroundColor: THEME.background, padding: 18 }}
      >
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
        <ModalCloseButton setOpenSheet={setHelpOpen} />

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
              Long-press a transaction to delete it. Long-press a budget card to
              delete the budget. Budgets that have transactions attached cannot
              be deleted — you'll be prompted to remove or reassign those
              transactions first. When you delete a transaction, the app updates
              the associated budget's spent amount automatically.
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
              • Use short category names (e.g. Groceries, Transport).
              {"\n"}• Tap a budget card to edit it (opens the same form used to
              create budgets). Long-press a budget to delete it (only possible
              when no transactions are attached).
              {"\n"}• If you change a budget limit, the app will block reducing
              the limit below the amount already spent for that period.
              {"\n"}• Transactions are cached per-user-per-month for faster load
              times. The app attempts to keep the cache up-to-date when you add
              or delete items.
            </Text>
          </ScrollView>

          {/* Custom vertical scrollbar thumb */}
          {viewportHeight > 0 &&
            contentHeight > viewportHeight &&
            (() => {
              const trackHeight = viewportHeight;
              const thumbHeight = Math.max(
                (viewportHeight / contentHeight) * trackHeight,
                24
              );
              const maxThumbTop = trackHeight - thumbHeight;
              const scrollableRange = Math.max(
                contentHeight - viewportHeight,
                1
              );
              const thumbTop = Math.min(
                (scrollY / scrollableRange) * maxThumbTop,
                maxThumbTop
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
