// screens/StudentsScreen.js
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

export default function StudentsScreen() {
  const navigation = useNavigation();
  const { theme: T } = useTheme();
  const { requests } = useSelector((state) => state.guardianRequests);
  const pendingCount = Array.isArray(requests)
    ? requests.filter((r) => r.status === "pending").length
    : 0;

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Students" />

      <OptionsSection>
        <OptionRow
          icon="people-outline"
          label="Student List"
          subtitle="Everyone on your routes"
          onPress={() => navigation.navigate("StudentList")}
        />
        <OptionDivider />
        <OptionRow
          icon="person-add-outline"
          label="Pending Requests"
          subtitle="Guardian requests awaiting review"
          onPress={() => navigation.navigate("Requests")}
          rightElement={
            pendingCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: T.accent }]}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            ) : undefined
          }
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
