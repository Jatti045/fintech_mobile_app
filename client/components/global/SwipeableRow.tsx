import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { hapticHeavy } from "@/utils/haptics";

export interface SwipeableRowProps {
  /** Content rendered inside the swipeable area. */
  children: React.ReactNode;
  /** Called when the delete action is triggered (swipe or long-press). */
  onDelete: () => void;
  /** Background colour of the delete button. */
  dangerColor: string;
  /** Extra styles applied to the delete-action container. */
  actionStyle?: ViewStyle;
}

/**
 * Reusable swipe-right-to-reveal-delete wrapper.
 *
 * Renders a red trash-icon button when the user swipes left.
 * Triggers haptic feedback on press.
 */
export default function SwipeableRow({
  children,
  onDelete,
  dangerColor,
  actionStyle,
}: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={[
          styles.deleteAction,
          { backgroundColor: dangerColor },
          actionStyle,
        ]}
        activeOpacity={0.7}
        onPress={() => {
          hapticHeavy();
          swipeableRef.current?.close();
          onDelete();
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather name="trash-2" size={22} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 8,
    marginBottom: 12,
    marginLeft: 8,
  },
});
