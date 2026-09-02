// screens/ViewProfileScreen.js
import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import OptionsScreenContainer, {
  OptionsScreenHeader,
} from "../components/DrawerOptionsScreen";

export default function ViewProfileScreen() {
  const { theme: T } = useTheme();
  const { user } = useSelector((s) => s.auth);
  const { driverProfile } = useSelector((s) => s.users);

  if (!driverProfile) {
    return (
      <OptionsScreenContainer>
        <OptionsScreenHeader title="Profile Details" />
        <View style={styles.emptyWrap}>
          <Text style={{ color: T.textMuted }}>No profile data available.</Text>
        </View>
      </OptionsScreenContainer>
    );
  }

  const fields = [
    {
      label: "Full Name",
      value: user?.fullname || driverProfile.fullName || "—",
    },
    { label: "Email", value: user?.email || "—" },
    { label: "ID Number", value: driverProfile.idNumber || "—" },
    { label: "Driver's License", value: driverProfile.licenseNumber || "—" },
    {
      label: "Gender",
      value: driverProfile.gender
        ? driverProfile.gender.charAt(0).toUpperCase() +
          driverProfile.gender.slice(1)
        : "—",
    },
    { label: "Car Make", value: driverProfile.carMake || "—" },
    { label: "Car Model", value: driverProfile.carModel || "—" },
    { label: "Registration", value: driverProfile.registrationNumber || "—" },
    { label: "Capacity", value: driverProfile.capacity?.toString() || "—" },
    { label: "Last Service", value: driverProfile.lastServiceDate || "—" },
    { label: "Next Service", value: driverProfile.nextServiceDate || "—" },
    { label: "Insurance Expiry", value: driverProfile.insuranceExpiry || "—" },
  ];

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Profile Details" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {driverProfile.profileImage && (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: driverProfile.profileImage }}
              style={styles.profileImage}
            />
          </View>
        )}
        {driverProfile.vehicleImage && (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: driverProfile.vehicleImage }}
              style={styles.vehicleImage}
            />
          </View>
        )}

        <View
          style={[
            styles.card,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          {fields.map((item, idx) => (
            <View key={idx} style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: T.textMuted }]}>
                {item.label}
              </Text>
              <Text style={[styles.fieldValue, { color: T.text }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </OptionsScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },
  imageWrap: { alignItems: "center", marginBottom: 16 },
  profileImage: { width: 80, height: 80, borderRadius: 40 },
  vehicleImage: { width: 120, height: 80, borderRadius: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  fieldLabel: { fontSize: 14, fontWeight: "500" },
  fieldValue: { fontSize: 14, fontWeight: "600" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
});
