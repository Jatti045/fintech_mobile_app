import { View, Text, ActivityIndicator } from "react-native";
import React from "react";
import { useTheme } from "@/hooks/useRedux";

const Loader = ({ msg }: { msg: string }) => {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <View
        style={{
          backgroundColor: THEME.background,
          padding: 20,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text
          style={{
            color: THEME.textPrimary,
            marginTop: 10,
            fontSize: 16,
          }}
        >
          {msg || "Loading..."}
        </Text>
      </View>
    </View>
  );
};

export default Loader;
