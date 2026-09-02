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
import {
  createVehicleRoute,
  updateVehicleRoute,
  deleteStopFromRoute,
} from "../lib/VehicleRoutesSlice";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import TimePickerField from "../components/TimePickerField";
import MapStopPicker from "../components/MapStopPicker";
import { LinearGradient } from "expo-linear-gradient";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getDriverVehicles } from "../lib/VehicleSlice";
import { useTheme } from "../contexts/ThemeContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_SHORT = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const ROUTE_TYPES = [
  { value: "pickup", label: "Pickup Only", icon: "arrow-up-circle-outline" },
  {
    value: "dropoff",
    label: "Dropoff Only",
    icon: "arrow-down-circle-outline",
  },
  { value: "both", label: "Both", icon: "swap-vertical-outline" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={18} color="#e83030" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function StopRow({ item, index, drag, isActive, onRemove }) {
  // NOTE: react-native-draggable-flatlist can invoke renderItem with
  // `index === null` (its internal shared-value position map isn't always
  // in sync with the render pass — e.g. right after the list data changes).
  // Never rely on `index` for the displayed order or for identifying which
  // stop to act on: use the stop's own `stopOrder`/`id` instead, and fall
  // back gracefully if `index` happens to be missing.
  const displayOrder =
    item.stopOrder ?? (Number.isFinite(index) ? index + 1 : "");

  return (
    <TouchableOpacity
      style={[styles.stopRow, isActive && styles.stopRowActive]}
      onLongPress={drag}
      activeOpacity={0.85}
      delayLongPress={150}
    >
      <View style={styles.stopOrderBadge}>
        <Text style={styles.stopOrderText}>{displayOrder}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.stopName} numberOfLines={1}>
          {item.stopName || item.name || `Stop ${displayOrder}`}
        </Text>
        <Text style={styles.stopAddress} numberOfLines={1}>
          {item.location?.address || item.address || ""}
        </Text>
        {item.scheduledPickupTime ? (
          <Text style={styles.stopTime}>
            {item.scheduledPickupTime?.slice(0, 5)}
            {item.scheduledDropoffTime
              ? ` → ${item.scheduledDropoffTime.slice(0, 5)}`
              : ""}
          </Text>
        ) : null}
      </View>

      <Ionicons
        name="reorder-three-outline"
        size={20}
        color="rgba(255,255,255,0.25)"
        style={{ marginRight: 8 }}
      />

      <TouchableOpacity
        style={styles.stopRemoveBtn}
        onPress={() => onRemove(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CreateRouteScreen({ navigation, route: navRoute }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((s) => s.vehicleroutes);
  const { drivervehicles } = useSelector((s) => s.vehicles);

  // Edit mode — populated when navigating from RoutesScreen with editRoute param
  const editRoute = navRoute?.params?.editRoute ?? null;
  const isEditMode = !!editRoute;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [routeName, setRouteName] = useState(editRoute?.routeName ?? "");
  const [routeType, setRouteType] = useState(editRoute?.routeType ?? "both");
  const [activeDays, setActiveDays] = useState(
    editRoute?.activeDays ?? [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ],
  );
  const [stops, setStops] = useState(() =>
    editRoute?.stops
      ? [...editRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder)
      : [],
  );
  const [startTime, setStartTime] = useState(
    editRoute?.startTime?.slice(0, 5) ?? "",
  );
  const [estimatedEndTime, setEstimatedEndTime] = useState(
    editRoute?.estimatedEndTime?.slice(0, 5) ?? "",
  );
  const [estimatedDuration, setEstimatedDuration] = useState(
    editRoute?.estimatedDuration ?? 0,
  );
  const [totalDistance, setTotalDistance] = useState(
    editRoute?.totalDistance ?? 0,
  );

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Fetch vehicles on mount
  useEffect(() => {
    dispatch(getDriverVehicles());
  }, []);

  // Pre-select vehicle when vehicles load (edit mode or vehicleId param)
  useEffect(() => {
    if (!drivervehicles?.length) return;
    const targetId = editRoute?.vehicleId ?? navRoute?.params?.vehicleId;
    if (targetId) {
      const match = drivervehicles.find((v) => v.id === targetId);
      if (match) setSelectedVehicle(match);
    }
  }, [drivervehicles]);

  // Recalculate times when stops or startTime changes (edit pre-fill)
  useEffect(() => {
    if (stops.length >= 2 && startTime) {
      recalcEndTime(stops, startTime);
    }
  }, [stops.length, startTime]);

  // ── Time calculation helpers ───────────────────────────────────────────────
  const calculateStopTimes = useCallback(
    (stopsList, startTimeStr, travelTimes) => {
      if (!stopsList.length || !startTimeStr) return stopsList;
      let currentTime = startTimeStr;
      return stopsList.map((stop, index) => {
        const waitTime = Math.max(
          2,
          Math.round((travelTimes[index - 1] || 5) * 0.1),
        );
        if (index === 0) {
          const dropoffTime = addMinutesToTime(currentTime, 2);
          currentTime = dropoffTime;
          return {
            ...stop,
            scheduledPickupTime: startTimeStr,
            scheduledDropoffTime: dropoffTime,
            estimatedWaitTime: 2,
          };
        }
        const travelTime = travelTimes[index - 1] || 0;
        const arrivalTime = addMinutesToTime(currentTime, travelTime);
        const dropoffTime = addMinutesToTime(arrivalTime, waitTime);
        currentTime = dropoffTime;
        return {
          ...stop,
          scheduledPickupTime: arrivalTime,
          scheduledDropoffTime: dropoffTime,
          estimatedWaitTime: waitTime,
        };
      });
    },
    [],
  );

  const recalcEndTime = useCallback(
    async (currentStops, currentStartTime) => {
      if (currentStops.length < 2 || !currentStartTime) {
        setEstimatedDuration(0);
        setTotalDistance(0);
        setEstimatedEndTime("");
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
        console.warn("[CreateRoute] Directions error:", e.message);
        const avgSegmentTime =
          Math.round(
            estimatedDuration / Math.max(currentStops.length - 1, 1),
          ) || 5;
        const fallbackSegments = Array(currentStops.length - 1).fill(
          avgSegmentTime,
        );
        setStops(
          calculateStopTimes(currentStops, currentStartTime, fallbackSegments),
        );
      } finally {
        setCalculating(false);
      }
    },
    [calculateStopTimes, estimatedDuration],
  );

  // ── Stop handlers ──────────────────────────────────────────────────────────
  const handleConfirmStop = (stop) => {
    setStops((prev) => {
      const newStop = {
        id: stop.id || `temp_${Date.now()}_${prev.length}`,
        stopName: stop.stopName || stop.name,
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

  const handleRemoveStop = async (stopToRemove) => {
    // Safety check
    if (!stopToRemove) {
      console.warn("Attempted to remove undefined stop:", stopToRemove);
      return;
    }

    // Identify the stop by its stable id rather than a positional index —
    // DraggableFlatList's renderItem index can be null/stale, but the stop
    // object itself (and its id) is always the real thing being removed.
    const removeLocally = () => {
      setStops((prev) => {
        const next = prev
          .filter((s) => s.id !== stopToRemove.id)
          .map((s, i) => ({ ...s, stopOrder: i + 1 }));
        recalcEndTime(next, startTime);
        return next;
      });
    };

    // Check if this is a real stop from the server. temp_* IDs are locally
    // created stops that haven't been saved yet — everything else came back
    // from the backend (string IDs like "stop_...", never numeric).
    const isExistingStop =
      !!stopToRemove.id && !String(stopToRemove.id).startsWith("temp_");

    if (isExistingStop) {
      try {
        // Show loading indicator
        setCalculating(true);

        // Delete via API - pass the stop ID
        await dispatch(deleteStopFromRoute(stopToRemove.id)).unwrap();

        // Remove from local state after successful API deletion
        removeLocally();

        Toast.show({
          type: "success",
          text1: "Stop removed",
          text2: "The stop has been deleted from the route",
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Failed to delete stop",
          text2:
            typeof error === "string"
              ? error
              : error.message || "Please try again",
        });
      } finally {
        setCalculating(false);
      }
    } else {
      // For temporary/local stops (created but not yet saved to server)
      // Just remove from local state
      removeLocally();
    }
  };

  const handleReorder = ({ data }) => {
    const reordered = data.map((s, i) => ({ ...s, stopOrder: i + 1 }));
    setStops(reordered);
    recalcEndTime(reordered, startTime);
  };

  const handleStartTimeChange = (value) => {
    setStartTime(value);
    recalcEndTime(stops, value);
  };

  // ── Active days toggle ─────────────────────────────────────────────────────
  const toggleDay = (day) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    if (!routeName.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing route name",
        text2: "Please enter a name for this route",
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
        text2: "A route needs at least a start and end stop",
      });
      return false;
    }
    if (!startTime) {
      Toast.show({
        type: "error",
        text1: "Missing start time",
        text2: "Please select the trip start time",
      });
      return false;
    }
    if (activeDays.length === 0) {
      Toast.show({
        type: "error",
        text1: "No active days",
        text2: "Select at least one day this route runs",
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    const formattedStops = stops.map((s, index) => ({
      stopName: s.stopName || s.name || `Stop ${index + 1}`,
      stopOrder: index + 1,
      location: {
        latitude: Number(s.location?.latitude ?? s.latitude),
        longitude: Number(s.location?.longitude ?? s.longitude),
        address: s.location?.address || s.address || "",
      },
      scheduledPickupTime: s.scheduledPickupTime
        ? formatTime(s.scheduledPickupTime)
        : null,
      scheduledDropoffTime: s.scheduledDropoffTime
        ? formatTime(s.scheduledDropoffTime)
        : null,
      estimatedWaitTime: s.estimatedWaitTime || 2,
    }));

    const payload = {
      routeName: routeName.trim(),
      vehicleId: selectedVehicle.id,
      routeType,
      activeDays,
      startTime: formatTime(startTime),
      estimatedEndTime: formatTime(estimatedEndTime),
      estimatedDuration,
      totalDistance,
      stops: formattedStops,
    };

    let result;
    if (isEditMode) {
      result = await dispatch(
        updateVehicleRoute({ id: editRoute.id, ...payload }),
      );
    } else {
      result = await dispatch(createVehicleRoute(payload));
    }

    const thunk = isEditMode ? updateVehicleRoute : createVehicleRoute;

    if (thunk.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: isEditMode ? "Route Updated!" : "Route Created!",
        text2: isEditMode
          ? "Your route has been updated successfully."
          : "Your route has been set up successfully.",
      });
      navigation.goBack();
    } else {
      Toast.show({
        type: "error",
        text1: isEditMode ? "Failed to update route" : "Failed to create route",
        text2: result.payload || result.error?.message || "Please try again",
      });
    }
  };

  // ── Vehicle modal item ─────────────────────────────────────────────────────
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
        {item.capacity ? (
          <Text style={styles.vehicleCap}>Capacity: {item.capacity}</Text>
        ) : null}
      </View>
      {selectedVehicle?.id === item.id && (
        <Ionicons name="checkmark-circle" size={22} color="#e83030" />
      )}
    </TouchableOpacity>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: T.border }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: T.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: T.text }]}>
              {isEditMode ? "Edit Route" : "Create Route"}
            </Text>
            <Text style={[styles.headerSub, { color: T.textMuted }]}>
              {isEditMode
                ? "Update your route details"
                : "Set up a new driving route"}
            </Text>
          </View>
          <View style={{ width: 36 }} />
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
            {/* ── Route Details ── */}
            <SectionHeader
              icon="map-outline"
              title="Route Details"
              subtitle="Name and type of this route"
            />

            {/* Route name */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: T.textSecondary }]}>
                Route Name<Text style={styles.required}> *</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: T.inputBg, borderColor: T.inputBorder },
                ]}
              >
                <Ionicons
                  name="map-outline"
                  size={16}
                  color={T.textMuted}
                  style={styles.fieldIcon}
                />
                <TextInput
                  style={[styles.input, { color: T.text, paddingLeft: 36 }]}
                  placeholder="e.g. Borrowdale – City Centre Route"
                  placeholderTextColor={T.placeholder}
                  value={routeName}
                  onChangeText={setRouteName}
                />
              </View>
            </View>

            {/* Vehicle selector */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: T.textSecondary }]}>
                Vehicle<Text style={styles.required}> *</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.vehicleSelector,
                  { backgroundColor: T.inputBg, borderColor: T.inputBorder },
                ]}
                onPress={() => setShowVehicleModal(true)}
                activeOpacity={0.8}
              >
                {selectedVehicle ? (
                  <>
                    <View style={styles.vehicleSelectorLeft}>
                      <View
                        style={[
                          styles.vehicleSelectorIconBg,
                          { backgroundColor: T.accentDim },
                        ]}
                      >
                        <Ionicons
                          name="car-outline"
                          size={18}
                          color="#e83030"
                        />
                      </View>
                      <View style={{ marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.vehicleSelectorName,
                            { color: T.text },
                          ]}
                        >
                          {selectedVehicle.carMake} {selectedVehicle.carModel}
                        </Text>
                        <Text
                          style={[
                            styles.vehicleSelectorReg,
                            { color: T.textMuted },
                          ]}
                        >
                          {selectedVehicle.registrationNumber}
                          {selectedVehicle.capacity
                            ? `  ·  ${selectedVehicle.capacity} seats`
                            : ""}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={T.textMuted}
                    />
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.vehicleSelectorPlaceholder,
                        { color: T.placeholder },
                      ]}
                    >
                      {!drivervehicles?.length
                        ? "No vehicles found — add one first"
                        : "Select a vehicle for this route"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={T.textMuted}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Route type */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: T.textSecondary }]}>
                Route Type<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.routeTypeContainer}>
                {ROUTE_TYPES.map(({ value, label, icon }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.routeTypeOption,
                      {
                        backgroundColor: T.inputBg,
                        borderColor: T.inputBorder,
                      },
                      routeType === value && styles.routeTypeSelected,
                    ]}
                    onPress={() => setRouteType(value)}
                  >
                    <Ionicons
                      name={icon}
                      size={16}
                      color={routeType === value ? "#e83030" : T.textMuted}
                    />
                    <Text
                      style={[
                        styles.routeTypeText,
                        { color: T.textMuted },
                        routeType === value && styles.routeTypeTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Active days */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: T.textSecondary }]}>
                Active Days<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.daysContainer}>
                {ALL_DAYS.map((day) => {
                  const active = activeDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: T.inputBg,
                          borderColor: T.inputBorder,
                        },
                        active && {
                          backgroundColor: "rgba(232,48,48,0.12)",
                          borderColor: "#e83030",
                        },
                      ]}
                      onPress={() => toggleDay(day)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          { color: T.textMuted },
                          active && { color: "#e83030", fontWeight: "700" },
                        ]}
                      >
                        {DAY_SHORT[day]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Stops ── */}
            <SectionHeader
              icon="navigate-outline"
              title="School Pickup Points"
              subtitle={
                stops.length === 0
                  ? "Add at least 2 stops — start and end"
                  : `${stops.length} stop${stops.length > 1 ? "s" : ""} · long-press to reorder`
              }
            />

            {stops.length > 0 && (
              <View style={styles.stopsListWrap}>
                <DraggableFlatList
                  data={stops}
                  keyExtractor={(item, i) => item.id || `stop-${i}`}
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
              </View>
            )}

            <TouchableOpacity
              style={styles.addStopBtn}
              onPress={() => setMapVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color="#e83030" />
              <Text style={styles.addStopText}>Add school on Map</Text>
            </TouchableOpacity>

            {/* ── Timing ── */}
            <SectionHeader
              icon="time-outline"
              title="Trip Timing"
              subtitle="End time is auto-calculated from stops"
            />

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
                <Text style={[styles.label, { color: T.textSecondary }]}>
                  End Time
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    styles.readOnlyField,
                    { backgroundColor: T.surface, borderColor: T.border },
                  ]}
                >
                  <Ionicons
                    name="flag-outline"
                    size={16}
                    color={T.textMuted}
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
                        { color: T.textSecondary, paddingLeft: 36 },
                        !estimatedEndTime && { color: T.placeholder },
                      ]}
                    >
                      {estimatedEndTime || "Auto-calculated"}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* ETA summary badge */}
            {(estimatedDuration > 0 || totalDistance > 0) && (
              <View style={styles.etaBadge}>
                <Ionicons
                  name="speedometer-outline"
                  size={13}
                  color="#e83030"
                />
                <Text style={styles.etaText}>
                  {estimatedDuration > 0 ? `${estimatedDuration} min` : ""}
                  {estimatedDuration > 0 && totalDistance > 0 ? "  ·  " : ""}
                  {totalDistance > 0 ? `${totalDistance} km` : ""}
                </Text>
              </View>
            )}

            {/* API error */}
            {error ? (
              <View
                style={[
                  styles.errorBadge,
                  { backgroundColor: "rgba(232,48,48,0.1)" },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color="#e83030"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.65 }]}
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
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={isEditMode ? "save-outline" : "checkmark-circle"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.primaryBtnText}>
                      {isEditMode ? "Save Changes" : "Create Route"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.cancelLinkText, { color: T.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Vehicle bottom sheet modal ── */}
        <Modal
          visible={showVehicleModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVehicleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
              <View
                style={[styles.modalHeader, { borderBottomColor: T.border }]}
              >
                <Text style={[styles.modalTitle, { color: T.text }]}>
                  Select Vehicle
                </Text>
                <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                  <Ionicons name="close" size={24} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              {!drivervehicles?.length ? (
                <View style={styles.emptyVehicles}>
                  <Ionicons
                    name="car-outline"
                    size={40}
                    color="rgba(255,255,255,0.2)"
                  />
                  <Text
                    style={[
                      styles.emptyVehiclesText,
                      { color: T.textSecondary },
                    ]}
                  >
                    No vehicles found
                  </Text>
                  <Text
                    style={[styles.emptyVehiclesSub, { color: T.textMuted }]}
                  >
                    Complete your profile setup to add a vehicle first.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={drivervehicles}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={styles.vehiclesList}
                  renderItem={renderVehicleItem}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* ── Map stop picker ── */}
        <MapStopPicker
          visible={mapVisible}
          onClose={() => setMapVisible(false)}
          onConfirm={handleConfirmStop}
        />
      </View>
    </GestureHandlerRootView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 2 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 8,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    marginTop: 20,
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

  // Fields
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  required: { color: "#e83030" },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readOnlyField: {},
  fieldIcon: { position: "absolute", left: 13 },
  input: { flex: 1, fontSize: 14, paddingLeft: 4 },
  readOnlyText: { fontSize: 14 },

  // Vehicle selector
  vehicleSelector: {
    borderRadius: 12,
    borderWidth: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  vehicleSelectorLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  vehicleSelectorIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleSelectorName: { fontSize: 14, fontWeight: "600" },
  vehicleSelectorReg: { fontSize: 11, marginTop: 1 },
  vehicleSelectorPlaceholder: { fontSize: 14, flex: 1 },

  // Route type
  routeTypeContainer: { flexDirection: "row", gap: 8 },
  routeTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
  },
  routeTypeSelected: {
    borderColor: "#e83030",
    backgroundColor: "rgba(232,48,48,0.1)",
  },
  routeTypeText: { fontSize: 11, fontWeight: "600" },
  routeTypeTextSelected: { color: "#e83030" },

  // Active days
  daysContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dayChipText: { fontSize: 12, fontWeight: "600" },

  // Stops
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
  stopTime: { fontSize: 11, color: "#e83030", marginTop: 3 },
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
    marginBottom: 8,
  },
  addStopText: { color: "#e83030", fontSize: 14, fontWeight: "700" },

  // Timing
  row: { flexDirection: "row" },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(232,48,48,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  etaText: { fontSize: 12, color: "#e83030", fontWeight: "600" },

  // Error
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: { fontSize: 12, color: "#e83030", flex: 1 },

  // Submit
  primaryBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 24,
    marginBottom: 8,
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
  cancelLink: { alignItems: "center", paddingVertical: 8 },
  cancelLinkText: { fontSize: 13 },

  // Vehicle modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
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
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  vehiclesList: { paddingHorizontal: 20, paddingTop: 10 },
  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#141010",
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
  vehicleName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  vehicleReg: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  vehicleCap: { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  emptyVehicles: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyVehiclesText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptyVehiclesSub: { fontSize: 13, textAlign: "center", marginTop: 4 },
});
