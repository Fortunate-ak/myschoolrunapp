// HomeScreen.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import {
  DrawerActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  selectDriverLocation,
  selectDriverSpeed,
  selectDriverHeading,
  selectTripStatus,
  selectCompletedStops,
  selectLastUpdate,
  setTripStatus,
  markStopCompleted,
  resetTrip,
} from "../lib/VehicleTrackingSlice";
import {
  getVehicleRoutesForDriver,
  setSelectedRouteId,
} from "../lib/VehicleRoutesSlice";
import { haversineKm } from "../utils/helpers";
import useSocketRedux from "../hooks/useSocket";
import {
  getRouteDirections,
  getRouteFromCurrentPosition,
  distanceToPolyline,
} from "../utils/mapbox";
import Toast from "react-native-toast-message";

export default function HomeScreen() {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const routeParams = useRoute();
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  // ── Redux selectors ───────────────────────────────────────────────────────
  const driverLocation = useSelector(selectDriverLocation);
  const rawSpeed = useSelector(selectDriverSpeed);
  const heading = useSelector(selectDriverHeading);
  const tripStatus = useSelector(selectTripStatus);
  const completedStops = useSelector(selectCompletedStops);
  const { driverRoutes, selectedRouteId } = useSelector((s) => s.vehicleroutes);

  // ── Socket hook ──────────────────────────────────────────────────────────
  const {
    isConnected,
    startTracking,
    stopTracking,
    markArrived,
    markDeparted,
    broadcastETA,
    triggerSOS,
  } = useSocketRedux();

  // ── Local state ──────────────────────────────────────────────────────────
  const [activeRoute, setActiveRoute] = useState(
    routeParams.params?.activeRoute || null,
  );
  const [nextStopIdx, setNextStopIdx] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(null);

  // New state for directions
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [offRouteDistance, setOffRouteDistance] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);

  // Map controls state
  const [zoomLevel, setZoomLevel] = useState(14);
  const [followUser, setFollowUser] = useState(true);

  // Route switching modal state
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [selectedNewRoute, setSelectedNewRoute] = useState(null);

  // Refs to prevent infinite loops
  const lastRerouteAttemptRef = useRef(0);
  const isReroutingRef = useRef(false);
  const offRouteCheckCountRef = useRef(0);

  const speedKmh = Math.round(rawSpeed * 3.6);
  const tripActive = tripStatus === "active";
  const tripEnded = tripStatus === "ended";

  // ── Derived route data ─────────────────────────────────────────────────────
  const stops = useMemo(
    () =>
      activeRoute?.stops
        ? [...activeRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder)
        : [],
    [activeRoute?.stops],
  );
  const nextStop = stops[nextStopIdx] ?? null;

  // The vehicle for all tracking events must come from the currently
  // selected route, not driverAssignedVehicle — a driver can have more
  // than one vehicle, and driverAssignedVehicle doesn't update when the
  // driver switches routes on RouteSelectionScreen. handleStartTrip
  // already got this right (activeRoute?.vehicle); markArrived/handleEndTrip/
  // broadcastETA/triggerSOS were reaching for the stale driverAssignedVehicle
  // instead, which sent the wrong vehicleId to guardians whenever it
  // differed from the route's actual vehicle.
  const activeVehicleId = activeRoute?.vehicle?.id ?? null;

  // ── Check if all stops are completed ──────────────────────────────────────
  const allStopsCompleted = useMemo(() => {
    if (!stops.length) return false;
    return completedStops.length >= stops.length;
  }, [completedStops.length, stops.length]);

  // ── Route switching logic ──────────────────────────────────────────────
  const canSwitchRoute = !tripActive && !tripEnded;

  const handleSwitchRoute = (newRoute) => {
    if (tripActive) {
      Alert.alert(
        "Trip in Progress",
        "You cannot switch routes while a trip is active. Please end the current trip first.",
        [{ text: "OK" }],
      );
      return;
    }

    if (tripEnded) {
      setSelectedNewRoute(newRoute);
      setShowRouteSelector(true);
      return;
    }

    setActiveRoute(newRoute);
    dispatch(setSelectedRouteId(newRoute.id));
    setRouteCoordinates([]);
    setNextStopIdx(0);
    setEtaMinutes(null);
    setIsOffRoute(false);
    setShowRouteSelector(false);
  };

  const confirmRouteSwitch = () => {
    if (selectedNewRoute) {
      setActiveRoute(selectedNewRoute);
      dispatch(setSelectedRouteId(selectedNewRoute.id));
      setRouteCoordinates([]);
      setNextStopIdx(0);
      setEtaMinutes(null);
      setIsOffRoute(false);
      dispatch(resetTrip());
      setSelectedNewRoute(null);
      setShowRouteSelector(false);
      Toast.show({
        type: "success",
        text1: "Route Changed",
        text2: `Now tracking ${selectedNewRoute.routeName}`,
      });
    }
  };

  // ── Load route directions when stops change ─────────────────────────────
  useEffect(() => {
    if (!activeRoute || !stops || stops.length === 0) {
      setRouteCoordinates([]);
      return;
    }

    const loadRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const result = await getRouteDirections(stops);
        if (result.coordinates && result.coordinates.length > 0) {
          setRouteCoordinates(result.coordinates);
          if (tripStatus === "active" && result.durationMins) {
            setEtaMinutes(result.durationMins);
          }
        }
      } catch (error) {
        console.error("Error loading route:", error);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    loadRoute();
  }, [activeRoute, stops]);

  // ── Use the driver's selected route ──────────────────────────────────────
  useEffect(() => {
    if (activeRoute || !driverRoutes?.length) return;
    const matched = selectedRouteId
      ? driverRoutes.find((r) => r.id === selectedRouteId)
      : null;
    setActiveRoute(matched || driverRoutes[0]);
  }, [driverRoutes, selectedRouteId, activeRoute]);

  useEffect(() => {
    if (!activeRoute) dispatch(getVehicleRoutesForDriver());
  }, []);

  // ── Reroute function ─────────────────────────────────────────────────────
  // NOTE: this must be defined BEFORE the "Rerouting logic" effect below,
  // since that effect lists rerouteToNextStop in its dependency array —
  // referencing a const before its declaration throws a ReferenceError
  // (temporal dead zone), which was crashing this screen on every render.
  const rerouteToNextStop = useCallback(async () => {
    if (!driverLocation || !nextStop || isReroutingRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastRerouteAttemptRef.current < 10000) {
      return;
    }

    lastRerouteAttemptRef.current = now;
    isReroutingRef.current = true;
    setIsRerouting(true);

    try {
      const result = await getRouteFromCurrentPosition(
        driverLocation.latitude,
        driverLocation.longitude,
        nextStop.location.latitude,
        nextStop.location.longitude,
      );

      if (result.coordinates && result.coordinates.length > 0) {
        setRouteCoordinates(result.coordinates);
        if (result.durationMins) {
          setEtaMinutes(result.durationMins);
        }
        setIsOffRoute(false);

        Alert.alert(
          "Route Updated",
          "Your route has been recalculated to your current position.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("Rerouting failed:", error);
    } finally {
      isReroutingRef.current = false;
      setIsRerouting(false);
    }
  }, [driverLocation, nextStop]);

  // ── Rerouting logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (
      !driverLocation ||
      !nextStop ||
      tripStatus !== "active" ||
      routeCoordinates.length === 0
    ) {
      setIsOffRoute(false);
      return;
    }

    offRouteCheckCountRef.current += 1;

    if (offRouteCheckCountRef.current % 2 === 0) {
      return;
    }

    const checkOffRoute = async () => {
      const offRouteThreshold = 0.1;
      const distFromRoute = distanceToPolyline(
        driverLocation,
        routeCoordinates,
      );

      setOffRouteDistance(distFromRoute);

      if (distFromRoute > offRouteThreshold && !isReroutingRef.current) {
        setIsOffRoute(true);
        await rerouteToNextStop();
      } else if (distFromRoute <= offRouteThreshold && isOffRoute) {
        setIsOffRoute(false);
      }
    };

    checkOffRoute();

    return () => {
      // Cleanup
    };
  }, [
    driverLocation,
    routeCoordinates,
    nextStop,
    tripStatus,
    rerouteToNextStop,
    isOffRoute,
  ]);

  // ── ETA recalculation ──────────────────────────────────────────────────
  useEffect(() => {
    if (
      !driverLocation ||
      !nextStop?.location?.latitude ||
      !routeCoordinates.length
    ) {
      return;
    }

    let intervalId = null;

    const updateETA = async () => {
      try {
        const result = await getRouteFromCurrentPosition(
          driverLocation.latitude,
          driverLocation.longitude,
          nextStop.location.latitude,
          nextStop.location.longitude,
        );

        if (result.durationMins > 0) {
          const mins = Math.max(1, result.durationMins);
          setEtaMinutes(mins);

          if (tripStatus === "active" && activeVehicleId && nextStop?.id) {
            broadcastETA(activeVehicleId, activeRoute?.id, nextStop.id, mins);
          }
        }
      } catch (error) {
        console.error("ETA calculation error:", error);
      }
    };

    intervalId = setInterval(updateETA, 30000);
    updateETA();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    driverLocation,
    nextStop,
    routeCoordinates,
    tripStatus,
    activeVehicleId,
    activeRoute,
    broadcastETA,
  ]);

  // ── Auto-detect arrival ────────────────────────────────────────────────────
  useEffect(() => {
    if (!driverLocation || !nextStop?.location || tripStatus !== "active") {
      return;
    }

    // Don't auto-detect if this stop is already completed
    if (completedStops.includes(nextStopIdx)) {
      return;
    }

    const dist = haversineKm(
      driverLocation.latitude,
      driverLocation.longitude,
      nextStop.location.latitude,
      nextStop.location.longitude,
    );

    if (dist < 0.05) {
      handleArrived();
    }
  }, [driverLocation, nextStop, tripStatus, completedStops, nextStopIdx]);

  // ── Sync completed stops from Redux ──────────────────────────────────────
  useEffect(() => {
    if (completedStops.length > 0) {
      // Find the next uncompleted stop
      let nextUncompleted = 0;
      for (let i = 0; i < stops.length; i++) {
        if (!completedStops.includes(i)) {
          nextUncompleted = i;
          break;
        }
      }
      // If all stops are completed, set to stops.length
      if (nextUncompleted >= stops.length) {
        setNextStopIdx(stops.length);
      } else {
        setNextStopIdx(nextUncompleted);
      }
    } else {
      setNextStopIdx(0);
    }
  }, [completedStops, stops.length]);

  // ── Trip controls ─────────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    dispatch(setTripStatus("active"));
    setNextStopIdx(0);

    const vehicleForRoute = activeRoute?.vehicle;
    if (!vehicleForRoute) {
      Toast.show({ type: "error", text1: "No vehicle assigned to this route" });
      return;
    }

    const initialLocation = await startTracking(activeRoute, vehicleForRoute);

    const originLat = initialLocation?.latitude ?? driverLocation?.latitude;
    const originLng = initialLocation?.longitude ?? driverLocation?.longitude;

    if (originLat != null && originLng != null && stops.length > 0) {
      setIsLoadingRoute(true);
      try {
        const waypoints = [
          { latitude: originLat, longitude: originLng },
          ...stops,
        ];
        const result = await getRouteDirections(waypoints);
        if (result.coordinates && result.coordinates.length > 0) {
          setRouteCoordinates(result.coordinates);
          if (result.durationMins) {
            setEtaMinutes(result.durationMins);
          }
        }
      } catch (error) {
        console.error("Error drawing initial route to all stops:", error);
      } finally {
        setIsLoadingRoute(false);
      }
    }
  };

  // ── FIXED: handleArrived - properly handles stop completion ──────────────
  const handleArrived = useCallback(() => {
    // Don't proceed if we're already at or past the last stop
    if (nextStopIdx >= stops.length) {
      Toast.show({
        type: "info",
        text1: "All stops completed",
        text2: "End the trip to finish",
      });
      return;
    }

    // Don't allow arriving at the same stop twice
    if (completedStops.includes(nextStopIdx)) {
      Toast.show({
        type: "info",
        text1: "Already arrived",
        text2: "This stop has already been completed",
      });
      return;
    }

    const stop = stops[nextStopIdx];
    if (!stop) return;

    // Mark arrived at the current stop
    if (activeVehicleId) {
      markArrived(activeVehicleId, activeRoute?.id, stop, nextStopIdx);
    }

    // Dispatch to mark this stop as completed
    dispatch(markStopCompleted(nextStopIdx));

    // Show toast feedback
    Toast.show({
      type: "success",
      text1: "Arrived!",
      text2: `Completed stop ${nextStopIdx + 1} of ${stops.length}`,
    });

    // Check if all stops are now completed
    const newCompletedCount = completedStops.length + 1;
    if (newCompletedCount >= stops.length) {
      // All stops completed - show a message but DON'T auto-end the trip
      Toast.show({
        type: "success",
        text1: "All stops completed!",
        text2: "Press 'End Trip' to finish",
      });
      // Set nextStopIdx to the end so the UI shows "All stops completed"
      setNextStopIdx(stops.length);
      return;
    }

    // Move to the next uncompleted stop
    // Find the next stop that hasn't been completed
    let nextUncompleted = nextStopIdx + 1;
    while (
      nextUncompleted < stops.length &&
      completedStops.includes(nextUncompleted)
    ) {
      nextUncompleted++;
    }

    if (nextUncompleted < stops.length) {
      setNextStopIdx(nextUncompleted);
      // Reroute to the next stop
      const nextStopData = stops[nextUncompleted];
      if (driverLocation && nextStopData?.location) {
        getRouteFromCurrentPosition(
          driverLocation.latitude,
          driverLocation.longitude,
          nextStopData.location.latitude,
          nextStopData.location.longitude,
        ).then((result) => {
          if (result.coordinates && result.coordinates.length > 0) {
            setRouteCoordinates(result.coordinates);
          }
        });
      }
    } else {
      // All stops completed
      setNextStopIdx(stops.length);
    }
  }, [
    nextStopIdx,
    stops,
    activeVehicleId,
    activeRoute,
    driverLocation,
    completedStops,
    markArrived,
    dispatch,
  ]);

  // ── handleEndTrip - properly ends the trip ──────────────────────────────
  const handleEndTrip = useCallback(() => {
    // Check if all stops are completed
    const allCompleted = completedStops.length >= stops.length;

    if (!allCompleted) {
      // Confirm with the driver if they want to end before completing all stops
      Alert.alert(
        "End Trip Early?",
        `You've completed ${completedStops.length} of ${stops.length} stops. Are you sure you want to end the trip?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "End Trip",
            style: "destructive",
            onPress: () => {
              dispatch(setTripStatus("ended"));
              stopTracking(
                activeVehicleId,
                activeRoute?.id,
                driverLocation,
                completedStops.length,
                stops.length,
              );
            },
          },
        ],
      );
    } else {
      // All stops completed - normal end
      dispatch(setTripStatus("ended"));
      stopTracking(
        activeVehicleId,
        activeRoute?.id,
        driverLocation,
        completedStops.length,
        stops.length,
      );
      Toast.show({
        type: "success",
        text1: "Trip Completed!",
        text2: "All stops were completed successfully.",
      });
    }
  }, [
    activeVehicleId,
    activeRoute,
    driverLocation,
    completedStops,
    stops,
    dispatch,
    stopTracking,
  ]);

  // ── Start new trip after ending ──────────────────────────────────────────
  const handleStartNewTrip = () => {
    dispatch(resetTrip());
    setNextStopIdx(0);
    setEtaMinutes(null);
    setRouteCoordinates([]);
    setIsOffRoute(false);
    setShowRouteSelector(true);
  };

  // ── Map data ──────────────────────────────────────────────────────────────
  const centerCoord = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : stops[0]?.location
      ? [stops[0].location.longitude, stops[0].location.latitude]
      : [31.0335, -17.8252];

  const mapStyle =
    T.mode === "dark" ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;

  // ── Map control handlers ────────────────────────────────────────────────
  const MIN_ZOOM = 3;
  const MAX_ZOOM = 19;

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const next = Math.min(z + 1, MAX_ZOOM);
      cameraRef.current?.zoomTo(next, 300);
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const next = Math.max(z - 1, MIN_ZOOM);
      cameraRef.current?.zoomTo(next, 300);
      return next;
    });
  }, []);

  const handleRecenter = useCallback(() => {
    setFollowUser(true);
    setZoomLevel(14);
    cameraRef.current?.setCamera({
      centerCoordinate: centerCoord,
      zoomLevel: 14,
      animationMode: "flyTo",
      animationDuration: 600,
    });
  }, [centerCoord]);

  const handleMapTouchStart = useCallback(() => {
    setFollowUser(false);
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderStopMarkers = () => {
    return stops.map((stop, idx) => {
      if (!stop.location?.longitude) return null;
      const isPassed = completedStops.includes(idx);
      const isNext = idx === nextStopIdx && tripActive && !allStopsCompleted;
      const isLast = idx === stops.length - 1;
      return (
        <Mapbox.PointAnnotation
          key={stop.id || idx}
          id={`stop-${idx}`}
          coordinate={[stop.location.longitude, stop.location.latitude]}
        >
          <View
            style={[
              styles.stopMarker,
              isNext && {
                backgroundColor: T.accent,
                borderColor: "#fff",
                transform: [{ scale: 1.25 }],
              },
              isPassed && {
                backgroundColor: T.success,
                borderColor: T.success,
              },
              isLast && !isNext && !isPassed && { backgroundColor: T.accent },
            ]}
          >
            {isLast && !isNext && !isPassed ? (
              <Ionicons name="flag" size={10} color="#fff" />
            ) : (
              <Text style={styles.stopMarkerText}>{idx + 1}</Text>
            )}
          </View>
        </Mapbox.PointAnnotation>
      );
    });
  };

  // ── Route Selector Modal ──────────────────────────────────────────────────
  const renderRouteSelector = () => (
    <Modal
      visible={showRouteSelector}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowRouteSelector(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: T.bgSecondary }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: T.text }]}>
              {tripEnded ? "Start New Trip" : "Select Route"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowRouteSelector(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={T.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, { color: T.textMuted }]}>
            {tripEnded
              ? "Choose a route for your next trip"
              : "Select a different route to drive"}
          </Text>

          <FlatList
            data={driverRoutes}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalRouteItem,
                  {
                    backgroundColor: T.surface,
                    borderColor:
                      selectedNewRoute?.id === item.id ? T.accent : T.border,
                    borderWidth: selectedNewRoute?.id === item.id ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedNewRoute(item)}
              >
                <View style={styles.modalRouteIcon}>
                  <Ionicons name="map" size={20} color={T.accent} />
                </View>
                <View style={styles.modalRouteInfo}>
                  <Text style={[styles.modalRouteName, { color: T.text }]}>
                    {item.routeName}
                  </Text>
                  <Text style={[styles.modalRouteMeta, { color: T.textMuted }]}>
                    {item.stops?.length || 0} stops •{" "}
                    {item.totalDistance || "—"} km
                  </Text>
                </View>
                {selectedNewRoute?.id === item.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={T.accent}
                  />
                )}
              </TouchableOpacity>
            )}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: T.border }]}
              onPress={() => setShowRouteSelector(false)}
            >
              <Text style={[styles.modalCancelText, { color: T.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                {
                  backgroundColor: selectedNewRoute ? T.accent : T.border,
                  opacity: selectedNewRoute ? 1 : 0.5,
                },
              ]}
              onPress={confirmRouteSwitch}
              disabled={!selectedNewRoute}
            >
              <Text style={styles.modalConfirmText}>
                {tripEnded ? "Start Trip" : "Switch Route"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Map */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={mapStyle}
        onTouchStart={handleMapTouchStart}
      >
        <Mapbox.Camera
          ref={cameraRef}
          {...(followUser ? { centerCoordinate: centerCoord } : {})}
          defaultSettings={{ centerCoordinate: centerCoord, zoomLevel }}
          zoomLevel={zoomLevel}
          animationMode="flyTo"
          animationDuration={600}
        />

        {routeCoordinates.length >= 2 && (
          <Mapbox.ShapeSource
            id="route-path"
            shape={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routeCoordinates.map((c) => [
                  c.longitude,
                  c.latitude,
                ]),
              },
            }}
          >
            <Mapbox.LineLayer
              id="route-line"
              style={{
                lineColor: isOffRoute ? "#ff6b6b" : T.accent,
                lineWidth: 4,
                lineOpacity: isOffRoute ? 0.6 : 0.9,
                lineCap: "round",
                lineJoin: "round",
                lineDasharray: isOffRoute ? [2, 2] : undefined,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {renderStopMarkers()}

        {driverLocation && (
          <Mapbox.PointAnnotation
            id="driver"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
          >
            <View style={styles.driverDotWrap}>
              <View style={[styles.driverDot, { borderColor: T.surface }]}>
                <Ionicons
                  name="navigate"
                  size={10}
                  color="#fff"
                  style={{ transform: [{ rotate: `${heading}deg` }] }}
                />
              </View>
            </View>
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      {/* Top bar - Updated with safe area */}
      <View
        style={[
          styles.topBar,
          {
            top: insets.top + 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: T.mapOverlay }]}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={22} color={T.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.routePill, { backgroundColor: T.mapOverlay }]}
          onPress={() => {
            if (tripActive) {
              Alert.alert(
                "Trip in Progress",
                "You cannot switch routes while driving. Please end the current trip first.",
                [{ text: "OK" }],
              );
            } else {
              setShowRouteSelector(true);
              setSelectedNewRoute(null);
            }
          }}
          disabled={tripActive}
        >
          <Ionicons name="map" size={13} color={T.accent} />
          <Text
            style={[styles.routePillText, { color: T.text }]}
            numberOfLines={1}
          >
            {activeRoute?.routeName || "No route selected"}
          </Text>
          {!tripActive && !tripEnded && (
            <Ionicons name="chevron-down" size={14} color={T.textMuted} />
          )}
        </TouchableOpacity>

        <View
          style={[
            styles.connDot,
            { backgroundColor: isConnected ? T.success : "#888" },
          ]}
        />
      </View>

      {/* Speed HUD */}
      <View
        style={[
          styles.speedHUD,
          {
            backgroundColor: T.mapOverlay,
            top: insets.top + 70,
          },
        ]}
      >
        <Text style={[styles.speedVal, { color: T.text }]}>{speedKmh}</Text>
        <Text style={[styles.speedUnit, { color: T.textMuted }]}>km/h</Text>
      </View>

      {/* Off-route warning */}
      {isOffRoute && tripActive && (
        <View
          style={[
            styles.offRouteWarning,
            {
              backgroundColor: T.mapOverlay,
              top: insets.top + 70,
            },
          ]}
        >
          <Ionicons name="warning" size={16} color="#ff6b6b" />
          <Text style={[styles.offRouteText, { color: T.text }]}>
            Off route {isRerouting ? "(Rerouting...)" : ""}
          </Text>
        </View>
      )}

      {/* Map controls */}
      <View
        style={[
          styles.mapControls,
          {
            backgroundColor: T.mapOverlay,
            top: insets.top + 146,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={handleZoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="add"
            size={20}
            color={zoomLevel >= MAX_ZOOM ? T.textMuted : T.text}
          />
        </TouchableOpacity>
        <View
          style={[styles.mapControlDivider, { backgroundColor: T.border }]}
        />
        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={handleZoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name="remove"
            size={20}
            color={zoomLevel <= MIN_ZOOM ? T.textMuted : T.text}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.recenterBtn,
          {
            backgroundColor: followUser ? T.accent : T.mapOverlay,
            top: insets.top + 242,
          },
        ]}
        onPress={handleRecenter}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={followUser ? "locate" : "locate-outline"}
          size={20}
          color={followUser ? "#fff" : T.text}
        />
      </TouchableOpacity>

      {/* SOS button */}
      {tripActive && (
        <TouchableOpacity
          style={[
            styles.sosBtn,
            {
              backgroundColor: T.accent,
              top: insets.top + 70,
            },
          ]}
          onPress={() =>
            triggerSOS(activeVehicleId, driverLocation, "Driver", "")
          }
        >
          <Text style={styles.sosBtnText}>SOS</Text>
        </TouchableOpacity>
      )}

      {/* Bottom card */}
      <View
        style={[
          styles.bottomCard,
          {
            backgroundColor: T.bgSecondary,
            borderTopColor: T.border,
            paddingBottom: Platform.OS === "ios" ? insets.bottom + 20 : 20,
          },
        ]}
      >
        {tripEnded ? (
          // Trip ended state
          <View style={styles.tripEndedContainer}>
            <View style={styles.tripEndedIcon}>
              <Ionicons name="checkmark-circle" size={40} color={T.success} />
            </View>
            <Text style={[styles.tripEndedTitle, { color: T.text }]}>
              {allStopsCompleted ? "Trip Completed!" : "Trip Ended"}
            </Text>
            <Text style={[styles.tripEndedSubtitle, { color: T.textMuted }]}>
              {completedStops.length} of {stops.length} stops completed
            </Text>
            <TouchableOpacity
              style={[styles.startNewTripBtn, { backgroundColor: T.accent }]}
              onPress={handleStartNewTrip}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.startNewTripText}>Start New Trip</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Next stop */}
            {allStopsCompleted && tripActive ? (
              <View style={styles.allCompletedContainer}>
                <Ionicons name="checkmark-circle" size={24} color={T.success} />
                <Text style={[styles.allCompletedText, { color: T.text }]}>
                  All stops completed!
                </Text>
                <Text
                  style={[styles.allCompletedSubtext, { color: T.textMuted }]}
                >
                  Press "End Trip" to finish
                </Text>
              </View>
            ) : nextStop ? (
              <View style={styles.nextStopRow}>
                <View
                  style={[
                    styles.nextStopIcon,
                    {
                      backgroundColor: T.accentDim,
                      borderColor: T.accentBorder,
                    },
                  ]}
                >
                  <Ionicons name="navigate" size={18} color={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nextStopLabel, { color: T.textMuted }]}>
                    {tripActive ? "Next Stop" : "First Stop"}
                  </Text>
                  <Text
                    style={[styles.nextStopName, { color: T.text }]}
                    numberOfLines={1}
                  >
                    {nextStop.stopName}
                  </Text>
                  <Text
                    style={[styles.nextStopAddr, { color: T.textMuted }]}
                    numberOfLines={1}
                  >
                    {nextStop.location?.address}
                  </Text>
                </View>
                {tripActive && etaMinutes != null && (
                  <View
                    style={[
                      styles.etaBox,
                      {
                        backgroundColor: T.accentDim,
                        borderColor: T.accentBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.etaVal, { color: T.accent }]}>
                      {etaMinutes}
                    </Text>
                    <Text style={[styles.etaUnit, { color: T.accent }]}>
                      min
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.noRouteText, { color: T.textMuted }]}>
                {activeRoute ? "No stops available" : "No route selected."}
              </Text>
            )}

            {/* Stop progress bar */}
            {stops.length > 0 && (
              <View style={styles.progressSection}>
                <Text style={[styles.progressLabel, { color: T.textMuted }]}>
                  {completedStops.length} of {stops.length} stops completed
                </Text>
                <View
                  style={[styles.progressTrack, { backgroundColor: T.border }]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: allStopsCompleted
                          ? T.success
                          : T.accent,
                        width: `${(completedStops.length / Math.max(stops.length, 1)) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
              {!tripActive ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, !activeRoute && { opacity: 0.45 }]}
                  onPress={handleStartTrip}
                  disabled={!activeRoute}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#e83030", "#c01818"]}
                    style={styles.primaryBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Start Trip</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: allStopsCompleted
                          ? T.textMuted
                          : T.success,
                        backgroundColor: allStopsCompleted
                          ? T.surfaceRaised
                          : T.successDim,
                        opacity: allStopsCompleted ? 0.5 : 1,
                      },
                    ]}
                    onPress={handleArrived}
                    disabled={allStopsCompleted}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={allStopsCompleted ? T.textMuted : T.success}
                    />
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        { color: allStopsCompleted ? T.textMuted : T.success },
                      ]}
                    >
                      {allStopsCompleted ? "All Done!" : "Arrived"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: T.accentBorder,
                        backgroundColor: T.accentDim,
                      },
                    ]}
                    onPress={handleEndTrip}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="stop-circle" size={16} color={T.accent} />
                    <Text
                      style={[styles.secondaryBtnText, { color: T.accent }]}
                    >
                      End Trip
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </View>

      {/* Route Selector Modal */}
      {renderRouteSelector()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  routePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routePillText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  connDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  speedHUD: {
    position: "absolute",
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  speedVal: { fontSize: 24, fontWeight: "800" },
  speedUnit: { fontSize: 10, fontWeight: "600" },

  offRouteWarning: {
    position: "absolute",
    left: 16,
    right: 100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offRouteText: {
    fontSize: 12,
    fontWeight: "600",
  },

  mapControls: {
    position: "absolute",
    right: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControlDivider: {
    height: 1,
    marginHorizontal: 8,
  },

  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  sosBtn: {
    position: "absolute",
    left: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sosBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },

  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    gap: 14,
  },

  // Trip ended state
  tripEndedContainer: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  tripEndedIcon: {
    marginBottom: 4,
  },
  tripEndedTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  tripEndedSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  startNewTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 50,
    marginTop: 4,
  },
  startNewTripText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // All stops completed state
  allCompletedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  allCompletedText: {
    fontSize: 16,
    fontWeight: "700",
  },
  allCompletedSubtext: {
    fontSize: 12,
    marginLeft: 4,
  },

  nextStopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nextStopIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  nextStopLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  nextStopName: { fontSize: 15, fontWeight: "700" },
  nextStopAddr: { fontSize: 11, marginTop: 1 },
  etaBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    minWidth: 52,
  },
  etaVal: { fontSize: 20, fontWeight: "800" },
  etaUnit: { fontSize: 10, fontWeight: "600" },
  noRouteText: { fontSize: 13, textAlign: "center" },

  progressSection: { gap: 6 },
  progressLabel: { fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },

  controls: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, borderRadius: 50, overflow: "hidden" },
  primaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700" },

  stopMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#555",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#888",
  },
  stopMarkerText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  driverDotWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  driverDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalClose: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalList: {
    gap: 10,
    paddingBottom: 16,
  },
  modalRouteItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  modalRouteIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(232,48,48,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalRouteInfo: {
    flex: 1,
  },
  modalRouteName: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalRouteMeta: {
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
