/**
 * screens/AvailableDriversScreen.js
 *
 * Available Drivers Display and Selection
 * - Displays available drivers from backend
 * - Shows driver cards with ratings, vehicle, price
 * - Guardian selects a driver
 * - Submits selection to backend
 * - Shows waiting status after selection
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import {
  getAvailableDrivers,
  selectDriverForRide,
} from "../lib/EmergencyRideSlice";
import { getInitials } from "../utils/helpers";

// Star Rating Component
const StarRating = ({ rating, size = 14, color = "#f59e0b" }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 > 0;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Ionicons key={i} name="star" size={size} color={color} />
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <Ionicons key={i} name="star-half" size={size} color={color} />
      );
    } else {
      stars.push(
        <Ionicons
          key={i}
          name="star-outline"
          size={size}
          color={color}
        />
      );
    }
  }
  return <View style={{ flexDirection: "row", gap: 2 }}>{stars}</View>;
};

export default function AvailableDriversScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { rideId } = route.params || {};
  const { availableDrivers, isLoading, isSubmitting, error } = useSelector(
    (state) => state.emergencyRides
  );

  const [selectedDriverId, setSelectedDriverId] = useState(null);

  // Fetch available drivers on mount
  useEffect(() => {
    if (rideId) {
      dispatch(getAvailableDrivers(rideId));
    }
  }, [rideId, dispatch]);

  // Show error if fetching drivers failed
  useEffect(() => {
    if (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error,
      });
    }
  }, [error]);

  const handleSelectDriver = async () => {
    if (!selectedDriverId) {
      Toast.show({
        type: "error",
        text1: "Select a Driver",
        text2: "Please select a driver before continuing",
      });
      return;
    }

    try {
      const result = await dispatch(
        selectDriverForRide({
          rideId,
          driverId: selectedDriverId,
        })
      );

      if (result.payload) {
        Toast.show({
          type: "success",
          text1: "Driver Selected",
          text2: "Waiting for driver acceptance...",
        });
        // Navigate to status screen
        navigation.navigate("EmergencyRideStatus", {
          rideId: rideId,
          ride: result.payload,
        });
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Selection Failed",
        text2: err.message || "Could not select driver",
      });
    }
  };

  if (isLoading && !availableDrivers.length) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: T.surface,
              borderBottomColor: T.border,
              paddingTop: insets.top,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Available Drivers
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Loading State */}
        <View style={styles.center}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={[styles.loadingText, { color: T.textSecondary, marginTop: 16 }]}>
            Searching for available drivers...
          </Text>
        </View>
      </View>
    );
  }

  // No drivers available
  if (!isLoading && availableDrivers.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: T.surface,
              borderBottomColor: T.border,
              paddingTop: insets.top,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Available Drivers
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Empty State */}
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: T.accentDim },
            ]}
          >
            <Ionicons name="car-outline" size={48} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No Drivers Available
          </Text>
          <Text style={[styles.emptyDesc, { color: T.textMuted, marginBottom: 24 }]}>
            Unfortunately, no drivers are currently available for your requested
            location and time. Please try again later.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: "80%" }}
          >
            <LinearGradient
              colors={["#ff6b6b", "#e83030"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: T.surface,
            borderBottomColor: T.border,
            paddingTop: insets.top,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Available Drivers
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Driver Count ──────────────────────────────────────────────── */}
      <View
        style={[
          styles.driverCountBanner,
          { backgroundColor: T.surface, borderBottomColor: T.border },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color={T.success} />
        <Text style={[styles.driverCountText, { color: T.text }]}>
          {availableDrivers.length} driver{availableDrivers.length !== 1 ? "s" : ""}{" "}
          available
        </Text>
      </View>

      {/* ─── Driver List ───────────────────────────────────────────────── */}
      <FlatList
        data={availableDrivers}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={true}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 140 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item: driver }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setSelectedDriverId(driver.id)}
          >
            <View
              style={[
                styles.driverCard,
                {
                  backgroundColor:
                    selectedDriverId === driver.id ? T.accentDim : T.surface,
                  borderColor:
                    selectedDriverId === driver.id ? T.accent : T.border,
                  borderWidth: 1.5,
                },
              ]}
            >
              {/* Selection Indicator */}
              <View style={styles.driverCardTop}>
                <View style={{ flex: 1 }} />
                <View
                  style={[
                    styles.selectionCircle,
                    {
                      borderColor: T.accent,
                      backgroundColor:
                        selectedDriverId === driver.id ? T.accent : "transparent",
                    },
                  ]}
                >
                  {selectedDriverId === driver.id && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
              </View>

              {/* Driver Info Row */}
              <View style={styles.driverInfo}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {driver.profileImage ? (
                    <Image
                      source={{ uri: driver.profileImage }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarFallback,
                        { backgroundColor: T.accent },
                      ]}
                    >
                      <Text style={styles.avatarInitials}>
                        {getInitials(driver.firstName + " " + driver.lastName)}
                      </Text>
                    </View>
                  )}
                  {driver.isVerified && (
                    <View style={styles.verificationBadge}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>

                {/* Driver Details */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.driverName, { color: T.text }]}
                    numberOfLines={1}
                  >
                    {driver.firstName} {driver.lastName}
                  </Text>

                  {/* Rating and Rides */}
                  <View style={styles.ratingRow}>
                    <StarRating rating={driver.rating || 4.5} size={13} />
                    <Text style={[styles.ratingText, { color: T.textMuted }]}>
                      {(driver.rating || 4.5).toFixed(1)}
                    </Text>
                    {driver.completedEmergencyRides !== undefined && (
                      <>
                        <Text style={[styles.separator, { color: T.textMuted }]}>
                          •
                        </Text>
                        <Text style={[styles.ridesText, { color: T.textMuted }]}>
                          {driver.completedEmergencyRides} rides
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Vehicle Info */}
                  {driver.vehicle && (
                    <Text
                      style={[styles.vehicleInfo, { color: T.textMuted }]}
                      numberOfLines={1}
                    >
                      {driver.vehicle.make} {driver.vehicle.model} •{" "}
                      {driver.vehicle.registrationNumber}
                    </Text>
                  )}
                </View>
              </View>

              {/* Pricing and Distance Row */}
              <View style={styles.pricingRow}>
                {/* Price */}
                <View style={styles.priceBox}>
                  <Text
                    style={[styles.priceAmount, { color: T.accent }]}
                  >
                    ${(driver.price || 0).toFixed(2)}
                  </Text>
                  {driver.currency && (
                    <Text style={[styles.priceCurrency, { color: T.textMuted }]}>
                      {driver.currency}
                    </Text>
                  )}
                </View>

                {/* Distance/ETA */}
                {driver.distance !== undefined || driver.eta !== undefined ? (
                  <View style={styles.etaBox}>
                    {driver.distance !== undefined && (
                      <View style={styles.etaItem}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={T.textMuted}
                        />
                        <Text style={[styles.etaText, { color: T.textMuted }]}>
                          {driver.distance.toFixed(1)} km
                        </Text>
                      </View>
                    )}
                    {driver.eta !== undefined && (
                      <View style={styles.etaItem}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={T.textMuted}
                        />
                        <Text style={[styles.etaText, { color: T.textMuted }]}>
                          {driver.eta} min
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ─── Footer Button ────────────────────────────────────────────── */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 20,
            borderTopColor: T.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleSelectDriver}
          disabled={!selectedDriverId || isSubmitting}
          style={{
            opacity: !selectedDriverId || isSubmitting ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["#ff6b6b", "#e83030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.selectButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.selectButtonText}>Select Driver</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  driverCountBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  driverCountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  emptyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  driverCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  driverCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  selectionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  verificationBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  separator: {
    marginHorizontal: 4,
  },
  ridesText: {
    fontSize: 12,
  },
  vehicleInfo: {
    fontSize: 12,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  priceBox: {
    alignItems: "flex-start",
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  priceCurrency: {
    fontSize: 10,
    marginTop: 2,
  },
  etaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  etaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  etaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
