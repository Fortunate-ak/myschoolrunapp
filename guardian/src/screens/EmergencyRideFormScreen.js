/**
 * screens/EmergencyRideFormScreen.js
 *
 * Emergency Ride Request Form
 * - Displays selected child information
 * - Collects pickup address and coordinates
 * - Collects destination address and coordinates
 * - Collects trip type (e.g., "Medical", "Breakdown", "Emergency")
 * - Collects emergency reason
 * - Collects special instructions
 * - Validates form and submits to backend
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { requestEmergencyRide } from "../lib/EmergencyRideSlice";

// Trip type options
const TRIP_TYPES = [
  { id: "medical", label: "Medical Emergency" },
  { id: "breakdown", label: "Vehicle Breakdown" },
  { id: "accident", label: "Accident/Safety Issue" },
  { id: "other", label: "Other Emergency" },
];

// Emergency reason options
const EMERGENCY_REASONS = [
  { id: "student_sick", label: "Student feels sick" },
  { id: "student_injured", label: "Student injured" },
  { id: "behavioral", label: "Behavioral issue" },
  { id: "weather", label: "Bad weather" },
  { id: "traffic", label: "Traffic delay" },
  { id: "other", label: "Other" },
];

export default function EmergencyRideFormScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { student } = route.params || {};
  const { isSubmitting } = useSelector((state) => state.emergencyRides);

  // Form state
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLatitude, setPickupLatitude] = useState("");
  const [pickupLongitude, setPickupLongitude] = useState("");

  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationLatitude, setDestinationLatitude] = useState("");
  const [destinationLongitude, setDestinationLongitude] = useState("");

  const [selectedTripType, setSelectedTripType] = useState(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [requestedPickupTime, setRequestedPickupTime] = useState(new Date());

  const [showTripTypes, setShowTripTypes] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [errors, setErrors] = useState({});

  // Validate coordinates
  const isValidCoordinate = (lat, lng) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    return (
      !isNaN(latNum) &&
      !isNaN(lngNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      lngNum >= -180 &&
      lngNum <= 180
    );
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!pickupAddress.trim()) newErrors.pickupAddress = "Required";
    if (!isValidCoordinate(pickupLatitude, pickupLongitude)) {
      newErrors.pickupCoords = "Valid coordinates required";
    }

    if (!destinationAddress.trim()) newErrors.destinationAddress = "Required";
    if (!isValidCoordinate(destinationLatitude, destinationLongitude)) {
      newErrors.destinationCoords = "Valid coordinates required";
    }

    if (!selectedTripType) newErrors.tripType = "Required";
    if (!selectedReason) newErrors.reason = "Required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) {
      Toast.show({
        type: "error",
        text1: "Form Incomplete",
        text2: "Please fill in all required fields",
      });
      return;
    }

    const rideData = {
      studentId: student.id,
      pickupAddress: pickupAddress.trim(),
      pickupLatitude: parseFloat(pickupLatitude),
      pickupLongitude: parseFloat(pickupLongitude),
      destinationAddress: destinationAddress.trim(),
      destinationLatitude: parseFloat(destinationLatitude),
      destinationLongitude: parseFloat(destinationLongitude),
      tripType: selectedTripType,
      emergencyReason: selectedReason,
      requestedPickupTime: requestedPickupTime.toISOString(),
      specialInstructions: specialInstructions.trim() || null,
    };

    try {
      const result = await dispatch(requestEmergencyRide(rideData));
      if (result.payload) {
        Toast.show({
          type: "success",
          text1: "Emergency Ride Requested",
          text2: "Searching for available drivers...",
        });
        // Navigate to available drivers screen
        navigation.navigate("AvailableDrivers", {
          rideId: result.payload.id,
          ride: result.payload,
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: error.message || "Could not submit emergency ride request",
      });
    }
  };

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
          Emergency Ride
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Scrollable Content ────────────────────────────────────────── */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Child Info Card ───────────────────────────────────────────── */}
        {student && (
          <View
            style={[
              styles.childCard,
              {
                backgroundColor: T.surface,
                borderColor: T.border,
              },
            ]}
          >
            <View
              style={[
                styles.childAvatar,
                { backgroundColor: T.accent },
              ]}
            >
              <Text style={styles.childInitials}>
                {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.childName, { color: T.text }]}>
                {student.firstName} {student.lastName}
              </Text>
              {student.rollNo && (
                <Text style={[styles.childMeta, { color: T.textMuted }]}>
                  Roll: {student.rollNo}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ─── Section: Pickup Location ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Pickup Location
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: T.text }]}>Address *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: T.inputBg,
                  borderColor: errors.pickupAddress ? "#ff4444" : T.inputBorder,
                  color: T.text,
                  borderWidth: errors.pickupAddress ? 1.5 : 1,
                },
              ]}
              placeholder="e.g., 123 Main Street, New York, NY"
              placeholderTextColor={T.placeholder}
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
            {errors.pickupAddress && (
              <Text style={styles.errorText}>{errors.pickupAddress}</Text>
            )}
          </View>

          <View style={styles.coordinateRow}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, { color: T.text }]}>Latitude *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: errors.pickupCoords ? "#ff4444" : T.inputBorder,
                    color: T.text,
                    borderWidth: errors.pickupCoords ? 1.5 : 1,
                  },
                ]}
                placeholder="-73.9857"
                placeholderTextColor={T.placeholder}
                keyboardType="decimal-pad"
                value={pickupLatitude}
                onChangeText={setPickupLatitude}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.label, { color: T.text }]}>Longitude *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: errors.pickupCoords ? "#ff4444" : T.inputBorder,
                    color: T.text,
                    borderWidth: errors.pickupCoords ? 1.5 : 1,
                  },
                ]}
                placeholder="40.7580"
                placeholderTextColor={T.placeholder}
                keyboardType="decimal-pad"
                value={pickupLongitude}
                onChangeText={setPickupLongitude}
              />
            </View>
          </View>
          {errors.pickupCoords && (
            <Text style={styles.errorText}>{errors.pickupCoords}</Text>
          )}
        </View>

        {/* ─── Section: Destination Location ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Destination
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: T.text }]}>Address *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: T.inputBg,
                  borderColor: errors.destinationAddress ? "#ff4444" : T.inputBorder,
                  color: T.text,
                  borderWidth: errors.destinationAddress ? 1.5 : 1,
                },
              ]}
              placeholder="e.g., School Name, Address"
              placeholderTextColor={T.placeholder}
              value={destinationAddress}
              onChangeText={setDestinationAddress}
            />
            {errors.destinationAddress && (
              <Text style={styles.errorText}>{errors.destinationAddress}</Text>
            )}
          </View>

          <View style={styles.coordinateRow}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, { color: T.text }]}>Latitude *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: errors.destinationCoords ? "#ff4444" : T.inputBorder,
                    color: T.text,
                    borderWidth: errors.destinationCoords ? 1.5 : 1,
                  },
                ]}
                placeholder="-73.9857"
                placeholderTextColor={T.placeholder}
                keyboardType="decimal-pad"
                value={destinationLatitude}
                onChangeText={setDestinationLatitude}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.label, { color: T.text }]}>Longitude *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: errors.destinationCoords ? "#ff4444" : T.inputBorder,
                    color: T.text,
                    borderWidth: errors.destinationCoords ? 1.5 : 1,
                  },
                ]}
                placeholder="40.7580"
                placeholderTextColor={T.placeholder}
                keyboardType="decimal-pad"
                value={destinationLongitude}
                onChangeText={setDestinationLongitude}
              />
            </View>
          </View>
          {errors.destinationCoords && (
            <Text style={styles.errorText}>{errors.destinationCoords}</Text>
          )}
        </View>

        {/* ─── Section: Trip Type ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Trip Type *
          </Text>
          {errors.tripType && (
            <Text style={[styles.errorText, { marginBottom: 8 }]}>
              {errors.tripType}
            </Text>
          )}
          <View style={styles.optionsGrid}>
            {TRIP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedTripType(type.id)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor:
                      selectedTripType === type.id ? T.accentDim : T.surface,
                    borderColor:
                      selectedTripType === type.id ? T.accent : T.border,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        selectedTripType === type.id ? T.accent : T.text,
                    },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Section: Emergency Reason ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Emergency Reason *
          </Text>
          {errors.reason && (
            <Text style={[styles.errorText, { marginBottom: 8 }]}>
              {errors.reason}
            </Text>
          )}
          <View style={styles.reasonsList}>
            {EMERGENCY_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                onPress={() => setSelectedReason(reason.id)}
                style={[
                  styles.reasonItem,
                  {
                    backgroundColor:
                      selectedReason === reason.id ? T.accentDim : "transparent",
                    borderColor:
                      selectedReason === reason.id ? T.accent : T.border,
                    borderBottomWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.reasonRadio,
                    {
                      borderColor: T.accent,
                      backgroundColor:
                        selectedReason === reason.id
                          ? T.accent
                          : "transparent",
                    },
                  ]}
                >
                  {selectedReason === reason.id && (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  )}
                </View>
                <Text style={[styles.reasonLabel, { color: T.text }]}>
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Section: Special Instructions ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Special Instructions (Optional)
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: T.inputBg,
                borderColor: T.inputBorder,
                color: T.text,
              },
            ]}
            placeholder="e.g., allergies, medications, special needs..."
            placeholderTextColor={T.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
          />
        </View>

        {/* ─── Info Box ──────────────────────────────────────────────────── */}
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: T.infoDim,
              borderColor: T.info,
            },
          ]}
        >
          <Ionicons
            name="information-circle"
            size={20}
            color={T.info}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: T.text }]}>
              Pricing Information
            </Text>
            <Text style={[styles.infoText, { color: T.textMuted }]}>
              Emergency rides are charged at a per-use rate. You'll see the price
              and available drivers after submission.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── Footer Button ────────────────────────────────────────────────── */}
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
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={{
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["#ff6b6b", "#e83030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Search Drivers</Text>
                <Ionicons name="search" size={18} color="#fff" />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  childInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  childMeta: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  coordinateRow: {
    flexDirection: "row",
  },
  textArea: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    color: "#ff4444",
    marginTop: 4,
  },
  optionsGrid: {
    gap: 10,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reasonsList: {
    borderRadius: 8,
    overflow: "hidden",
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
