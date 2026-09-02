/**
 * screens/EmergencyRideTrackingScreen.js
 *
 * Live Tracking & Trip Updates
 * - Shows driver's real-time location on Mapbox
 * - Displays trip progress (arriving, pickup, in transit, delivered)
 * - Live location updates via Socket.io
 * - Shows driver info and ETA
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Mapbox from "@rnmapbox/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useSelector, useDispatch } from "react-redux";
import Toast from "react-native-toast-message";
import { getSocket } from "../utils/socket"; // raw socket getter — do NOT call useGuardianSocket() here, it's mounted once at app root
import { getInitials } from "../utils/helpers";

// Set Mapbox access token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "");

// Status Progress Component
const StatusProgress = ({ currentStatus, T }) => {
  const statuses = [
    { key: "DRIVER_ACCEPTED", label: "Accepted", icon: "checkmark-circle" },
    { key: "DRIVER_ARRIVING", label: "Arriving", icon: "location" },
    { key: "STUDENT_PICKED_UP", label: "Picked Up", icon: "person-circle" },
    { key: "IN_TRANSIT", label: "In Transit", icon: "car" },
    { key: "COMPLETED", label: "Completed", icon: "checkmark-done-circle" },
  ];

  const currentIndex = statuses.findIndex((s) => s.key === currentStatus);

  return (
    <View style={styles.progressContainer}>
      {statuses.map((status, idx) => (
        <View key={status.key} style={styles.progressItem}>
          {/* Status Dot */}
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  idx <= currentIndex ? T.success : T.border,
              },
            ]}
          >
            <Ionicons
              name={status.icon}
              size={16}
              color={idx <= currentIndex ? "#fff" : T.textMuted}
            />
          </View>

          {/* Label */}
          <Text
            style={[
              styles.statusLabel,
              {
                color: idx <= currentIndex ? T.text : T.textMuted,
                fontWeight: idx <= currentIndex ? "600" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {status.label}
          </Text>

          {/* Line */}
          {idx < statuses.length - 1 && (
            <View
              style={[
                styles.statusLine,
                {
                  backgroundColor:
                    idx < currentIndex ? T.success : T.border,
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
};

export default function EmergencyRideTrackingScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { rideId, ride: initialRide } = route.params || {};
  const { currentRide, selectedDriver } = useSelector(
    (state) => state.emergencyRides
  );

  const [driverLocation, setDriverLocation] = useState(null);
  const [tripStatus, setTripStatus] = useState("DRIVER_ACCEPTED");
  const [eta, setEta] = useState(null);
  const [cameraRef, setCameraRef] = useState(null);

  const ride = currentRide || initialRide;
  const driver = selectedDriver;

  // Parse coordinates
  const pickupCoords = ride
    ? [parseFloat(ride.pickupLongitude), parseFloat(ride.pickupLatitude)]
    : null;
  const destinationCoords = ride
    ? [parseFloat(ride.destinationLongitude), parseFloat(ride.destinationLatitude)]
    : null;
  const driverCoords = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : null;

  // Socket.io listeners for location and status updates
  useEffect(() => {
    const socket = getSocket(); // the singleton connected/joined once at app root by useGuardianSocket
    if (!socket) return;

    // Listen for driver location updates
    const handleLocationUpdate = (data) => {
      if (data.rideId === rideId) {
        setDriverLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        if (data.eta) setEta(data.eta);
      }
    };

    // Listen for trip status changes
    const handleTripStatusUpdate = (data) => {
      if (data.rideId === rideId) {
        setTripStatus(data.status);

        // Show status notifications
        const statusMessages = {
          DRIVER_ARRIVING: "Driver is arriving at pickup location",
          STUDENT_PICKED_UP: "Student has been picked up",
          IN_TRANSIT: "Trip is now in transit",
          COMPLETED: "Ride has been completed",
        };

        if (statusMessages[data.status]) {
          Toast.show({
            type: "success",
            text1: "Trip Update",
            text2: statusMessages[data.status],
          });
        }

        // Navigate to rating screen when completed
        if (data.status === "COMPLETED") {
          setTimeout(() => {
            navigation.navigate("RateEmergencyDriver", {
              rideId,
              ride: data.ride || ride,
              driver,
            });
          }, 2000);
        }
      }
    };

    const handleRideCancelled = (data) => {
      if (data.rideId === rideId) {
        Toast.show({
          type: "error",
          text1: "Ride Cancelled",
          text2: "The ride has been cancelled",
        });
        setTimeout(() => {
          navigation.navigate("EmergencyRideMenu");
        }, 1500);
      }
    };

    socket.on("vehicle-location-update", handleLocationUpdate);
    socket.on("emergency-ride:trip-status-update", handleTripStatusUpdate);
    socket.on("emergency-ride:ride-cancelled", handleRideCancelled);

    return () => {
      socket.off("vehicle-location-update", handleLocationUpdate);
      socket.off("emergency-ride:trip-status-update", handleTripStatusUpdate);
      socket.off("emergency-ride:ride-cancelled", handleRideCancelled);
    };
  }, [rideId, navigation, ride, driver]);

  // Auto-center map on driver location
  useEffect(() => {
    if (driverCoords && cameraRef) {
      cameraRef.setCamera({
        centerCoordinate: driverCoords,
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  }, [driverCoords, cameraRef]);

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
          Live Tracking
        </Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Cancel Ride",
              "Are you sure you want to cancel this ride?",
              [
                { text: "Keep Going", style: "cancel" },
                {
                  text: "Cancel Ride",
                  style: "destructive",
                  onPress: () => {
                    Toast.show({
                      type: "info",
                      text1: "Ride Cancelled",
                    });
                    navigation.navigate("EmergencyRideMenu");
                  },
                },
              ]
            );
          }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={T.text} />
        </TouchableOpacity>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {driverCoords && pickupCoords ? (
          <Mapbox.MapView style={styles.map}>
            <Mapbox.Camera
              ref={setCameraRef}
              zoomLevel={14}
              centerCoordinate={driverCoords}
              animationDuration={1000}
            />

            {/* Pickup Marker */}
            <Mapbox.PointAnnotation
              id="pickup"
              coordinate={pickupCoords}
            >
              <View
                style={[
                  styles.markerPin,
                  { backgroundColor: T.accent },
                ]}
              >
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </Mapbox.PointAnnotation>

            {/* Destination Marker */}
            <Mapbox.PointAnnotation
              id="destination"
              coordinate={destinationCoords}
            >
              <View
                style={[
                  styles.markerPin,
                  { backgroundColor: T.success },
                ]}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            </Mapbox.PointAnnotation>

            {/* Driver Marker */}
            {driverCoords && (
              <Mapbox.PointAnnotation
                id="driver"
                coordinate={driverCoords}
              >
                <View
                  style={[
                    styles.driverMarker,
                    { borderColor: T.accent },
                  ]}
                >
                  {driver && driver.profileImage ? (
                    <Image
                      source={{ uri: driver.profileImage }}
                      style={styles.driverMarkerImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.driverMarkerFallback,
                        { backgroundColor: T.accent },
                      ]}
                    >
                      <Text style={styles.driverMarkerText}>
                        {driver
                          ? getInitials(
                              driver.firstName + " " + driver.lastName
                            )
                          : "D"}
                      </Text>
                    </View>
                  )}
                </View>
              </Mapbox.PointAnnotation>
            )}
          </Mapbox.MapView>
        ) : (
          <View style={[styles.mapPlaceholder, { backgroundColor: T.surface }]}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={[styles.placeholderText, { color: T.text, marginTop: 12 }]}>
              Loading map and location...
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet with Trip Info */}
      <View
        style={[
          styles.infoSheet,
          {
            backgroundColor: T.surface,
            borderTopColor: T.border,
          },
        ]}
      >
        <ScrollView
          scrollEnabled={true}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Trip Status Progress */}
          <StatusProgress currentStatus={tripStatus} T={T} />

          {/* Driver Info Card */}
          {driver && (
            <View
              style={[
                styles.driverInfoCard,
                {
                  backgroundColor: T.bg,
                  borderColor: T.border,
                },
              ]}
            >
              <View style={styles.driverInfoHeader}>
                {driver.profileImage ? (
                  <Image
                    source={{ uri: driver.profileImage }}
                    style={styles.driverAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.driverAvatarFallback,
                      { backgroundColor: T.accent },
                    ]}
                  >
                    <Text style={styles.driverInitials}>
                      {getInitials(driver.firstName + " " + driver.lastName)}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: T.text }]}>
                    {driver.firstName} {driver.lastName}
                  </Text>
                  <Text style={[styles.driverVehicle, { color: T.textMuted }]}>
                    {driver.vehicle?.make} {driver.vehicle?.model}
                  </Text>
                </View>

                {eta && (
                  <View
                    style={[
                      styles.etaBadge,
                      { backgroundColor: T.accent },
                    ]}
                  >
                    <Text style={styles.etaText}>{eta} min</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Pickup & Destination */}
          <View
            style={[
              styles.locationsCard,
              {
                backgroundColor: T.bg,
                borderColor: T.border,
              },
            ]}
          >
            <View style={styles.locationRow}>
              <Ionicons name="location" size={18} color={T.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.locationLabel,
                    { color: T.textMuted },
                  ]}
                >
                  Pickup
                </Text>
                <Text
                  style={[
                    styles.locationAddress,
                    { color: T.text },
                  ]}
                  numberOfLines={2}
                >
                  {ride?.pickupAddress || "Not specified"}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: T.border }]} />

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={18} color={T.success} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.locationLabel,
                    { color: T.textMuted },
                  ]}
                >
                  Destination
                </Text>
                <Text
                  style={[
                    styles.locationAddress,
                    { color: T.text },
                  ]}
                  numberOfLines={2}
                >
                  {ride?.destinationAddress || "Not specified"}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 14,
  },
  markerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    overflow: "hidden",
  },
  driverMarkerImage: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
  },
  driverMarkerFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  driverMarkerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  infoSheet: {
    maxHeight: 300,
    borderTopWidth: 1,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressItem: {
    flex: 1,
    alignItems: "center",
  },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  statusLine: {
    height: 2,
    flex: 1,
    marginHorizontal: 4,
  },
  driverInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  driverInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 12,
  },
  etaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  etaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  locationsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
});