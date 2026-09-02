// screens/guardian/GuardianRoutesScreen.js
//
// Guardian-facing counterpart to the driver's RoutesScreen. A route only
// shows up here once at least one of the guardian's students has an
// *approved* route_stop_request on it (student.vehicleRouteId gets set
// server-side in guardianRequestController.approveRequest — see
// UserSlice/getGuardianProfile for how `students` arrives with that field).
//
// Once a route is visible, the guardian can see every stop on it and
// request any stop for another one of their students (e.g. a sibling)
// without going through the full "find a driver" flow again — this reuses
// the same sendRequest thunk / backend endpoint as RequestsScreen.js.
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { DrawerActions } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { getAllVehicles } from "../lib/VehicleRoutesSlice";
import { getGuardianProfile } from "../lib/UserSlice";
import { sendRequest } from "../lib/GuardianRequestsSlice";

const DAY_SHORT = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function RouteCard({
  route,
  students,
  expandedByDefault,
  requesting,
  onRequestStop,
  theme,
}) {
  const [expanded, setExpanded] = useState(!!expandedByDefault);
  const styles = getStyles(theme);
  const stops = route.stops
    ? [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder)
    : [];

  const myStudentsOnRoute = students.filter(
    (s) => s.vehicleRouteId === route.id,
  );
  // Students who are NOT already on this exact route are the ones a
  // guardian could still request a stop for (e.g. a second child).
  const eligibleStudents = students.filter(
    (s) => s.vehicleRouteId !== route.id,
  );

  const driverName = route.vehicle?.driver?.user?.fullname || "Unassigned";

  return (
    <View style={styles.routeCard}>
      {/* Header */}
      <TouchableOpacity
        style={styles.routeCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View
          style={[styles.routeIconWrap, { backgroundColor: theme.accentDim }]}
        >
          <Ionicons name="map" size={18} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName}>{route.routeName}</Text>
          <Text style={styles.routeMeta}>
            {route.startTime?.slice(0, 5)} –{" "}
            {route.estimatedEndTime?.slice(0, 5)} · {driverName}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {/* Which of my kids are on this route */}
      {myStudentsOnRoute.length > 0 && (
        <View style={styles.myStudentsRow}>
          {myStudentsOnRoute.map((s) => (
            <View
              key={s.id}
              style={[
                styles.myStudentChip,
                {
                  backgroundColor: theme.accentDim,
                  borderColor: theme.accentBorder,
                },
              ]}
            >
              <Ionicons name="person" size={12} color={theme.accent} />
              <Text style={[styles.myStudentChipText, { color: theme.accent }]}>
                {s.fullname}
              </Text>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <>
          {/* Active days */}
          <View style={styles.daysRow}>
            {(route.activeDays || []).map((d) => (
              <View key={d} style={styles.dayChip}>
                <Text style={styles.dayChipText}>{DAY_SHORT[d] || d}</Text>
              </View>
            ))}
          </View>

          {/* Vehicle info */}
          <View
            style={[
              styles.scheduleBlock,
              { backgroundColor: "rgba(255,255,255,0.03)" },
            ]}
          >
            <View style={styles.scheduleRow}>
              <Ionicons
                name="bus-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={styles.scheduleText}>
                {route.vehicle?.carMake} {route.vehicle?.carModel} ·{" "}
                {route.vehicle?.registrationNumber || "—"}
              </Text>
            </View>
            <View style={styles.scheduleRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={styles.scheduleText}>
                Start: {route.startTime?.slice(0, 5) || "—"} · Est. end:{" "}
                {route.estimatedEndTime?.slice(0, 5) || "—"}
              </Text>
            </View>
          </View>

          {/* Stops list */}
          <View style={styles.stopsSection}>
            <Text style={styles.stopsSectionTitle}>
              {stops.length} Stop{stops.length !== 1 ? "s" : ""}
            </Text>

            {eligibleStudents.length === 0 && students.length > 0 && (
              <Text style={styles.allOnRouteNote}>
                All your students are already on this route.
              </Text>
            )}

            {stops.map((stop, idx) => {
              const studentHere = myStudentsOnRoute.find(
                (s) => s.vehicleStopId === stop.id,
              );
              const isRequestingThis =
                requesting?.routeId === route.id &&
                requesting?.stopId === stop.id;

              return (
                <View key={stop.id || idx} style={styles.stopItem}>
                  <View
                    style={[
                      styles.stopDot,
                      idx === 0 && styles.stopDotFirst,
                      idx === stops.length - 1 && styles.stopDotLast,
                      studentHere && { backgroundColor: theme.accent },
                    ]}
                  />
                  {idx < stops.length - 1 && (
                    <View
                      style={[
                        styles.stopConnector,
                        { backgroundColor: theme.border },
                      ]}
                    />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.stopNameRow}>
                      <Text style={styles.stopItemName}>{stop.stopName}</Text>
                      {studentHere && (
                        <View
                          style={[
                            styles.stopBadge,
                            { backgroundColor: theme.accent },
                          ]}
                        >
                          <Text style={styles.stopBadgeText}>
                            {studentHere.fullname}
                          </Text>
                        </View>
                      )}
                    </View>
                    {stop.location?.address && (
                      <Text style={styles.stopItemAddress} numberOfLines={1}>
                        {stop.location.address}
                      </Text>
                    )}
                    {(stop.scheduledPickupTime ||
                      stop.scheduledDropoffTime) && (
                      <Text style={styles.stopItemTime}>
                        {stop.scheduledPickupTime?.slice(0, 5)}{" "}
                        {stop.scheduledDropoffTime
                          ? `→ ${stop.scheduledDropoffTime.slice(0, 5)}`
                          : ""}
                      </Text>
                    )}

                    {!studentHere && eligibleStudents.length > 0 && (
                      <View style={styles.requestArea}>
                        {isRequestingThis ? (
                          <View style={styles.pickerRow}>
                            {eligibleStudents.map((s) => (
                              <TouchableOpacity
                                key={s.id}
                                style={[
                                  styles.pickerChip,
                                  { borderColor: theme.accent },
                                ]}
                                onPress={() => onRequestStop(route, stop, s)}
                                disabled={requesting?.isSubmitting}
                              >
                                {requesting?.isSubmitting &&
                                requesting?.studentId === s.id ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={theme.accent}
                                  />
                                ) : (
                                  <Text
                                    style={[
                                      styles.pickerChipText,
                                      { color: theme.accent },
                                    ]}
                                  >
                                    For {s.fullname}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              onPress={() => onRequestStop(null, null, null)}
                              style={styles.pickerCancel}
                            >
                              <Ionicons
                                name="close"
                                size={16}
                                color={theme.textSecondary}
                              />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.requestBtn,
                              { borderColor: theme.border },
                            ]}
                            onPress={() => onRequestStop(route, stop, "pick")}
                          >
                            <Ionicons
                              name="add-circle-outline"
                              size={14}
                              color={theme.accent}
                            />
                            <Text
                              style={[
                                styles.requestBtnText,
                                { color: theme.accent },
                              ]}
                            >
                              Request this stop
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

export default function RoutesScreen({ navigation, route: navRoute }) {
  const { theme, isDark } = useTheme();
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(null); // { routeId, stopId, isSubmitting, studentId }
  const styles = getStyles(theme);

  const { vehicles, isLoading } = useSelector((state) => state.vehicleroutes);
  const { guardianProfile } = useSelector((state) => state.users);
  const students = guardianProfile?.students || [];

  // Optional — if this screen was opened from StudentDetailScreen's
  // "View Full Route →" link, it passes a routeId to auto-expand.
  const focusRouteId = navRoute?.params?.routeId;

  const load = () => {
    dispatch(getAllVehicles());
    dispatch(getGuardianProfile());
  };

  useEffect(() => {
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(getAllVehicles()),
      dispatch(getGuardianProfile()),
    ]);
    setRefreshing(false);
  };

  // A route only counts as "mine" once one of my students has been
  // approved onto it (vehicleRouteId set by approveRequest server-side).
  const assignedRoutes = useMemo(() => {
    if (!vehicles) return [];
    const result = [];
    vehicles.forEach((vehicle) => {
      (vehicle.routes || []).forEach((r) => {
        const hasMyStudent = students.some((s) => s.vehicleRouteId === r.id);
        if (hasMyStudent) {
          result.push({ ...r, vehicle });
        }
      });
    });
    return result;
  }, [vehicles, students]);

  const handleRequestStopTap = (routeArg, stopArg, studentArg) => {
    if (!routeArg) {
      setRequesting(null);
      return;
    }
    if (studentArg === "pick") {
      setRequesting({ routeId: routeArg.id, stopId: stopArg.id });
      return;
    }

    // Actually submitting for a specific student
    submitStopRequest(routeArg, stopArg, studentArg);
  };

  const submitStopRequest = async (routeArg, stopArg, student) => {
    const driverId = routeArg.vehicle?.driver?.user?.id;
    if (!driverId) {
      Toast.show({
        type: "error",
        text1: "Driver Unavailable",
        text2: "This route doesn't have an assigned driver yet",
      });
      return;
    }

    setRequesting({
      routeId: routeArg.id,
      stopId: stopArg.id,
      isSubmitting: true,
      studentId: student.id,
    });

    try {
      await dispatch(
        sendRequest({
          driverId,
          requestType: "route_stop_request",
          studentId: student.id,
          routeId: routeArg.id,
          vehicleStopId: stopArg.id,
        }),
      ).unwrap();

      Toast.show({
        type: "success",
        text1: "Request Sent!",
        text2: `The driver will review your request for ${student.fullname}`,
      });
      setRequesting(null);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: typeof error === "string" ? error : "Please try again",
      });
      setRequesting({ routeId: routeArg.id, stopId: stopArg.id });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {navigation?.dispatch ? (
          <TouchableOpacity
            style={[
              styles.menuBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
            onPress={() =>
              focusRouteId
                ? navigation.goBack()
                : navigation.dispatch(DrawerActions.openDrawer())
            }
          >
            <Ionicons
              name={focusRouteId ? "chevron-back" : "menu"}
              size={22}
              color={theme.text}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <Text style={styles.headerTitle}>My Routes</Text>
        <View style={{ width: 38 }} />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : assignedRoutes.length === 0 ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor: theme.accentDim,
                borderColor: theme.accentBorder,
              },
            ]}
          >
            <Ionicons name="map-outline" size={40} color={theme.accent} />
          </View>
          <Text style={styles.emptyTitle}>No routes yet</Text>
          <Text style={styles.emptySubtitle}>
            Once a driver approves your request, the route will show up here
            with every stop.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation?.navigate?.("Requests")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[theme.accent, "#c01818"]}
              style={styles.emptyBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Send a Request</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={assignedRoutes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
            />
          }
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              students={students}
              expandedByDefault={
                focusRouteId ? item.id === focusRouteId : false
              }
              requesting={requesting?.routeId === item.id ? requesting : null}
              onRequestStop={handleRequestStopTap}
              theme={theme}
            />
          )}
        />
      )}
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "ios" ? 56 : 40,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    menuBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    list: {
      padding: 16,
      gap: 14,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    // Route card
    routeCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    routeCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    routeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    routeName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
    },
    routeMeta: {
      fontSize: 12,
      color: theme.textSecondary,
    },

    myStudentsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    myStudentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    myStudentChipText: { fontSize: 11, fontWeight: "700" },

    daysRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    dayChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: theme.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dayChipText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: "600",
    },

    scheduleBlock: {
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 10,
      padding: 12,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    scheduleText: {
      fontSize: 12,
      color: theme.textSecondary,
    },

    stopsSection: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    stopsSectionTitle: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "700",
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    allOnRouteNote: {
      fontSize: 12,
      color: theme.textSecondary,
      fontStyle: "italic",
      marginBottom: 10,
    },
    stopItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 14,
      position: "relative",
    },
    stopDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.textSecondary,
      marginTop: 3,
      flexShrink: 0,
    },
    stopDotFirst: {
      backgroundColor: theme.success,
    },
    stopDotLast: {
      backgroundColor: theme.accent,
    },
    stopConnector: {
      position: "absolute",
      left: 5,
      top: 14,
      width: 2,
      height: 26,
    },
    stopNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    stopItemName: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
    },
    stopBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    stopBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },
    stopItemAddress: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    stopItemTime: {
      fontSize: 11,
      color: theme.accent,
      marginTop: 2,
    },

    requestArea: { marginTop: 8 },
    requestBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    requestBtnText: { fontSize: 12, fontWeight: "600" },

    pickerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    pickerChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      minWidth: 60,
      alignItems: "center",
    },
    pickerChipText: { fontSize: 12, fontWeight: "600" },
    pickerCancel: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },

    // Empty state
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      borderWidth: 1,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 20,
    },
    emptyBtn: {
      borderRadius: 50,
      overflow: "hidden",
    },
    emptyBtnGradient: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
    emptyBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
