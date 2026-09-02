// screens/VehicleDetailScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch } from "react-redux";
import { updateVehicle } from "../lib/VehicleSlice";
import Toast from "react-native-toast-message";
const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const getImageUrl = (filePath) => {
  if (!filePath) return null;

  // Replace backslashes with forward slashes for URL
  let normalizedPath = filePath.replace(/\\/g, "/");

  // Remove 'uploads/' prefix if present (to avoid double)
  if (normalizedPath.startsWith("uploads/")) {
    normalizedPath = normalizedPath;
  }

  // Construct the full URL
  const baseUrl = API_BASE_URL.replace("/api", "");
  const imageUrl = `${baseUrl}/${normalizedPath}`;

  return imageUrl;
};

function InfoRow({ icon, label, value, T }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: T.border }]}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={20} color={T.textMuted} />
        <Text style={[styles.infoLabel, { color: T.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.infoValue, { color: T.text }]}>{value || "—"}</Text>
    </View>
  );
}

function ServiceCard({ title, date, status, icon, color, T }) {
  return (
    <View
      style={[
        styles.serviceCard,
        { backgroundColor: T.surface, borderColor: T.border },
      ]}
    >
      <View style={[styles.serviceIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.serviceInfo}>
        <Text style={[styles.serviceTitle, { color: T.text }]}>{title}</Text>
        <Text style={[styles.serviceDate, { color: T.textMuted }]}>
          {date ? new Date(date).toLocaleDateString() : "Not set"}
        </Text>
      </View>
      <View
        style={[
          styles.serviceStatus,
          {
            backgroundColor: status === "Upcoming" ? color + "15" : "#4caf5015",
          },
        ]}
      >
        <View
          style={[
            styles.serviceStatusDot,
            { backgroundColor: status === "Upcoming" ? color : "#4caf50" },
          ]}
        />
        <Text
          style={[
            styles.serviceStatusText,
            { color: status === "Upcoming" ? color : "#4caf50" },
          ]}
        >
          {status || "Active"}
        </Text>
      </View>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const { theme: T } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { vehicle } = route.params || {};
  const [updating, setUpdating] = useState(false);

  if (!vehicle) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: T.bg,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: T.text }}>Vehicle not found</Text>
      </View>
    );
  }

  const getStatusColor = () => {
    if (!vehicle.isActive) return "#ff4444";
    const today = new Date();
    const nextService = vehicle.nextServiceDate
      ? new Date(vehicle.nextServiceDate)
      : null;
    if (nextService && nextService < today) return "#ff8f00";
    return "#4caf50";
  };

  const getStatusLabel = () => {
    if (!vehicle.isActive) return "Inactive";
    const today = new Date();
    const nextService = vehicle.nextServiceDate
      ? new Date(vehicle.nextServiceDate)
      : null;
    if (nextService && nextService < today) return "Service Due";
    return "Active";
  };

  const getServiceStatus = (date) => {
    if (!date) return "Not set";
    const today = new Date();
    const serviceDate = new Date(date);
    if (serviceDate < today) return "Overdue";
    const diffDays = Math.ceil((serviceDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return "Coming Soon";
    return "Upcoming";
  };

  const toggleVehicleStatus = () => {
    Alert.alert(
      vehicle.isActive ? "Deactivate Vehicle" : "Activate Vehicle",
      `Are you sure you want to ${vehicle.isActive ? "deactivate" : "activate"} this vehicle?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            const result = await dispatch(
              updateVehicle({
                id: vehicle.id,
                isActive: !vehicle.isActive,
              }),
            );
            setUpdating(false);
            if (updateVehicle.fulfilled.match(result)) {
              Toast.show({
                type: "success",
                text1: vehicle.isActive
                  ? "Vehicle deactivated"
                  : "Vehicle activated",
              });
              navigation.setParams({
                vehicle: { ...vehicle, isActive: !vehicle.isActive },
              });
            }
          },
        },
      ],
    );
  };

  const imageUrl = getImageUrl(vehicle.image);

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>
          Vehicle Details
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Vehicle Image */}
        <View style={styles.imageSection}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.mainImage} />
          ) : (
            <View
              style={[
                styles.mainImagePlaceholder,
                { backgroundColor: T.accentDim },
              ]}
            >
              <Ionicons name="car-outline" size={60} color={T.accent} />
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor() + "20" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
              {getStatusLabel()}
            </Text>
          </View>
        </View>

        {/* Vehicle Name */}
        <View style={[styles.nameSection, { borderBottomColor: T.border }]}>
          <Text style={[styles.vehicleName, { color: T.text }]}>
            {vehicle.carMake} {vehicle.carModel}
          </Text>
          <Text style={[styles.vehicleReg, { color: T.textMuted }]}>
            {vehicle.registrationNumber}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: T.surface }]}>
            <Ionicons name="people-outline" size={20} color={T.accent} />
            <Text style={[styles.statValue, { color: T.text }]}>
              {vehicle.capacity}
            </Text>
            <Text style={[styles.statLabel, { color: T.textMuted }]}>
              Seats
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: T.surface }]}>
            <Ionicons name="calendar-outline" size={20} color={T.accent} />
            <Text style={[styles.statValue, { color: T.text }]}>
              {vehicle.lastServiceDate
                ? new Date(vehicle.lastServiceDate).toLocaleDateString()
                : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: T.textMuted }]}>
              Last Service
            </Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: T.surface }]}>
            <Ionicons
              name="calendar-clear-outline"
              size={20}
              color={T.accent}
            />
            <Text style={[styles.statValue, { color: T.text }]}>
              {vehicle.nextServiceDate
                ? new Date(vehicle.nextServiceDate).toLocaleDateString()
                : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: T.textMuted }]}>
              Next Service
            </Text>
          </View>
        </View>

        {/* Vehicle Info */}
        <View
          style={[
            styles.infoSection,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Vehicle Information
          </Text>
          <InfoRow
            icon="calendar-outline"
            label="Added On"
            value={new Date(vehicle.createdAt).toLocaleDateString()}
            T={T}
          />
          <InfoRow
            icon="time-outline"
            label="Last Updated"
            value={new Date(vehicle.updatedAt).toLocaleDateString()}
            T={T}
          />
          {vehicle.driver?.user?.fullname && (
            <InfoRow
              icon="person-outline"
              label="Driver"
              value={vehicle.driver.user.fullname}
              T={T}
            />
          )}
        </View>

        {/* Service & Maintenance */}
        <View
          style={[
            styles.infoSection,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Service & Maintenance
          </Text>

          <ServiceCard
            title="Last Service"
            date={vehicle.lastServiceDate}
            status={vehicle.lastServiceDate ? "Completed" : "Not set"}
            icon="checkmark-done-circle-outline"
            color="#4caf50"
            T={T}
          />

          <ServiceCard
            title="Next Service"
            date={vehicle.nextServiceDate}
            status={getServiceStatus(vehicle.nextServiceDate)}
            icon="construct-outline"
            color="#e83030"
            T={T}
          />

          <ServiceCard
            title="Insurance Expiry"
            date={vehicle.insuranceExpiry}
            status={getServiceStatus(vehicle.insuranceExpiry)}
            icon="shield-checkmark-outline"
            color="#ff8f00"
            T={T}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
            onPress={toggleVehicleStatus}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator
                size="small"
                color={vehicle.isActive ? "#ff4444" : "#4caf50"}
              />
            ) : (
              <>
                <Ionicons
                  name={vehicle.isActive ? "power-outline" : "power"}
                  size={20}
                  color={vehicle.isActive ? "#ff4444" : "#4caf50"}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: vehicle.isActive ? "#ff4444" : "#4caf50" },
                  ]}
                >
                  {vehicle.isActive ? "Deactivate" : "Activate"} Vehicle
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
            onPress={() => navigation.navigate("EditVehicle", { vehicle })}
          >
            <Ionicons name="create-outline" size={20} color={T.accent} />
            <Text style={[styles.actionBtnText, { color: T.accent }]}>
              Edit Vehicle
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  imageSection: {
    position: "relative",
    padding: 20,
    alignItems: "center",
  },
  mainImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    resizeMode: "cover",
  },
  mainImagePlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  nameSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  vehicleName: { fontSize: 22, fontWeight: "800" },
  vehicleReg: { fontSize: 14, marginTop: 4 },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  infoSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "500" },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 13, fontWeight: "600" },
  serviceDate: { fontSize: 12, marginTop: 2 },
  serviceStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  serviceStatusDot: { width: 6, height: 6, borderRadius: 3 },
  serviceStatusText: { fontSize: 10, fontWeight: "600" },
  actionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
});
