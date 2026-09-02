// screens/guardian/StudentDetailScreen.js
import React, { useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGuardianStudents } from "../lib/UserSlice";
import {
  selectTripStatus,
  selectCompletedStops,
} from "../lib/VehicleTrackingSlice";

export default function StudentDetailScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const studentId = route?.params?.studentId;
  const { students, isLoading } = useSelector((state) => state.users);

  const [student, setStudent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (students.length > 0 && studentId) {
      const found = students.find((s) => s.id === studentId);
      setStudent(found);
    }
  }, [students, studentId]);

  const vehicleId =
    student?.vehicleRoute?.vehicleId ?? student?.vehicleRoute?.vehicle?.id;
  const tripStatus = useSelector(selectTripStatus(vehicleId));
  const completedStopIndexes = useSelector(
    selectCompletedStops(vehicleId),
    shallowEqual,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(getGuardianStudents());
    setRefreshing(false);
  };

  if (isLoading && !student) {
    return (
      <View style={[styles.center, { backgroundColor: T.bg }]}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={[styles.center, { backgroundColor: T.bg }]}>
        <Text style={[styles.errorText, { color: T.textMuted }]}>
          Student not found
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={T.text} />
          <Text style={[styles.backText, { color: T.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // FIXED: Renamed to avoid conflict with navigation 'route' parameter
  const vehicleRoute = student.vehicleRoute;
  const vehicle = vehicleRoute?.vehicle;
  const stops = vehicleRoute?.stops || [];
  const completedCount = completedStopIndexes?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={T.accent}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: T.border,
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.backBtnHeader, { backgroundColor: T.surface }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </TouchableOpacity>

          <Text
            style={[styles.headerTitle, { color: T.text }]}
            numberOfLines={1}
          >
            Student Profile
          </Text>

          <View style={{ width: 36 }} />
        </View>

        {/* Student Info Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {student.fullname?.charAt(0) || "S"}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: T.text }]}>
            {student.fullname || "Student"}
          </Text>
          <Text style={[styles.profileStatus, { color: T.textMuted }]}>
            {student.isActive ? "Active" : "Inactive"}
          </Text>
        </View>

        {/* Trip Status */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Trip Status
          </Text>
          <View style={styles.tripStatusRow}>
            <View style={styles.tripStatusIcon}>
              <Ionicons
                name={tripStatus === "active" ? "play-circle" : "pause-circle"}
                size={24}
                color={tripStatus === "active" ? "#4CAF50" : T.textMuted}
              />
            </View>
            <View>
              <Text style={[styles.tripStatusLabel, { color: T.text }]}>
                {tripStatus === "active" ? "On Trip" : "Idle"}
              </Text>
              <Text style={[styles.tripStatusSub, { color: T.textMuted }]}>
                {tripStatus === "active"
                  ? `${completedCount} of ${stops.length} stops completed`
                  : "No active trip"}
              </Text>
            </View>
          </View>
        </View>

        {/* Route Info */}
        {vehicleRoute && (
          <View
            style={[
              styles.section,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: T.text }]}>
              Route Information
            </Text>

            <View style={styles.routeRow}>
              <Ionicons name="map-outline" size={18} color={T.accent} />
              <Text style={[styles.routeText, { color: T.text }]}>
                {vehicleRoute.routeName || "Unnamed Route"}
              </Text>
            </View>

            {vehicle && (
              <View style={styles.routeRow}>
                <Ionicons name="bus-outline" size={18} color={T.accent} />
                <Text style={[styles.routeText, { color: T.text }]}>
                  {vehicle.carMake} {vehicle.carModel}
                </Text>
              </View>
            )}

            <View style={styles.routeRow}>
              <Ionicons name="time-outline" size={18} color={T.accent} />
              <Text style={[styles.routeText, { color: T.text }]}>
                {vehicleRoute.startTime} - {vehicleRoute.estimatedEndTime}
              </Text>
            </View>

            <View style={styles.routeRow}>
              <Ionicons name="location-outline" size={18} color={T.accent} />
              <Text style={[styles.routeText, { color: T.text }]}>
                {stops.length} stops
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.viewRouteBtn, { borderColor: T.border }]}
              onPress={() =>
                navigation.navigate("RouteDetail", { routeId: vehicleRoute.id })
              }
            >
              <Text style={[styles.viewRouteText, { color: T.accent }]}>
                View Full Route →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stops Progress */}
        {vehicleRoute && stops.length > 0 && (
          <View
            style={[
              styles.section,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: T.text }]}>
              Stops Progress
            </Text>

            <View style={styles.progressWrapper}>
              <View
                style={[styles.progressTrack, { backgroundColor: T.border }]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: T.accent,
                      width: `${(completedCount / stops.length) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: T.textMuted }]}>
                {completedCount} of {stops.length} completed
              </Text>
            </View>

            {stops.map((stop, index) => {
              const isCompleted = completedStopIndexes?.includes(index);
              return (
                <View key={stop.id || index} style={styles.stopRow}>
                  <View
                    style={[
                      styles.stopStatus,
                      { backgroundColor: isCompleted ? T.success : T.border },
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={styles.stopIndex}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={[styles.stopName, { color: T.text }]}>
                      {stop.stopName}
                    </Text>
                    <Text style={[styles.stopTime, { color: T.textMuted }]}>
                      {stop.scheduledPickupTime || "Time not set"}
                    </Text>
                  </View>
                  {isCompleted && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={T.success}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Addresses */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Addresses
          </Text>

          <View style={styles.addressRow}>
            <Ionicons name="home-outline" size={18} color={T.textMuted} />
            <View style={styles.addressInfo}>
              <Text style={[styles.addressLabel, { color: T.textMuted }]}>
                Home
              </Text>
              <Text style={[styles.addressText, { color: T.text }]}>
                {student.homeAddress?.address || "Not set"}
              </Text>
            </View>
          </View>

          <View style={[styles.addressRow, { marginTop: 10 }]}>
            <Ionicons name="school-outline" size={18} color={T.textMuted} />
            <View style={styles.addressInfo}>
              <Text style={[styles.addressLabel, { color: T.textMuted }]}>
                School
              </Text>
              <Text style={[styles.addressText, { color: T.text }]}>
                {student.schoolAddress?.address || "Not set"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtnHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  profileCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(232,48,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  profileAvatarText: { fontSize: 28, fontWeight: "700", color: "#e83030" },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileStatus: { fontSize: 13, marginTop: 2 },

  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },

  tripStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tripStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tripStatusLabel: { fontSize: 14, fontWeight: "600" },
  tripStatusSub: { fontSize: 12, marginTop: 2 },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  routeText: { fontSize: 14 },

  viewRouteBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewRouteText: { fontSize: 13, fontWeight: "600" },

  progressWrapper: { gap: 8 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 12, textAlign: "center" },

  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  stopStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stopIndex: { color: "#fff", fontSize: 11, fontWeight: "700" },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 14 },
  stopTime: { fontSize: 11 },

  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  addressInfo: { flex: 1 },
  addressLabel: { fontSize: 11, fontWeight: "600" },
  addressText: { fontSize: 13, marginTop: 1 },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backText: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 16 },
});
