// SetRouteScreen.js - Add vehicle selection
import React, { useCallback, useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { addMinutesToTime, formatTime } from "../utils/helpers";
import { useDispatch, useSelector } from "react-redux";
import { getRouteDirections } from "../utils/mapbox";
import Toast from "react-native-toast-message";
import { createVehicleRoute } from "../lib/VehicleRoutesSlice";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import TimePickerField from "../components/TimePickerField";
import MapStopPicker from "../components/MapStopPicker";
import { LinearGradient } from "expo-linear-gradient";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getDriverVehicles } from "../lib/VehicleSlice";
import { updateHasSelectedRoute } from "../lib/AuthSlice";

const StopRow = ({ item, index, drag, isActive, onRemove }) => (
  <TouchableOpacity
    style={[styles.stopRow, isActive && styles.stopRowActive]}
    onLongPress={drag}
    activeOpacity={0.85}
    delayLongPress={150}
  >
    <View style={styles.stopOrderBadge}>
      <Text style={styles.stopOrderText}>{index + 1}</Text>
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.stopName} numberOfLines={1}>
        {item.stopName || item.name || `Stop ${index + 1}`}
      </Text>
      <Text style={styles.stopAddress} numberOfLines={1}>
        {item.location?.address || item.address || ""}
      </Text>
    </View>

    <Ionicons
      name="reorder-three-outline"
      size={20}
      color="rgba(255,255,255,0.25)"
      style={{ marginRight: 8 }}
    />

    <TouchableOpacity
      style={styles.stopRemoveBtn}
      onPress={() => onRemove(index)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
    </TouchableOpacity>
  </TouchableOpacity>
);

export default function SetRouteScreen({ navigation, route, onSkip }) {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.vehicleroutes);
  const { driverProfile } = useSelector((state) => state.auth);
  const { drivervehicles } = useSelector((state) => state.vehicles);

  // Get vehicles from the driver profile or fetch them
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [routeName, setRouteName] = useState("");
  const [routeType, setRouteType] = useState("both");
  const [stops, setStops] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [estimatedEndTime, setEstimatedEndTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [mapVisible, setMapVisible] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Fetch vehicles on mount
  useEffect(() => {
    dispatch(getDriverVehicles());
  }, []);

  const calculateStopTimes = useCallback(
    (stopsList, startTimeStr, travelTimes) => {
      if (!stopsList.length || !startTimeStr) return stopsList;

      let currentTime = startTimeStr;

      return stopsList.map((stop, index) => {
        let pickupTime = null;
        let dropoffTime = null;
        let waitTime = 2;

        if (index === 0) {
          pickupTime = currentTime;
          dropoffTime = addMinutesToTime(currentTime, waitTime);
          currentTime = dropoffTime;
        } else {
          const travelTime = travelTimes[index - 1] || 0;
          const arrivalTime = addMinutesToTime(currentTime, travelTime);
          waitTime = Math.max(2, Math.round(travelTime * 0.1));
          pickupTime = arrivalTime;
          dropoffTime = addMinutesToTime(arrivalTime, waitTime);
          currentTime = dropoffTime;
        }

        return {
          ...stop,
          scheduledPickupTime: pickupTime,
          scheduledDropoffTime: dropoffTime,
          estimatedWaitTime: waitTime,
        };
      });
    },
    [],
  );

  const recalculateAllTimes = useCallback(
    async (currentStops, currentStartTime) => {
      if (currentStops.length < 2 || !currentStartTime) {
        setEstimatedDuration(0);
        setTotalDistance(0);
        setEstimatedEndTime("");
        if (currentStops.length < 2) {
          setStops(
            currentStops.map((s) => ({
              ...s,
              scheduledPickupTime: null,
              scheduledDropoffTime: null,
              estimatedWaitTime: 2,
            })),
          );
        }
        return;
      }

      try {
        setCalculating(true);
        const { durationMins, distanceKm, segmentDurations } =
          await getRouteDirections(currentStops);

        setEstimatedDuration(durationMins);
        setTotalDistance(distanceKm);
        setEstimatedEndTime(addMinutesToTime(currentStartTime, durationMins));

        const stopsWithTimes = calculateStopTimes(
          currentStops,
          currentStartTime,
          segmentDurations || [],
        );

        setStops(stopsWithTimes);
      } catch (e) {
        console.warn("Directions error:", e.message);
        const stopsCount = currentStops.length;
        const avgSegmentTime =
          Math.round(estimatedDuration / (stopsCount - 1)) || 5;
        const segmentDurations = Array(stopsCount - 1).fill(avgSegmentTime);

        const stopsWithTimes = calculateStopTimes(
          currentStops,
          currentStartTime,
          segmentDurations,
        );
        setStops(stopsWithTimes);
      } finally {
        setCalculating(false);
      }
    },
    [calculateStopTimes, estimatedDuration],
  );

  const handleConfirmStop = (stop) => {
    setStops((prev) => {
      const newStop = {
        id: stop.id || `temp_${Date.now()}_${prev.length}`,
        stopName: stop.stopName || stop.name,
        stopType: "school",
        location: stop.location || {
          latitude: stop.latitude ?? null,
          longitude: stop.longitude ?? null,
          address: stop.address || "",
        },
        stopOrder: prev.length + 1,
        scheduledPickupTime: stop.scheduledPickupTime || null,
        scheduledDropoffTime: stop.scheduledDropoffTime || null,
        estimatedWaitTime: stop.estimatedWaitTime || 2,
      };
      const next = [...prev, newStop];
      recalcEndTime(next, startTime);
      return next;
    });
  };

  const handleRemoveStop = (index) => {
    setStops((prev) => {
      const next = prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stopOrder: i + 1 }));
      recalcEndTime(next, startTime);
      return next;
    });
  };

  const handleReorder = ({ data }) => {
    const reordered = data.map((s, i) => ({ ...s, stopOrder: i + 1 }));
    setStops(reordered);
    recalcEndTime(reordered, startTime);
  };

  const recalcEndTime = useCallback(async (currentStops, currentStartTime) => {
    if (currentStops.length < 2 || !currentStartTime) {
      setEstimatedDuration(0);
      setTotalDistance(0);
      setEstimatedEndTime("");
      return;
    }

    try {
      setCalculating(true);
      const { durationMins, distanceKm } =
        await getRouteDirections(currentStops);
      setEstimatedDuration(durationMins);
      setTotalDistance(distanceKm);
      setEstimatedEndTime(addMinutesToTime(currentStartTime, durationMins));
    } catch (error) {
      console.warn("Directions error", error.message);
    } finally {
      setCalculating(false);
    }
  }, []);

  const handleStartTimeChange = (value) => {
    setStartTime(value);
    recalcEndTime(stops, value);
  };

  const validate = () => {
    if (!routeName.trim()) {
      Toast.show({
        type: "error",
        text1: "Route name not provided",
        text2: "Please give your route a name",
      });
      return false;
    }

    if (!selectedVehicle) {
      Toast.show({
        type: "error",
        text1: "No vehicle selected",
        text2: "Please select a vehicle for this route",
      });
      return false;
    }

    if (stops.length < 2) {
      Toast.show({
        type: "error",
        text1: "Not enough stops",
        text2: "A route needs at least a start and end stop.",
      });
      return false;
    }

    if (!startTime) {
      Toast.show({
        type: "error",
        text1: "Trip start time not provided",
        text2: "Please select start time for trip",
      });
      return false;
    }

    const stopMissingCoords = stops.find(
      (s) => s.location?.latitude == null || s.location?.longitude == null,
    );
    if (stopMissingCoords) {
      Toast.show({
        type: "error",
        text1: "Stop missing coordinates",
        text2: `"${stopMissingCoords.stopName || stopMissingCoords.name || "A stop"}" needs to be placed on the map`,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const formattedStops = stops.map((s, index) => ({
      stopName: s.stopName || s.name || `Stop ${index + 1}`,
      stopOrder: index + 1,
      stopType: "school",
      location: {
        latitude: Number(s.location?.latitude ?? s.latitude),
        longitude: Number(s.location?.longitude ?? s.longitude),
        address: s.location?.address || s.address || "",
      },
      scheduledDropoffTime: s.scheduledDropoffTime
        ? formatTime(s.scheduledDropoffTime)
        : null,
      scheduledPickupTime: s.scheduledPickupTime
        ? formatTime(s.scheduledPickupTime)
        : null,
      estimatedWaitTime: s.estimatedWaitTime || 2,
    }));

    const payload = {
      routeName: routeName.trim(),
      vehicleId: selectedVehicle.id,
      routeType,
      startTime: formatTime(startTime),
      estimatedDuration,
      estimatedEndTime: formatTime(estimatedEndTime),
      totalDistance,
      stops: formattedStops,
    };

    const result = await dispatch(createVehicleRoute(payload));

    if (createVehicleRoute.fulfilled.match(result)) {
      await dispatch(updateHasSelectedRoute(false));
      Toast.show({
        type: "success",
        text1: "Route Created!",
        text2: "Your route has been set up successfully.",
      });
      // No manual navigation needed — App.js swaps SetRoute -> RouteSelection
      // automatically now that driverRoutes (and hasRoutes) has updated.
    } else {
      Toast.show({
        type: "error",
        text1: "Failed to create route",
        text2: result.error?.message || "Please try again",
      });
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const renderVehicleItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.vehicleOption,
        selectedVehicle?.id === item.id && styles.vehicleOptionSelected,
      ]}
      onPress={() => {
        setSelectedVehicle(item);
        setShowVehicleModal(false);
      }}
    >
      <View style={styles.vehicleIcon}>
        <Ionicons name="car-outline" size={24} color="#e83030" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.vehicleName}>
          {item.carMake} {item.carModel}
        </Text>
        <Text style={styles.vehicleReg}>{item.registrationNumber}</Text>
      </View>
      {selectedVehicle?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#e83030" />
      )}
    </TouchableOpacity>
  );

  useEffect(() => {
    if (stops.length >= 2 && startTime) {
      recalculateAllTimes(stops, startTime);
    }
  }, [stops.length, startTime]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Set Up Your Route</Text>
          <Text style={styles.headerSub}>
            Drivers need a route to start trips
          </Text>
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Route Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Route Name<Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="map-outline"
                size={16}
                color="rgba(255,255,255,0.3)"
                style={styles.fieldIcon}
              />
              <TextInput
                style={[styles.input, { paddingLeft: 36 }]}
                placeholder="e.g. Borrowdale – City Centre Route"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={routeName}
                onChangeText={setRouteName}
              />
            </View>
          </View>

          {/* Vehicle Selection */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Select Vehicle<Text style={styles.required}> *</Text>
            </Text>
            <TouchableOpacity
              style={styles.vehicleSelector}
              onPress={() => setShowVehicleModal(true)}
              activeOpacity={0.8}
            >
              {selectedVehicle ? (
                <>
                  <View style={styles.vehicleSelectorLeft}>
                    <Ionicons name="car-outline" size={20} color="#e83030" />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.vehicleSelectorName}>
                        {selectedVehicle.carMake} {selectedVehicle.carModel}
                      </Text>
                      <Text style={styles.vehicleSelectorReg}>
                        {selectedVehicle.registrationNumber}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.vehicleSelectorPlaceholder}>
                    {drivervehicles.length === 0
                      ? "No vehicles found. Please add a vehicle first."
                      : "Select a vehicle for this route"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color="rgba(255,255,255,0.4)"
                  />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Route Type */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Route Type<Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.routeTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.routeTypeOption,
                  routeType === "pickup" && styles.routeTypeSelected,
                ]}
                onPress={() => setRouteType("pickup")}
              >
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={18}
                  color={
                    routeType === "pickup" ? "#e83030" : "rgba(255,255,255,0.4)"
                  }
                />
                <Text
                  style={[
                    styles.routeTypeText,
                    routeType === "pickup" && styles.routeTypeTextSelected,
                  ]}
                >
                  Pickup Only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeTypeOption,
                  routeType === "dropoff" && styles.routeTypeSelected,
                ]}
                onPress={() => setRouteType("dropoff")}
              >
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={18}
                  color={
                    routeType === "dropoff"
                      ? "#e83030"
                      : "rgba(255,255,255,0.4)"
                  }
                />
                <Text
                  style={[
                    styles.routeTypeText,
                    routeType === "dropoff" && styles.routeTypeTextSelected,
                  ]}
                >
                  Dropoff Only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeTypeOption,
                  routeType === "both" && styles.routeTypeSelected,
                ]}
                onPress={() => setRouteType("both")}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={18}
                  color={
                    routeType === "both" ? "#e83030" : "rgba(255,255,255,0.4)"
                  }
                />
                <Text
                  style={[
                    styles.routeTypeText,
                    routeType === "both" && styles.routeTypeTextSelected,
                  ]}
                >
                  Both
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stops Section */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="navigate-outline" size={18} color="#e83030" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>School Pickup Points</Text>
              <Text style={styles.sectionSubtitle}>
                {stops.length === 0
                  ? "Add at least 2 stops — start and end"
                  : `${stops.length} stop${stops.length > 1 ? "s" : ""} added · long-press to reorder`}
              </Text>
            </View>
          </View>

          {stops.length > 0 && (
            <GestureHandlerRootView style={styles.stopsListWrap}>
              <DraggableFlatList
                data={stops}
                keyExtractor={(item, index) =>
                  `${item.stopName || item.name}-${index}`
                }
                onDragEnd={handleReorder}
                scrollEnabled={false}
                renderItem={({ item, index, drag, isActive }) => (
                  <StopRow
                    item={item}
                    index={index}
                    drag={drag}
                    isActive={isActive}
                    onRemove={handleRemoveStop}
                  />
                )}
              />
            </GestureHandlerRootView>
          )}

          <TouchableOpacity
            style={styles.addStopBtn}
            onPress={() => setMapVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#e83030" />
            <Text style={styles.addStopText}>Add school on Map</Text>
          </TouchableOpacity>

          {/* Trip Timing */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="time-outline" size={18} color="#e83030" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Trip Timing</Text>
              <Text style={styles.sectionSubtitle}>
                Times auto-calculated based on route
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TimePickerField
                label="Start Time"
                value={startTime}
                onChange={handleStartTimeChange}
                icon="play-outline"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>End Time</Text>
              <View style={[styles.inputWrapper, styles.readOnlyField]}>
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color="rgba(255,255,255,0.3)"
                  style={styles.fieldIcon}
                />
                {calculating ? (
                  <ActivityIndicator
                    size="small"
                    color="#e83030"
                    style={{ marginLeft: 36 }}
                  />
                ) : (
                  <Text
                    style={[
                      styles.readOnlyText,
                      { paddingLeft: 36 },
                      !estimatedEndTime && styles.fieldPlaceholder,
                    ]}
                  >
                    {estimatedEndTime || "Auto-calculated"}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {estimatedDuration > 0 && (
            <View style={styles.etaBadge}>
              <Ionicons name="speedometer-outline" size={13} color="#e83030" />
              <Text style={styles.etaText}>
                Estimated trip: {estimatedDuration} mins ·{" "}
                {totalDistance.toFixed(1)} km
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle-outline" size={14} color="#e83030" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.primaryBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons
                name={isLoading ? "hourglass-outline" : "checkmark-circle"}
                size={18}
                color="#fff"
              />
              <Text style={styles.primaryBtnText}>
                {isLoading ? "Saving Route…" : "Save Route"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipLink} onPress={handleSkip}>
            <Text style={styles.skipLinkText}>I'll set this up later</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Vehicle Selection Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {drivervehicles.length === 0 ? (
              <View style={styles.emptyVehicles}>
                <Ionicons
                  name="car-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.emptyVehiclesText}>No vehicles found</Text>
                <Text style={styles.emptyVehiclesSub}>
                  Please add a vehicle to your profile first.
                </Text>
              </View>
            ) : (
              <FlatList
                data={drivervehicles}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderVehicleItem}
                contentContainerStyle={styles.vehiclesList}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Map Stop Picker */}
      <MapStopPicker
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        onConfirm={handleConfirmStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  skipBtn: { width: 50, alignItems: "flex-end" },
  skipText: { fontSize: 14, color: "#e83030", fontWeight: "600" },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

  fieldWrap: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 7,
  },
  required: { color: "#e83030" },
  inputWrapper: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readOnlyField: { backgroundColor: "#161616" },
  fieldIcon: { position: "absolute", left: 13 },
  input: { color: "#fff", fontSize: 14, flex: 1, paddingLeft: 4 },
  readOnlyText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  fieldPlaceholder: { color: "rgba(255,255,255,0.25)" },

  // Vehicle Selector
  vehicleSelector: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  vehicleSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleSelectorName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  vehicleSelectorReg: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
  },
  vehicleSelectorPlaceholder: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },

  // Route Type
  routeTypeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  routeTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  routeTypeSelected: {
    borderColor: "#e83030",
    backgroundColor: "rgba(232,48,48,0.1)",
  },
  routeTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  routeTypeTextSelected: {
    color: "#e83030",
  },

  // Stops
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    marginTop: 6,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(232,48,48,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,48,48,0.2)",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  sectionSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 1,
  },

  stopsListWrap: { marginBottom: 12 },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  stopRowActive: { borderColor: "#e83030", backgroundColor: "#1a0808" },
  stopOrderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(232,48,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stopOrderText: { fontSize: 12, fontWeight: "700", color: "#e83030" },
  stopName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  stopAddress: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  stopRemoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "rgba(232,48,48,0.3)",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  addStopText: { color: "#e83030", fontSize: 14, fontWeight: "700" },

  row: { flexDirection: "row" },

  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(232,48,48,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  etaText: { fontSize: 12, color: "#e83030", fontWeight: "600" },

  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(232,48,48,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 12, color: "#e83030", flex: 1 },

  primaryBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 14,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  primaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  skipLink: { alignItems: "center", paddingVertical: 6 },
  skipLinkText: { fontSize: 13, color: "rgba(255,255,255,0.4)" },

  // Vehicle Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  vehiclesList: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#141010",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  vehicleOptionSelected: {
    borderColor: "#e83030",
    backgroundColor: "rgba(232,48,48,0.08)",
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(232,48,48,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  vehicleReg: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  emptyVehicles: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyVehiclesText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
  },
  emptyVehiclesSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 4,
  },
});
