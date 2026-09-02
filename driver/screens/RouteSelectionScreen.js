import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { updateHasSelectedRoute } from "../lib/AuthSlice";
import { useDispatch, useSelector } from "react-redux";
import {
  getVehicleRoutesForDriver,
  setSelectedRouteId,
} from "../lib/VehicleRoutesSlice";
import { LinearGradient } from "expo-linear-gradient";

const DAY_SHORT = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function RouteCard({ route, selected, onPress }) {
  const { theme: T } = useTheme();
  const stops = route.stops
    ? [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder)
    : [];
  const isActive = selected?.id === route.id;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: T.surface,
          borderColor: isActive ? T.accent : T.border,
          shadowColor: isActive ? T.accent : "transparent",
        },
      ]}
      onPress={() => onPress(route)}
      activeOpacity={0.85}
    >
      {/* Active indicator strip */}
      {isActive && (
        <View style={[styles.cardStrip, { backgroundColor: T.accent }]} />
      )}

      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.routeIcon,
              { backgroundColor: T.accentDim, borderColor: T.accentBorder },
            ]}
          >
            <Ionicons name="map" size={20} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.routeName, { color: T.text }]}>
              {route.routeName}
            </Text>
            <Text style={[styles.routeMeta, { color: T.textMuted }]}>
              {route.startTime?.slice(0, 5)} –{" "}
              {route.estimatedEndTime?.slice(0, 5)}
              {"  ·  "}
              {route.totalDistance
                ? `${route.totalDistance} km`
                : `${stops.length} stops`}
            </Text>
          </View>
          <View
            style={[
              styles.selectCircle,
              { borderColor: isActive ? T.accent : T.borderStrong },
              isActive && { backgroundColor: T.accent },
            ]}
          >
            {isActive && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </View>

        {/* Active days */}
        {route.activeDays?.length > 0 && (
          <View style={styles.daysRow}>
            {route.activeDays.map((d) => {
              const today = new Date().toLocaleDateString("en-US", {
                weekday: "long",
              });
              const isToday = d === today;
              return (
                <View
                  key={d}
                  style={[
                    styles.dayChip,
                    { backgroundColor: T.inputBg, borderColor: T.border },
                    isToday && {
                      backgroundColor: T.accentDim,
                      borderColor: T.accentBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      { color: T.textMuted },
                      isToday && { color: T.accent, fontWeight: "700" },
                    ]}
                  >
                    {DAY_SHORT[d] || d}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Stops preview */}
        {stops.length > 0 && (
          <View style={[styles.stopsPreview, { borderTopColor: T.border }]}>
            <View style={styles.stopLine}>
              <View
                style={[styles.stopDotGreen, { backgroundColor: T.success }]}
              />
              <Text
                style={[styles.stopPreviewText, { color: T.textSecondary }]}
                numberOfLines={1}
              >
                {stops[0]?.stopName}
              </Text>
            </View>
            {stops.length > 2 && (
              <Text style={[styles.moreStops, { color: T.textMuted }]}>
                + {stops.length - 2} more stop{stops.length - 2 > 1 ? "s" : ""}
              </Text>
            )}
            {stops.length > 1 && (
              <View style={styles.stopLine}>
                <View
                  style={[styles.stopDotRed, { backgroundColor: T.accent }]}
                />
                <Text
                  style={[styles.stopPreviewText, { color: T.textSecondary }]}
                  numberOfLines={1}
                >
                  {stops[stops.length - 1]?.stopName}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function RouteSelectionScreen({ navigation, onSkip }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { driverRoutes, isLoading } = useSelector(
    (state) => state.vehicleroutes,
  );
  const { user } = useSelector((state) => state.auth);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    dispatch(getVehicleRoutesForDriver());
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);

    dispatch(setSelectedRouteId(selected.id));
    await dispatch(updateHasSelectedRoute(true));
    setConfirming(false);
    // Don't navigate manually — App.js swaps RouteSelection -> Main
    // automatically once `hasSelectedRoute` flips to true.
  };

  const handleSkip = async () => {
    await dispatch(updateHasSelectedRoute(true));
  };

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <View
          style={[
            styles.avatarBadge,
            { backgroundColor: T.accentDim, borderColor: T.accentBorder },
          ]}
        >
          <Ionicons name="person" size={22} color={T.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: T.textMuted }]}>
            {timeOfDay()},
          </Text>
          <Text style={[styles.userName, { color: T.text }]}>
            {user?.fullname || user?.name || "Driver"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: T.textMuted }]}>Not now</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleSection}>
        <Text style={[styles.title, { color: T.text }]}>
          Which route are{"\n"}you driving today?
        </Text>
        <Text style={[styles.subtitle, { color: T.textMuted }]}>
          Select your active route to start tracking and sharing your location
          with guardians.
        </Text>
      </View>

      {/* Route list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={[styles.loadingText, { color: T.textMuted }]}>
            Loading your routes…
          </Text>
        </View>
      ) : driverRoutes?.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: T.accentDim }]}>
            <Ionicons name="map-outline" size={36} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No routes yet
          </Text>
          <Text style={[styles.emptyBody, { color: T.textMuted }]}>
            You haven't set up any routes. You can add routes from the Routes
            screen.
          </Text>
          <TouchableOpacity onPress={handleSkip} style={styles.skipLink}>
            <Text style={[styles.skipLinkText, { color: T.accent }]}>
              Go to the app →
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={driverRoutes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RouteCard route={item} selected={selected} onPress={setSelected} />
          )}
        />
      )}

      {/* Bottom action */}
      {driverRoutes?.length > 0 && (
        <View
          style={[
            styles.footer,
            { backgroundColor: T.bg, borderTopColor: T.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!selected || confirming) && { opacity: 0.55 },
            ]}
            onPress={handleConfirm}
            disabled={!selected || confirming}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.confirmBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {confirming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>
                    {selected
                      ? `Start — ${selected.routeName}`
                      : "Select a route first"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.footerSkip}>
            <Text style={[styles.footerSkipText, { color: T.textMuted }]}>
              I'll choose later
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 12 },
  userName: { fontSize: 16, fontWeight: "700" },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  skipText: { fontSize: 13 },

  titleSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, lineHeight: 22 },

  list: { padding: 16, paddingBottom: 160, gap: 14 },

  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  cardStrip: { height: 3, width: "100%" },
  cardBody: { padding: 16 },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  routeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  routeName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  routeMeta: { fontSize: 12 },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  dayChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 11, fontWeight: "600" },

  stopsPreview: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  stopLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  stopDotGreen: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stopDotRed: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stopPreviewText: { fontSize: 13, flex: 1 },
  moreStops: { fontSize: 11, paddingLeft: 18 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: { fontSize: 14 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  skipLink: { marginTop: 8 },
  skipLinkText: { fontSize: 14, fontWeight: "700" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopWidth: 1,
    gap: 10,
  },
  confirmBtn: { borderRadius: 50, overflow: "hidden" },
  confirmBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footerSkip: { alignItems: "center", paddingVertical: 4 },
  footerSkipText: { fontSize: 13 },
});
