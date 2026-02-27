import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Centralised haptic feedback helpers.
 *
 * All functions are safe no-ops on platforms that don't support the Taptic
 * Engine (e.g. Android emulators, web). Errors are silently swallowed so
 * callers never need try/catch.
 */

const isHapticsAvailable = Platform.OS === "ios" || Platform.OS === "android";

/** Light tap — confirmations, toggles, small UI actions. */
export const hapticLight = () => {
  if (!isHapticsAvailable) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Medium tap — button presses, modal opens. */
export const hapticMedium = () => {
  if (!isHapticsAvailable) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** Heavy tap — destructive actions, errors. */
export const hapticHeavy = () => {
  if (!isHapticsAvailable) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
};

/** Success notification — created, saved, completed. */
export const hapticSuccess = () => {
  if (!isHapticsAvailable) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
};

/** Warning notification — approaching limit, validation issue. */
export const hapticWarning = () => {
  if (!isHapticsAvailable) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {},
  );
};

/** Error notification — failed action, destructive confirmation. */
export const hapticError = () => {
  if (!isHapticsAvailable) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {},
  );
};

/** Selection tick — scrolling through pickers, swiping items. */
export const hapticSelection = () => {
  if (!isHapticsAvailable) return;
  Haptics.selectionAsync().catch(() => {});
};
