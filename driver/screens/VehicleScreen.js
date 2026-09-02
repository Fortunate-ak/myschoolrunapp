// screens/VehicleScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { getDriverVehicles } from "../lib/VehicleSlice";
const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

function VehicleCard({ vehicle, onPress }) {
  const { theme: T } = useTheme();

  const getStatusColor = () => {
    if (!vehicle.isActive) return "#ff4444";
    return "#4caf50";
  };

  const imageUrl = getImageUrl(vehicle.image);
  return (
    <TouchableOpacity
      style={[
        styles.vehicleCard,
        { backgroundColor: T.surface, borderColor: T.border },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.vehicleCardImage} />
      ) : (
        <View
          style={[
            styles.vehicleCardImagePlaceholder,
            { backgroundColor: T.accentDim },
          ]}
        >
          <Ionicons name="car-outline" size={32} color={T.accent} />
        </View>
      )}

      <View style={styles.vehicleCardContent}>
        <Text style={[styles.vehicleCardName, { color: T.text }]}>
          {vehicle.carMake} {vehicle.carModel}
        </Text>
        <Text style={[styles.vehicleCardReg, { color: T.textMuted }]}>
          {vehicle.registrationNumber}
        </Text>
        <View style={styles.vehicleCardMeta}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
          />
          <Text style={[styles.statusText, { color: T.textMuted }]}>
            {vehicle.isActive ? "Active" : "Inactive"}
          </Text>
          <Text style={[styles.metaSeparator, { color: T.textMuted }]}>·</Text>
          <Text style={[styles.metaText, { color: T.textMuted }]}>
            {vehicle.capacity} seats
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={T.textMuted} />
    </TouchableOpacity>
  );
}

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

export default function VehicleScreen() {
  const { theme: T } = useTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { drivervehicles, isLoading } = useSelector((state) => state.vehicles);
  const [refreshing, setRefreshing] = useState(false);

  const loadVehicles = async () => {
    await dispatch(getDriverVehicles());
  };

  useFocusEffect(
    React.useCallback(() => {
      loadVehicles();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  };

  const navigateToAddVehicle = () => {
    navigation.navigate("AddVehicle");
  };

  const navigateToVehicleDetail = (vehicle) => {
    navigation.navigate("VehicleDetail", { vehicle });
  };

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
        <Text style={[styles.headerTitle, { color: T.text }]}>My Vehicles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={navigateToAddVehicle}>
          <Ionicons name="add" size={28} color={T.accent} />
        </TouchableOpacity>
      </View>

      {/* Vehicle List */}
      {isLoading && !refreshing ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={[styles.loadingText, { color: T.textMuted }]}>
            Loading vehicles...
          </Text>
        </View>
      ) : drivervehicles?.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: T.accentDim }]}>
            <Ionicons name="car-outline" size={48} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No Vehicles Added
          </Text>
          <Text style={[styles.emptySub, { color: T.textMuted }]}>
            Add your first vehicle to start tracking and managing your fleet.
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: T.accent }]}
            onPress={navigateToAddVehicle}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyAddBtnText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={drivervehicles}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.accent}
            />
          }
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              onPress={() => navigateToVehicleDetail(item)}
            />
          )}
        />
      )}
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
  headerTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  addBtn: { padding: 4, width: 40, alignItems: "flex-end" },
  centerLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 80 },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  vehicleCardImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  vehicleCardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  vehicleCardContent: { flex: 1 },
  vehicleCardName: { fontSize: 15, fontWeight: "700" },
  vehicleCardReg: { fontSize: 12, marginTop: 2 },
  vehicleCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11 },
  metaSeparator: { fontSize: 11 },
  metaText: { fontSize: 11 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  emptyAddBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
