/**
 * screens/EmergencyRideStatusScreen.js
 *
 * Emergency Ride Status & Real-time Driver Response
 * - Shows "Waiting for driver to accept" message
 * - Displays selected driver details
 * - Real-time updates via Socket.io for driver acceptance/rejection
 * - Shows driver response (accepted, rejected)
 * - Allow ride cancellation
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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { cancelEmergencyRide } from "../lib/EmergencyRideSlice";
import { useGuardianSocket } from "../hooks/useGuardianSocket";
import { getInitials } from "../utils/helpers";

export default function EmergencyRideStatusScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { rideId, ride: initialRide } = route.params || {};
  const { currentRide, selectedDriver } = useSelector(
    (state) => state.emergencyRides
  );
  const { userId } = useSelector((state) => state.users);
  const socket = useGuardianSocket();

  const [status, setStatus] = useState("WAITING"); // WAITING, ACCEPTED, REJECTED, CANCELLED
  const [isCancelling, setIsCancelling] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60); // Driver has 60 seconds to accept

  const ride = currentRide || initialRide;
  const driver = selectedDriver;

  // Socket.io listener for driver acceptance
  useEffect(() => {
    if (!socket) return;

    const handleDriverAccepted = (data) => {
      if (data.rideId === rideId) {
        setStatus("ACCEPTED");
        Toast.show({
          type: "success",
          text1: "Driver Accepted",
          text2: "Your driver is on the way!",
        });
        // Navigate to live tracking after delay
        setTimeout(() => {
          navigation.navigate("EmergencyRideTracking", {
            rideId,
            ride: data,
          });
        }, 2000);
      }
    };

    const handleDriverRejected = (data) => {
      if (data.rideId === rideId) {
        setStatus("REJECTED");
        Toast.show({
          type: "error",
          text1: "Driver Rejected",
          text2: "Going back to available drivers...",
        });
        // Navigate back to available drivers after delay
        setTimeout(() => {
          navigation.navigate("AvailableDrivers", {
            rideId,
          });
        }, 2000);
      }
    };

    const handleRideCancelled = (data) => {
      if (data.rideId === rideId) {
        setStatus("CANCELLED");
        Toast.show({
          type: "error",
          text1: "Ride Cancelled",
          text2: "The ride has been cancelled",
        });
      }
    };

    socket.on("emergency-ride:driver-accepted", handleDriverAccepted);
    socket.on("emergency-ride:driver-rejected", handleDriverRejected);
    socket.on("emergency-ride:ride-cancelled", handleRideCancelled);

    return () => {
      socket.off("emergency-ride:driver-accepted", handleDriverAccepted);
      socket.off("emergency-ride:driver-rejected", handleDriverRejected);
      socket.off("emergency-ride:ride-cancelled", handleRideCancelled);
    };
  }, [socket, rideId, navigation]);

  // Countdown timer for driver response
  useEffect(() => {
    if (status !== "WAITING" || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setStatus("REJECTED");
          Toast.show({
            type: "error",
            text1: "Request Expired",
            text2: "Driver did not respond in time",
          });
          setTimeout(() => {
            navigation.navigate("AvailableDrivers", { rideId });
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, timeRemaining, rideId, navigation]);

  const handleCancelRide = () => {
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride request?",
      [
        { text: "Keep Waiting", style: "cancel" },
        {
          text: "Cancel Ride",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              await dispatch(cancelEmergencyRide(rideId));
              setStatus("CANCELLED");
              Toast.show({
                type: "success",
                text1: "Ride Cancelled",
                text2: "Request cancelled",
              });
              setTimeout(() => {
                navigation.navigate("EmergencyRideMenu");
              }, 1500);
            } catch (error) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "Could not cancel ride",
              });
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  // Render waiting state
  if (status === "WAITING") {
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
          <View style={{ width: 24 }} />
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Ride Status
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Waiting Animation */}
          <View
            style={[
              styles.waitingCard,
              {
                backgroundColor: T.surface,
                borderColor: T.border,
              },
            ]}
          >
            <View style={[styles.spinnerBg, { backgroundColor: T.accentDim }]}>
              <ActivityIndicator color={T.accent} size="large" />
            </View>

            <Text style={[styles.waitingTitle, { color: T.text }]}>
              Waiting for Driver Response
            </Text>
            <Text style={[styles.waitingSubtitle, { color: T.textMuted }]}>
              Showing request to available drivers
            </Text>

            {/* Timer */}
            <View
              style={[
                styles.timerBox,
                { backgroundColor: T.accentDim, borderColor: T.accent },
              ]}
            >
              <Text style={[styles.timerText, { color: T.accent }]}>
                {timeRemaining}s
              </Text>
              <Text style={[styles.timerLabel, { color: T.textMuted }]}>
                Waiting for acceptance
              </Text>
            </View>
          </View>

          {/* Selected Driver Card */}
          {driver && (
            <View
              style={[
                styles.driverCard,
                {
                  backgroundColor: T.surface,
                  borderColor: T.border,
                  marginHorizontal: 16,
                  marginTop: 20,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: T.textMuted }]}>
                Selected Driver
              </Text>

              <View style={styles.driverHeader}>
                {/* Avatar */}
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
                      {getInitials(
                        driver.firstName + " " + driver.lastName
                      )}
                    </Text>
                  </View>
                )}

                {/* Driver Info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: T.text }]}>
                    {driver.firstName} {driver.lastName}
                  </Text>
                  {driver.rating && (
                    <View style={styles.ratingRow}>
                      <Ionicons
                        name="star"
                        size={14}
                        color="#f59e0b"
                      />
                      <Text style={[styles.ratingText, { color: T.textMuted }]}>
                        {driver.rating.toFixed(1)}
                      </Text>
                      {driver.completedEmergencyRides && (
                        <Text style={[styles.ridesText, { color: T.textMuted }]}>
                          • {driver.completedEmergencyRides} rides
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {driver.isVerified && (
                  <View
                    style={[
                      styles.verifiedBadge,
                      { backgroundColor: T.success },
                    ]}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>

              {/* Vehicle Info */}
              {driver.vehicle && (
                <View style={[styles.vehicleBox, { borderTopColor: T.border }]}>
                  <Ionicons name="car-outline" size={16} color={T.textMuted} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={[
                        styles.vehicleModel,
                        { color: T.text },
                      ]}
                    >
                      {driver.vehicle.make} {driver.vehicle.model}
                    </Text>
                    <Text style={[styles.vehicleReg, { color: T.textMuted }]}>
                      {driver.vehicle.registrationNumber}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Ride Details */}
          {ride && (
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: T.surface,
                  borderColor: T.border,
                  marginHorizontal: 16,
                  marginTop: 20,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: T.textMuted }]}>
                Ride Details
              </Text>

              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color={T.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.detailLabel, { color: T.textMuted }]}
                  >
                    Pickup
                  </Text>
                  <Text
                    style={[styles.detailValue, { color: T.text }]}
                    numberOfLines={2}
                  >
                    {ride.pickupAddress || "Not specified"}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: T.border }]} />

              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={T.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.detailLabel, { color: T.textMuted }]}
                  >
                    Destination
                  </Text>
                  <Text
                    style={[styles.detailValue, { color: T.text }]}
                    numberOfLines={2}
                  >
                    {ride.destinationAddress || "Not specified"}
                  </Text>
                </View>
              </View>

              {ride.finalPrice && (
                <>
                  <View style={[styles.divider, { backgroundColor: T.border }]} />

                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color={T.accent} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[styles.detailLabel, { color: T.textMuted }]}
                      >
                        Price
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: T.text, fontSize: 16, fontWeight: "600" },
                        ]}
                      >
                        ${ride.finalPrice.toFixed(2)}{" "}
                        {ride.currency || "USD"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
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
            onPress={handleCancelRide}
            disabled={isCancelling}
            style={{ opacity: isCancelling ? 0.6 : 1 }}
          >
            <View
              style={[
                styles.cancelButton,
                {
                  backgroundColor: T.surface,
                  borderColor: T.border,
                },
              ]}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color={T.accent} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={T.accent} />
                  <Text style={[styles.cancelButtonText, { color: T.accent }]}>
                    Cancel Ride
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render accepted state
  if (status === "ACCEPTED") {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
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
          <View style={{ width: 24 }} />
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Ride Accepted
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.center}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: T.success },
            ]}
          >
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={[styles.successTitle, { color: T.text }]}>
            Driver Accepted
          </Text>
          <Text style={[styles.successDesc, { color: T.textMuted }]}>
            Driver is on the way to pickup
          </Text>
        </View>
      </View>
    );
  }

  // Render rejected state
  if (status === "REJECTED") {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
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
          <View style={{ width: 24 }} />
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Request Expired
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.center}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: T.accentDim },
            ]}
          >
            <Ionicons name="close" size={48} color={T.accent} />
          </View>
          <Text style={[styles.errorTitle, { color: T.text }]}>
            Driver Did Not Respond
          </Text>
          <Text style={[styles.errorDesc, { color: T.textMuted }]}>
            Please select another driver
          </Text>
        </View>
      </View>
    );
  }

  // Render cancelled state
  if (status === "CANCELLED") {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
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
          <View style={{ width: 24 }} />
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Cancelled
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.center}>
          <View
            style={[
              styles.infoIcon,
              { backgroundColor: T.accentDim },
            ]}
          >
            <Ionicons name="information-circle" size={48} color={T.accent} />
          </View>
          <Text style={[styles.infoTitle, { color: T.text }]}>
            Ride Cancelled
          </Text>
          <Text style={[styles.infoDesc, { color: T.textMuted }]}>
            Your ride request has been cancelled
          </Text>
        </View>
      </View>
    );
  }
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingVertical: 20,
  },
  waitingCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  spinnerBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  waitingSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  timerBox: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    marginTop: 12,
  },
  timerText: {
    fontSize: 28,
    fontWeight: "700",
  },
  timerLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  driverCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  driverAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitials: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
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
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ridesText: {
    fontSize: 12,
  },
  verifiedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  vehicleModel: {
    fontSize: 14,
    fontWeight: "600",
  },
  vehicleReg: {
    fontSize: 12,
    marginTop: 2,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  successDesc: {
    fontSize: 15,
    textAlign: "center",
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorDesc: {
    fontSize: 15,
    textAlign: "center",
  },
  infoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  infoDesc: {
    fontSize: 15,
    textAlign: "center",
  },
});
