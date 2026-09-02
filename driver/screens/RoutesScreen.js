import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import {
  getVehicleRouteById,
  getRouteScheduleForToday,
  getVehicleRoutesForDriver,
  getAllVehicleRoutes,
  updateVehicleRoute,
  updateVehicleStop,
  deleteStopFromRoute,
  deleteRoute,
} from "../lib/VehicleRoutesSlice";
import { useTheme } from "../contexts/ThemeContext";
import Toast from "react-native-toast-message";

const DAY_SHORT = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function RouteCard({ route, onEdit, onDelete, onViewStops, theme }) {
  const [expanded, setExpanded] = useState(false);
  const stops = route.stops
    ? [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder)
    : [];
  const styles = getStyles(theme);

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
            {route.estimatedEndTime?.slice(0, 5)} · {route.totalDistance || "—"}{" "}
            km
          </Text>
        </View>
        <View style={styles.routeActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(route)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete(route)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color="rgba(232,48,48,0.6)"
            />
          </TouchableOpacity>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Active days */}
          <View style={styles.daysRow}>
            {(route.activeDays || []).map((d) => (
              <View key={d} style={styles.dayChip}>
                <Text style={styles.dayChipText}>{DAY_SHORT[d] || d}</Text>
              </View>
            ))}
            <View
              style={[
                styles.dayChip,
                {
                  backgroundColor: theme.accentDim,
                  borderColor: theme.accentBorder,
                },
              ]}
            >
              <Text style={[styles.dayChipText, { color: theme.accent }]}>
                {route.routeType || "both"}
              </Text>
            </View>
          </View>

          {/* Schedule block */}
          <View
            style={[
              styles.scheduleBlock,
              { backgroundColor: "rgba(255,255,255,0.03)" },
            ]}
          >
            <View style={styles.scheduleRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={styles.scheduleText}>
                Start: {route.startTime?.slice(0, 5) || "—"}
              </Text>
            </View>
            <View style={styles.scheduleRow}>
              <Ionicons
                name="flag-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={styles.scheduleText}>
                Est. end: {route.estimatedEndTime?.slice(0, 5) || "—"}
              </Text>
            </View>
            <View style={styles.scheduleRow}>
              <Ionicons
                name="speedometer-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={styles.scheduleText}>
                Duration:{" "}
                {route.estimatedDuration
                  ? `${route.estimatedDuration} min`
                  : "—"}
              </Text>
            </View>
          </View>

          {/* Stops list */}
          <View style={styles.stopsSection}>
            <Text style={styles.stopsSectionTitle}>
              {stops.length} Stop{stops.length !== 1 ? "s" : ""}
            </Text>
            {stops.map((stop, idx) => (
              <View key={stop.id || idx} style={styles.stopItem}>
                <View
                  style={[
                    styles.stopDot,
                    idx === 0 && styles.stopDotFirst,
                    idx === stops.length - 1 && styles.stopDotLast,
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
                  <Text style={styles.stopItemName}>{stop.stopName}</Text>
                  <Text style={styles.stopItemAddress} numberOfLines={1}>
                    {stop.location?.address}
                  </Text>
                  {(stop.scheduledPickupTime || stop.scheduledDropoffTime) && (
                    <Text style={styles.stopItemTime}>
                      {stop.scheduledPickupTime?.slice(0, 5)}{" "}
                      {stop.scheduledDropoffTime
                        ? `→ ${stop.scheduledDropoffTime.slice(0, 5)}`
                        : ""}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export default function RoutesScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const styles = getStyles(theme);

  const { driverRoutes, isLoading } = useSelector(
    (state) => state.vehicleroutes,
  );

  const load = () => {
    dispatch(getVehicleRoutesForDriver());
  };

  useEffect(() => {
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(getVehicleRoutesForDriver());
    setRefreshing(false);
  };

  const handleEdit = (route) => {
    navigation.navigate("CreateRoute", {
      editRoute: route,
      vehicleId: route.vehicleId,
    });
  };

  const handleDelete = (route) => {
    Alert.alert(
      "Delete Route",
      `Delete ${route.routeName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            dispatch(deleteRoute(route.id));
            Toast.show({
              type: "error",
              text1: "Route deleted",
            });
            dispatch(getVehicleRoutesForDriver());
          },
        },
      ],
    );
  };

  const handleAddRoute = () => {
    const vehicleId = driverRoutes[0]?.vehicleId;
    navigation.navigate("CreateRoute", { vehicleId });
  };
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.menuBtn,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
            },
          ]}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Routes</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.accent }]}
          onPress={handleAddRoute}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : driverRoutes?.length === 0 ? (
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
            Add your first route to start accepting students.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={handleAddRoute}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[theme.accent, "#c01818"]}
              style={styles.emptyBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Add Route</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={driverRoutes}
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
              onEdit={handleEdit}
              onDelete={handleDelete}
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
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
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
    routeActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    iconBtn: {
      padding: 4,
    },

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
    stopItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
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
    stopItemName: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
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
