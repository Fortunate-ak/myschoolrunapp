// screens/DocumentsScreen.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import OptionsScreenContainer, {
  OptionsScreenHeader,
} from "../components/DrawerOptionsScreen";

export default function DocumentsScreen() {
  const { theme: T } = useTheme();
  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Documents" />
      <View style={styles.center}>
        <Ionicons
          name="document-attach-outline"
          size={48}
          color={T.textMuted}
        />
        <Text style={[styles.text, { color: T.textMuted }]}>
          Licence, registration and permit files.
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
