import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useTheme } from "@/hooks/useRedux";

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useThemedAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useThemedAlert must be used within AlertProvider");
  }
  return context;
};

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);
  const { THEME } = useTheme();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = (options: AlertOptions) => {
    // Cancel any pending clear so the new alert content isn't wiped out
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setAlertOptions(options);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
    hideTimerRef.current = setTimeout(() => {
      setAlertOptions(null);
      hideTimerRef.current = null;
    }, 300);
  };

  const handleButtonPress = (button?: AlertButton) => {
    hideAlert();
    button?.onPress?.();
  };

  const buttons = alertOptions?.buttons || [{ text: "OK", style: "default" }];

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.alertContainer,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
            ]}
          >
            {/* Title */}
            <Text
              style={[styles.title, { color: THEME.textPrimary }]}
              numberOfLines={2}
            >
              {alertOptions?.title}
            </Text>

            {/* Message */}
            {alertOptions?.message && (
              <Text
                style={[styles.message, { color: THEME.textSecondary }]}
                numberOfLines={4}
              >
                {alertOptions.message}
              </Text>
            )}

            {/* Buttons */}
            <View
              style={[
                styles.buttonContainer,
                buttons.length === 2 && styles.buttonContainerHorizontal,
              ]}
            >
              {buttons.map((button, index) => {
                const isDestructive = button.style === "destructive";
                const isCancel = button.style === "cancel";
                const isSingleButton = buttons.length === 1;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      buttons.length === 2 && styles.buttonHorizontal,
                      isSingleButton && styles.buttonSingle,
                      {
                        backgroundColor: isDestructive
                          ? THEME.danger
                          : isCancel
                            ? THEME.surface
                            : THEME.primary,
                        borderColor: isCancel ? THEME.border : "transparent",
                        borderWidth: isCancel ? 1 : 0,
                      },
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: isCancel ? THEME.textPrimary : "#FFFFFF",
                          fontWeight: isDestructive ? "700" : "600",
                        },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "center",
  },
  buttonContainer: {
    gap: 10,
  },
  buttonContainerHorizontal: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonHorizontal: {
    flex: 1,
  },
  buttonSingle: {
    width: "100%",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

// Export types for convenience
export type { AlertButton, AlertOptions };
