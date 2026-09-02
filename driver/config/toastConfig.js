// src/config/toastConfig.js
import React from "react";
import { View } from "react-native";
import { BaseToast } from "react-native-toast-message";
import { Ionicons } from "@react-native-vector-icons/ionicons";
const iconWrapper = {
  width: 40,
  alignItems: "center",
  justifyContent: "center",
};

const commonText1 = {
  color: "#fff",
  fontSize: 15,
  fontWeight: "600",
};

const commonText2 = {
  color: "#fff",
  fontSize: 13,
  opacity: 0.9,
};

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftWidth: 0,
        backgroundColor: "#16a34a", // green
        borderRadius: 12,
        paddingVertical: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      text1Style={commonText1}
      text2Style={commonText2}
      renderLeadingIcon={() => (
        <View style={iconWrapper}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
        </View>
      )}
    />
  ),

  error: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftWidth: 0,
        backgroundColor: "#dc2626", // red
        borderRadius: 12,
        paddingVertical: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      text1Style={commonText1}
      text2Style={commonText2}
      renderLeadingIcon={() => (
        <View style={iconWrapper}>
          <Ionicons name="close-circle" size={22} color="#fff" />
        </View>
      )}
    />
  ),

  info: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftWidth: 0,
        backgroundColor: "#f59e0b", // amber
        borderRadius: 12,
        paddingVertical: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 8 }}
      text1Style={commonText1}
      text2Style={commonText2}
      renderLeadingIcon={() => (
        <View style={iconWrapper}>
          <Ionicons name="information-circle" size={22} color="#fff" />
        </View>
      )}
    />
  ),
};
