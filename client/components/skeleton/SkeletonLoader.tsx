/**
 * @module SkeletonLoader
 * @description Reusable skeleton loader components for showing placeholder content
 *   while data is being fetched. Uses animated shimmer effect for better UX.
 *
 * Components:
 * - `SkeletonBox`: Basic animated box with configurable dimensions
 * - `HomeSkeleton`: Full home screen skeleton layout
 * - `TransactionSkeleton`: Transaction list skeleton with section headers
 * - `BudgetSkeleton`: Budget cards skeleton layout
 */

import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";

// ─── Base Skeleton Box ──────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
  baseColor: string;
  highlightColor: string;
}

/**
 * Animated skeleton box with shimmer effect.
 * Uses a looping opacity animation to create a pulsing/shimmer appearance.
 */
export const SkeletonBox = React.memo(function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
  baseColor,
  highlightColor,
}: SkeletonBoxProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
        style,
      ]}
    />
  );
});

// ─── Home Screen Skeleton ───────────────────────────────────────────────────

interface HomeSkeletonProps {
  THEME: {
    background: string;
    surface: string;
    border: string;
    textSecondary: string;
  };
}

/**
 * Full skeleton layout for the Home screen.
 * Shows placeholders for: header, month selector, spent card, quick actions,
 * budget summary, chart, and recent transactions.
 */
export const HomeSkeleton = React.memo(function HomeSkeleton({
  THEME,
}: HomeSkeletonProps) {
  const baseColor = THEME.border;
  const highlightColor = THEME.surface;

  return (
    <View style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Header skeleton */}
      <View style={styles.headerRow}>
        <SkeletonBox
          width={120}
          height={32}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
        <SkeletonBox
          width={32}
          height={32}
          borderRadius={16}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Month selector skeleton */}
      <View style={styles.monthSelector}>
        <SkeletonBox
          width={32}
          height={32}
          borderRadius={16}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
        <SkeletonBox
          width={150}
          height={24}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
        <SkeletonBox
          width={32}
          height={32}
          borderRadius={16}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Spent this month card skeleton */}
      <View
        style={[
          styles.spentCard,
          { backgroundColor: THEME.surface, borderColor: THEME.border },
        ]}
      >
        <SkeletonBox
          width={120}
          height={16}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
        <SkeletonBox
          width={180}
          height={48}
          baseColor={baseColor}
          highlightColor={highlightColor}
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Quick actions skeleton */}
      <View style={styles.quickActions}>
        <SkeletonBox
          width="48%"
          height={56}
          borderRadius={12}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
        <SkeletonBox
          width="48%"
          height={56}
          borderRadius={12}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Budget summary skeleton */}
      <View style={{ marginTop: 16 }}>
        <SkeletonBox
          width={140}
          height={20}
          baseColor={baseColor}
          highlightColor={highlightColor}
          style={{ marginBottom: 12 }}
        />
        {[1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.budgetItem,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
            ]}
          >
            <View style={styles.budgetItemContent}>
              <SkeletonBox
                width={100}
                height={16}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
              <SkeletonBox
                width={60}
                height={14}
                baseColor={baseColor}
                highlightColor={highlightColor}
                style={{ marginTop: 8 }}
              />
            </View>
            <SkeletonBox
              width={80}
              height={20}
              baseColor={baseColor}
              highlightColor={highlightColor}
            />
          </View>
        ))}
      </View>

      {/* Chart skeleton */}
      <View style={{ marginTop: 16 }}>
        <SkeletonBox
          width={140}
          height={20}
          baseColor={baseColor}
          highlightColor={highlightColor}
          style={{ marginBottom: 12 }}
        />
        <SkeletonBox
          width="100%"
          height={200}
          borderRadius={16}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Recent transactions skeleton */}
      <View style={{ marginTop: 16 }}>
        <SkeletonBox
          width={160}
          height={20}
          baseColor={baseColor}
          highlightColor={highlightColor}
          style={{ marginBottom: 12 }}
        />
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.transactionItem,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
            ]}
          >
            <SkeletonBox
              width={44}
              height={44}
              borderRadius={22}
              baseColor={baseColor}
              highlightColor={highlightColor}
            />
            <View style={styles.transactionContent}>
              <SkeletonBox
                width={100}
                height={16}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
              <SkeletonBox
                width={140}
                height={12}
                baseColor={baseColor}
                highlightColor={highlightColor}
                style={{ marginTop: 6 }}
              />
            </View>
            <SkeletonBox
              width={60}
              height={18}
              baseColor={baseColor}
              highlightColor={highlightColor}
            />
          </View>
        ))}
      </View>
    </View>
  );
});

// ─── Transaction Screen Skeleton ────────────────────────────────────────────

interface TransactionSkeletonProps {
  THEME: {
    background: string;
    surface: string;
    border: string;
  };
}

/**
 * Full skeleton layout for the Transaction screen.
 * Shows placeholders for: search bar, filters, and transaction sections.
 */
export const TransactionSkeleton = React.memo(function TransactionSkeleton({
  THEME,
}: TransactionSkeletonProps) {
  const baseColor = THEME.border;
  const highlightColor = THEME.surface;

  return (
    <View style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Title */}
      <View style={styles.centeredTitle}>
        <SkeletonBox
          width={140}
          height={28}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Search bar skeleton */}
      <SkeletonBox
        width="100%"
        height={48}
        borderRadius={24}
        baseColor={baseColor}
        highlightColor={highlightColor}
        style={{ marginBottom: 16 }}
      />

      {/* Filter chips skeleton */}
      <View style={styles.filterChips}>
        {[80, 60, 100, 90, 70].map((w, i) => (
          <SkeletonBox
            key={i}
            width={w}
            height={36}
            borderRadius={18}
            baseColor={baseColor}
            highlightColor={highlightColor}
          />
        ))}
      </View>

      {/* Transaction sections */}
      {[1, 2].map((section) => (
        <View key={section} style={{ marginTop: 16 }}>
          {/* Section header */}
          <View style={styles.sectionHeader}>
            <SkeletonBox
              width={80}
              height={16}
              baseColor={baseColor}
              highlightColor={highlightColor}
            />
            <SkeletonBox
              width={60}
              height={16}
              baseColor={baseColor}
              highlightColor={highlightColor}
            />
          </View>

          {/* Transaction items */}
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              style={[
                styles.transactionItem,
                { backgroundColor: THEME.surface, borderColor: THEME.border },
              ]}
            >
              <SkeletonBox
                width={44}
                height={44}
                borderRadius={22}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
              <View style={styles.transactionContent}>
                <SkeletonBox
                  width={100}
                  height={16}
                  baseColor={baseColor}
                  highlightColor={highlightColor}
                />
                <SkeletonBox
                  width={140}
                  height={12}
                  baseColor={baseColor}
                  highlightColor={highlightColor}
                  style={{ marginTop: 6 }}
                />
              </View>
              <SkeletonBox
                width={70}
                height={18}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

// ─── Budget Screen Skeleton ─────────────────────────────────────────────────

interface BudgetSkeletonProps {
  THEME: {
    background: string;
    surface: string;
    border: string;
  };
}

/**
 * Full skeleton layout for the Budget screen.
 * Shows placeholders for: title and budget cards with progress bars.
 */
export const BudgetSkeleton = React.memo(function BudgetSkeleton({
  THEME,
}: BudgetSkeletonProps) {
  const baseColor = THEME.border;
  const highlightColor = THEME.surface;

  return (
    <View style={[styles.container, { backgroundColor: THEME.background }]}>
      {/* Title */}
      <View style={styles.centeredTitle}>
        <SkeletonBox
          width={100}
          height={28}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      </View>

      {/* Budget cards */}
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.budgetCard,
            { backgroundColor: THEME.surface, borderColor: THEME.border },
          ]}
        >
          <View style={styles.budgetCardRow}>
            {/* Left side: category, limit, spent */}
            <View style={{ flex: 1 }}>
              <SkeletonBox
                width={80}
                height={14}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
              <SkeletonBox
                width={120}
                height={32}
                baseColor={baseColor}
                highlightColor={highlightColor}
                style={{ marginTop: 8 }}
              />
              <SkeletonBox
                width={100}
                height={14}
                baseColor={baseColor}
                highlightColor={highlightColor}
                style={{ marginTop: 12 }}
              />
            </View>

            {/* Right side: icon and percentage */}
            <View style={{ alignItems: "center" }}>
              <SkeletonBox
                width={64}
                height={64}
                borderRadius={32}
                baseColor={baseColor}
                highlightColor={highlightColor}
              />
              <SkeletonBox
                width={50}
                height={24}
                borderRadius={6}
                baseColor={baseColor}
                highlightColor={highlightColor}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>

          {/* Progress bar */}
          <SkeletonBox
            width="100%"
            height={12}
            borderRadius={6}
            baseColor={baseColor}
            highlightColor={highlightColor}
            style={{ marginTop: 16 }}
          />
        </View>
      ))}
    </View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  spentCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  budgetItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  budgetItemContent: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  transactionContent: {
    flex: 1,
    marginLeft: 12,
  },
  centeredTitle: {
    alignItems: "center",
    marginBottom: 20,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  budgetCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  budgetCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default {
  SkeletonBox,
  HomeSkeleton,
  TransactionSkeleton,
  BudgetSkeleton,
};
