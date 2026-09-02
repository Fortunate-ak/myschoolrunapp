// screens/guardian/GuardianFindDriverScreen.js
import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { getAllVehicles } from "../lib/VehicleRoutesSlice";
import { sendRequest } from "../lib/GuardianRequestsSlice";
import api from "../utils/axiosInstance";

const MEDIA_BASE_URL = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
const resolveImageUri = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE_URL}/${path.replace(/^\/+/, "")}`;
};

export default function FindDriverScreen({ navigation }) {
  const dispatch = useDispatch();
  const { vehicles, isLoading } = useSelector((state) => state.vehicleroutes);
  const { students, guardianProfile } = useSelector((state) => state.users);
  const { isLoading: isSending } = useSelector(
    (state) => state.guardianRequests,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    dispatch(getAllVehicles());
  }, []);

  // Set first student as default when students load
  useEffect(() => {
    if (students && students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]);
    }
  }, [students]);

  useEffect(() => {
    if (vehicles) {
      const filtered = vehicles.filter((vehicle) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          vehicle.carMake?.toLowerCase().includes(query) ||
          vehicle.carModel?.toLowerCase().includes(query) ||
          vehicle.registrationNumber?.toLowerCase().includes(query) ||
          vehicle.driver?.user?.fullname?.toLowerCase().includes(query)
        );
      });
      setFilteredVehicles(filtered);
    }
  }, [vehicles, searchQuery]);

  const handleSelectVehicle = (vehicle) => {
    const isDeselecting = selectedVehicle?.id === vehicle.id;
    setSelectedVehicle(isDeselecting ? null : vehicle);
    setSelectedStop(null);
    const routes = vehicle.routes || [];
    setSelectedRoute(!isDeselecting && routes.length === 1 ? routes[0] : null);
  };

  const handleSelectRoute = (route) => {
    const isDeselecting = selectedRoute?.id === route.id;
    setSelectedRoute(isDeselecting ? null : route);
    setSelectedStop(null);
  };

  const handleSendRequest = async () => {
    if (!selectedStudent) {
      Toast.show({
        type: "error",
        text1: "No Student Selected",
        text2: "Please select a student to request for",
      });
      return;
    }

    if (!selectedVehicle) {
      Toast.show({
        type: "error",
        text1: "No Vehicle Selected",
        text2: "Please select a vehicle for your student",
      });
      return;
    }

    if (!selectedRoute) {
      Toast.show({
        type: "error",
        text1: "No Route Selected",
        text2: "Please select a route for your student",
      });
      return;
    }

    if (!selectedStop) {
      Toast.show({
        type: "error",
        text1: "No Stop Selected",
        text2: "Please select a pickup stop on this route",
      });
      return;
    }

    const driverId = selectedVehicle.driver?.id;
    if (!driverId) {
      Toast.show({
        type: "error",
        text1: "Driver Unavailable",
        text2: "This route doesn't have an assigned driver yet",
      });
      return;
    }

    // ── SUBSCRIPTION / TRIAL GATE (client-side pre-check) ─────────────────
    // This is a fast, local check using whatever guardianProfile was last
    // fetched — it saves a round trip in the common case. The backend
    // (createRequest) enforces the same rule authoritatively, so if this
    // check is stale (e.g. trial expired mid-session) the request below
    // will still be rejected with a 403 and handled in the catch block.
    if (guardianProfile && guardianProfile.canUseApp === false) {
      navigation.navigate("Subscription", { reason: "trial_expired" });
      return;
    }

    setIsSubmitting(true);

    try {
      await dispatch(
        sendRequest({
          driverId,
          requestType: "route_stop_request",
          studentId: selectedStudent.id,
          routeId: selectedRoute.id,
          vehicleStopId: selectedStop.id,
        }),
      ).unwrap();

      Toast.show({
        type: "success",
        text1: "Request Sent!",
        text2: `Request sent for ${selectedStudent.fullname}. The driver will review it.`,
      });

      // Subscription is no longer a forced next step, so this now returns
      // the guardian to Main instead of resetting into a (now-removed)
      // "GuardianSubscription" route.
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (error) {
      // Backend's authoritative gate (see createRequest) rejects with
      // { message, code: "SUBSCRIPTION_REQUIRED" } when the trial/
      // subscription check fails server-side (see updated
      // GuardianRequestsSlice.js) — route the guardian to Subscription
      // instead of showing a generic error toast.
      if (error && typeof error === "object" && error.code === "SUBSCRIPTION_REQUIRED") {
        navigation.navigate("Subscription", { reason: "trial_expired" });
        return;
      }

      const message =
        typeof error === "string"
          ? error
          : error?.message || "Please try again";

      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStudentSelector = () => {
    if (!students || students.length <= 1) return null;

    return (
      <View style={styles.studentSelector}>
        <Text style={styles.studentSelectorLabel}>Select Student:</Text>
        <View style={styles.studentChipRow}>
          {students.map((student) => {
            const isSelected = selectedStudent?.id === student.id;
            return (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentChip,
                  isSelected && styles.studentChipActive,
                ]}
                onPress={() => {
                  setSelectedStudent(student);
                  // Reset selections when switching students
                  setSelectedVehicle(null);
                  setSelectedRoute(null);
                  setSelectedStop(null);
                }}
              >
                <Text
                  style={[
                    styles.studentChipText,
                    isSelected && styles.studentChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {student.fullname}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderVehicleItem = ({ item }) => {
    const isSelected = selectedVehicle?.id === item.id;
    const driverName = item.driver?.user?.fullname || "Unassigned";
    const vehicleImageUri = resolveImageUri(item.image);
    const driverPhotoUri = resolveImageUri(item.driver?.profileImage);
    const routes = item.routes || [];
    const activeRoute = isSelected ? selectedRoute : null;

    return (
      <TouchableOpacity
        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
        onPress={() => handleSelectVehicle(item)}
        activeOpacity={0.7}
      >
        <View style={styles.routeHeader}>
          {vehicleImageUri ? (
            <Image
              source={{ uri: vehicleImageUri }}
              style={styles.vehicleThumb}
            />
          ) : (
            <View style={styles.routeBadge}>
              <Ionicons name="bus" size={20} color="#e83030" />
            </View>
          )}
          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>
              {item.carMake} {item.carModel}
            </Text>
            <Text style={styles.routeDriver}>{item.registrationNumber}</Text>
          </View>
          <View style={styles.driverBadgeWrap}>
            {driverPhotoUri ? (
              <Image
                source={{ uri: driverPhotoUri }}
                style={styles.driverPhoto}
              />
            ) : (
              <View style={styles.driverPhotoFallback}>
                <Ionicons
                  name="person"
                  size={16}
                  color="rgba(255,255,255,0.4)"
                />
              </View>
            )}
            <Text style={styles.driverNameSmall} numberOfLines={1}>
              {driverName}
            </Text>
          </View>
        </View>

        <View style={styles.routeDetails}>
          <View style={styles.detailItem}>
            <Ionicons
              name="people-outline"
              size={14}
              color="rgba(255,255,255,0.4)"
            />
            <Text style={styles.detailText}>{item.capacity} seats</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons
              name="map-outline"
              size={14}
              color="rgba(255,255,255,0.4)"
            />
            <Text style={styles.detailText}>
              {routes.length} {routes.length === 1 ? "route" : "routes"}
            </Text>
          </View>
        </View>

        {isSelected && routes.length > 1 && (
          <View style={styles.stopPickerWrap}>
            <Text style={styles.stopPickerLabel}>Choose a route</Text>
            <View style={styles.stopChipRow}>
              {routes.map((route) => {
                const routeSelected = selectedRoute?.id === route.id;
                return (
                  <TouchableOpacity
                    key={route.id}
                    style={[
                      styles.stopChip,
                      routeSelected && styles.stopChipActive,
                    ]}
                    onPress={() => handleSelectRoute(route)}
                    activeOpacity={0.8}
                  >
                    {routeSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#fff"
                      />
                    )}
                    <Text
                      style={[
                        styles.stopChipText,
                        routeSelected && styles.stopChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {route.routeName || route.routeNumber || "Route"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {isSelected && activeRoute && (
          <View style={styles.stopPickerWrap}>
            <Text style={styles.stopPickerLabel}>Choose a pickup stop</Text>
            <View style={styles.stopChipRow}>
              {(activeRoute.stops || []).map((stop) => {
                const stopSelected = selectedStop?.id === stop.id;
                return (
                  <TouchableOpacity
                    key={stop.id}
                    style={[
                      styles.stopChip,
                      stopSelected && styles.stopChipActive,
                    ]}
                    onPress={() => setSelectedStop(stop)}
                    activeOpacity={0.8}
                  >
                    {stopSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#fff"
                      />
                    )}
                    <Text
                      style={[
                        styles.stopChipText,
                        stopSelected && styles.stopChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {stop.stopName || stop.location?.address || "Stop"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {(activeRoute.stops || []).length === 0 && (
                <Text style={styles.noStopsText}>
                  This route has no stops set up yet
                </Text>
              )}
            </View>
          </View>
        )}

        {isSelected && !activeRoute && routes.length === 0 && (
          <Text style={styles.noStopsText}>
            This vehicle has no active routes yet
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Find Driver</Text>
          <Text style={styles.headerSub}>Step 2 of 3</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color="rgba(255,255,255,0.3)"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by driver, vehicle, or plate..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color="rgba(255,255,255,0.3)"
            />
          </TouchableOpacity>
        )}
      </View>

      {renderStudentSelector()}

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color="#e83030" size="large" />
          <Text style={styles.loadingText}>Loading available vehicles...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVehicleItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="bus-outline"
                size={48}
                color="rgba(255,255,255,0.15)"
              />
              <Text style={styles.emptyTitle}>No Vehicles Available</Text>
              <Text style={styles.emptyBody}>
                {searchQuery
                  ? "No vehicles match your search. Try a different term."
                  : "There are no active vehicles available at the moment."}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedStudent ||
              !selectedVehicle ||
              !selectedRoute ||
              !selectedStop ||
              isSubmitting ||
              isSending) &&
              styles.disabledBtn,
          ]}
          onPress={handleSendRequest}
          disabled={
            !selectedStudent ||
            !selectedVehicle ||
            !selectedRoute ||
            !selectedStop ||
            isSubmitting ||
            isSending
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={
              selectedStudent &&
              selectedVehicle &&
              selectedRoute &&
              selectedStop &&
              !isSubmitting &&
              !isSending
                ? ["#e83030", "#c01818"]
                : ["#333", "#222"]
            }
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSubmitting || isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>Send Request</Text>
                <Ionicons name="send" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          {selectedStudent
            ? `Requesting for ${selectedStudent.fullname}`
            : "Please select a student first"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: "#ffffff", fontSize: 14, height: "100%" },

  studentSelector: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  studentSelectorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  studentChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  studentChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  studentChipActive: {
    backgroundColor: "#e83030",
    borderColor: "#e83030",
  },
  studentChipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  studentChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  centerContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "rgba(255,255,255,0.4)", marginTop: 12, fontSize: 14 },

  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  routeCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    marginBottom: 12,
  },
  routeCardSelected: { borderColor: "#e83030", backgroundColor: "#1f0808" },
  routeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(232,48,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  routeDriver: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  driverBadgeWrap: { alignItems: "center", maxWidth: 64 },
  driverPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  driverPhotoFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  driverNameSmall: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
    textAlign: "center",
  },

  routeDetails: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, color: "rgba(255,255,255,0.4)" },

  stopPickerWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(232,48,48,0.2)",
  },
  stopPickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  stopChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stopChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    maxWidth: "100%",
  },
  stopChipActive: { backgroundColor: "#e83030", borderColor: "#e83030" },
  stopChipText: { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  stopChipTextActive: { color: "#fff", fontWeight: "600" },
  noStopsText: { fontSize: 12, color: "rgba(255,255,255,0.3)" },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: "#0d0d0d",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  submitBtn: { borderRadius: 50, overflow: "hidden" },
  disabledBtn: { opacity: 0.6 },
  submitGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  footerNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 10,
  },
});
