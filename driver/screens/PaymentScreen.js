// screens/PaymentScreen.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import OptionsScreenContainer, {
  OptionsScreenHeader,
} from "../components/DrawerOptionsScreen";

export default function PaymentScreen() {
  const { theme: T } = useTheme();
  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Payment Info" />
      <View style={styles.center}>
        <Ionicons name="card-outline" size={48} color={T.textMuted} />
        <Text style={[styles.text, { color: T.textMuted }]}>
          Bank account details for payouts.
        </Text>
        <Text style={[styles.sub, { color: T.textDisabled }]}>Coming soon</Text>
      </View>
    </OptionsScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  text: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  sub: { fontSize: 12, textAlign: "center" },
});
