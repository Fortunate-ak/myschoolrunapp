// screens/guardian/RequestsScreen.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { getAllVehicles } from "../lib/VehicleRoutesSlice";
import {
  sendRequest,
  cancelRequest,
  getAllRequests,
} from "../lib/GuardianRequestsSlice";
import api from "../utils/axiosInstance";

const MEDIA_BASE_URL = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
const resolveImageUri = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE_URL}/${path.replace(/^\/+/, "")}`;
};

const STATUS_COLOR = {
  pending: "#FFA726",
  approved: "#4CAF50",
  rejected: "#ef4444",
  cancelled: "#888",
};

export default function RequestsScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { vehicles, isLoading: vehiclesLoading } = useSelector(
    (s) => s.vehicleroutes,
  );
  const { requests, isLoading: requestsLoading } = useSelector(
    (s) => s.guardianRequests,
  );
  const { guardianProfile } = useSelector((s) => s.users);
  const students = guardianProfile?.students || [];

  const [view, setView] = useState("new");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileVehicle, setProfileVehicle] = useState(null);

  useEffect(() => {
    dispatch(getAllVehicles());
    dispatch(getAllRequests());
  }, []);

  useEffect(() => {
    if (students.length > 0 && selectedStudentIds.length === 0) {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  }, [students]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles || [];
    const q = searchQuery.toLowerCase().trim();
    return (vehicles || []).filter((vehicle) => {
      const driverName = vehicle.driver?.user?.fullname?.toLowerCase() || "";
      if (driverName.includes(q)) return true;
      const carDetails =
        `${vehicle.carMake} ${vehicle.carModel} ${vehicle.registrationNumber}`.toLowerCase();
      if (carDetails.includes(q)) return true;
      const routes = vehicle.routes || [];
      for (const route of routes) {
        if (route.routeName?.toLowerCase().includes(q)) return true;
        const stops = route.stops || [];
        for (const stop of stops) {
          if (stop.stopName?.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [vehicles, searchQuery]);

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const handleSelectVehicle = (vehicle) => {
    const isDeselecting = selectedVehicle?.id === vehicle.id;
    setSelectedVehicle(isDeselecting ? null : vehicle);
    setSelectedRoute(null);
    setSelectedStop(null);
    if (!isDeselecting) {
      const routes = vehicle.routes || [];
      setSelectedRoute(routes.length === 1 ? routes[0] : null);
    }
  };

  const handleSendRequest = async () => {
    if (selectedStudentIds.length === 0) {
      Toast.show({
        type: "error",
        text1: "No Students Selected",
        text2: "Select at least one student to send a request",
      });
      return;
    }
    if (!selectedVehicle || !selectedRoute || !selectedStop) {
      Toast.show({
        type: "error",
        text1: "Incomplete Selection",
        text2: "Choose a vehicle, route and stop first",
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

    setIsSubmitting(true);
    try {
      await dispatch(
        sendRequest({
          driverId,
          requestType: "route_stop_request",
          studentIds: selectedStudentIds,
          routeId: selectedRoute.id,
          vehicleStopId: selectedStop.id,
        }),
      ).unwrap();

      Toast.show({
        type: "success",
        text1: "Request Sent!",
        text2: `Request for ${selectedStudentIds.length} student(s) sent to the driver`,
      });

      setSelectedVehicle(null);
      setSelectedRoute(null);
      setSelectedStop(null);
      setSelectedStudentIds([]);
      dispatch(getAllRequests());
      setView("history");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: typeof error === "string" ? error : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await dispatch(cancelRequest(id)).unwrap();
      Toast.show({ type: "success", text1: "Request Cancelled" });
      dispatch(getAllRequests());
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't Cancel",
        text2: typeof error === "string" ? error : "Please try again",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const renderStudentCheckbox = ({ item }) => {
    const isChecked = selectedStudentIds.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.checkboxRow, { borderColor: T.border }]}
        onPress={() => toggleStudent(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            isChecked && { backgroundColor: T.accent, borderColor: T.accent },
          ]}
        >
          {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: T.text }]}>
          {item.fullname}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderVehicleItem = ({ item }) => {
    const isSelected = selectedVehicle?.id === item.id;
    const driverName = item.driver?.user?.fullname || "Unassigned";
    const vehicleImageUri = resolveImageUri(item.image);
    const routes = item.routes || [];
    const activeRoute = isSelected ? selectedRoute : null;
    const stops = activeRoute?.stops || [];

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: T.surface, borderColor: T.border },
          isSelected && { borderColor: T.accent, backgroundColor: T.accentDim },
        ]}
      >
        <TouchableOpacity
          onPress={() => handleSelectVehicle(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            {vehicleImageUri ? (
              <Image source={{ uri: vehicleImageUri }} style={styles.thumb} />
            ) : (
              <View
                style={[styles.thumbFallback, { backgroundColor: T.accentDim }]}
              >
                <Ionicons name="bus" size={20} color={T.accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: T.text }]}>
                {item.carMake} {item.carModel}
              </Text>
              <Text style={[styles.cardSub, { color: T.textMuted }]}>
                {driverName} · {item.registrationNumber}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.profileBtn, { borderColor: T.border }]}
              onPress={() => {
                setProfileVehicle(item);
                setProfileModalVisible(true);
              }}
            >
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={T.accent}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {isSelected && routes.length > 1 && (
          <View style={styles.chipRow}>
            {routes.map((route) => {
              const routeSelected = selectedRoute?.id === route.id;
              return (
                <TouchableOpacity
                  key={route.id}
                  style={[
                    styles.chip,
                    { borderColor: T.border },
                    routeSelected && {
                      backgroundColor: T.accent,
                      borderColor: T.accent,
                    },
                  ]}
                  onPress={() => {
                    setSelectedRoute(routeSelected ? null : route);
                    setSelectedStop(null);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: T.textMuted },
                      routeSelected && { color: "#fff", fontWeight: "600" },
                    ]}
                  >
                    {route.routeName || "Route"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {isSelected && activeRoute && (
          <View style={styles.chipRow}>
            <Text style={[styles.hintText, { color: T.textMuted }]}>
              Select school stop:
            </Text>
            {stops.length === 0 ? (
              <Text style={[styles.cardSub, { color: T.textMuted }]}>
                No stops on this route
              </Text>
            ) : (
              stops.map((stop) => {
                const stopSelected = selectedStop?.id === stop.id;
                return (
                  <TouchableOpacity
                    key={stop.id}
                    style={[
                      styles.chip,
                      { borderColor: T.border },
                      stopSelected && {
                        backgroundColor: T.accent,
                        borderColor: T.accent,
                      },
                    ]}
                    onPress={() => setSelectedStop(stopSelected ? null : stop)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: T.textMuted },
                        stopSelected && { color: "#fff", fontWeight: "600" },
                      ]}
                    >
                      {stop.stopName}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  };

  const renderRequestItem = ({ item }) => {
    const color = STATUS_COLOR[item.status] || T.textMuted;
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: T.surface, borderColor: T.border },
        ]}
      >
        <View style={styles.requestRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: T.text }]}>
              {item.requestType === "route_stop_request"
                ? "Route & Stop Request"
                : "Onboard Request"}
            </Text>
            <Text style={[styles.cardSub, { color: T.textMuted }]}>
              Sent {new Date(item.createdAt).toLocaleDateString()}
              {item.students && ` · ${item.students.length} student(s)`}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: color + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusText, { color }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {item.status === "pending" && (
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: T.border }]}
            onPress={() => handleCancel(item.id)}
            disabled={cancellingId === item.id}
          >
            {cancellingId === item.id ? (
              <ActivityIndicator size="small" color={T.textMuted} />
            ) : (
              <Text style={[styles.cancelText, { color: "#ef4444" }]}>
                Cancel Request
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderProfileModal = () => {
    if (!profileVehicle) return null;
    const v = profileVehicle;
    const driver = v.driver?.user;
    const routes = v.routes || [];
    return (
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: T.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>
                Vehicle Profile
              </Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color={T.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.modalRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.modalLabel, { color: T.textMuted }]}>
                  Make & Model
                </Text>
                <Text style={[styles.modalValue, { color: T.text }]}>
                  {v.carMake} {v.carModel}
                </Text>
              </View>
              <View style={[styles.modalRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.modalLabel, { color: T.textMuted }]}>
                  Registration
                </Text>
                <Text style={[styles.modalValue, { color: T.text }]}>
                  {v.registrationNumber}
                </Text>
              </View>
              <View style={[styles.modalRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.modalLabel, { color: T.textMuted }]}>
                  Capacity
                </Text>
                <Text style={[styles.modalValue, { color: T.text }]}>
                  {v.capacity || "N/A"} passengers
                </Text>
              </View>
              <View style={[styles.modalRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.modalLabel, { color: T.textMuted }]}>
                  Driver
                </Text>
                <Text style={[styles.modalValue, { color: T.text }]}>
                  {driver?.fullname || "Unassigned"}
                </Text>
              </View>
              {driver?.phone && (
                <View
                  style={[styles.modalRow, { borderBottomColor: T.border }]}
                >
                  <Text style={[styles.modalLabel, { color: T.textMuted }]}>
                    Driver Phone
                  </Text>
                  <Text style={[styles.modalValue, { color: T.text }]}>
                    {driver.phone}
                  </Text>
                </View>
              )}
              <Text style={[styles.modalSectionTitle, { color: T.text }]}>
                Routes
              </Text>
              {routes.length === 0 ? (
                <Text style={[styles.modalSub, { color: T.textMuted }]}>
                  No routes assigned
                </Text>
              ) : (
                routes.map((route) => (
                  <View
                    key={route.id}
                    style={[styles.modalRouteCard, { borderColor: T.border }]}
                  >
                    <Text style={[styles.modalRouteName, { color: T.text }]}>
                      {route.routeName || "Unnamed Route"}
                    </Text>
                    <Text
                      style={[styles.modalRouteTime, { color: T.textMuted }]}
                    >
                      {route.startTime} - {route.estimatedEndTime}
                    </Text>
                    <Text
                      style={[styles.modalRouteStops, { color: T.textMuted }]}
                    >
                      {route.stops?.length || 0} stops
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (vehiclesLoading && !vehicles) {
    return (
      <View style={[styles.center, { backgroundColor: T.bg }]}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: T.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: T.text }]}>Requests</Text>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            { borderColor: T.border },
            view === "new" && {
              backgroundColor: T.accent,
              borderColor: T.accent,
            },
          ]}
          onPress={() => setView("new")}
        >
          <Text
            style={[
              styles.segmentText,
              { color: T.textMuted },
              view === "new" && { color: "#fff", fontWeight: "700" },
            ]}
          >
            New Request
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            { borderColor: T.border },
            view === "history" && {
              backgroundColor: T.accent,
              borderColor: T.accent,
            },
          ]}
          onPress={() => setView("history")}
        >
          <Text
            style={[
              styles.segmentText,
              { color: T.textMuted },
              view === "history" && { color: "#fff", fontWeight: "700" },
            ]}
          >
            My Requests {requests?.length ? `(${requests.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {view === "new" ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: T.text }]}>
              Select Students ({selectedStudentIds.length} selected)
            </Text>
            <TouchableOpacity onPress={toggleAllStudents}>
              <Text style={[styles.selectAllText, { color: T.accent }]}>
                {selectedStudentIds.length === students.length
                  ? "Deselect All"
                  : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={students}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderStudentCheckbox}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.studentList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: T.textMuted }]}>
                No students added. Go to "My Students" to add.
              </Text>
            }
          />

          {/* ── Search Input – now uses theme ── */}
          <View
            style={[
              styles.searchWrapper,
              {
                backgroundColor: T.inputBg,
                borderColor: T.border,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={T.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: T.text }]}
              placeholder="Search by driver, route, stop, car..."
              placeholderTextColor={T.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={T.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredVehicles}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderVehicleItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: T.textMuted }}>
                  No vehicles match your search.
                </Text>
              </View>
            }
          />

          <View
            style={[
              styles.footer,
              { backgroundColor: T.bg, borderTopColor: T.border },
            ]}
          >
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSendRequest}
              disabled={
                selectedStudentIds.length === 0 ||
                !selectedVehicle ||
                !selectedRoute ||
                !selectedStop ||
                isSubmitting
              }
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  selectedStudentIds.length > 0 &&
                  selectedVehicle &&
                  selectedRoute &&
                  selectedStop &&
                  !isSubmitting
                    ? ["#e83030", "#c01818"]
                    : ["#333", "#222"]
                }
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Send Request</Text>
                    <Ionicons name="send" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={requests || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRequestItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: T.textMuted }}>
                You haven't sent any requests yet.
              </Text>
            </View>
          }
        />
      )}

      {renderProfileModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "800" },

  segmentRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabel: { fontSize: 14, fontWeight: "600" },
  selectAllText: { fontSize: 13, fontWeight: "500" },

  studentList: { paddingHorizontal: 16, paddingBottom: 12 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#888",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  checkboxLabel: { fontSize: 14, fontWeight: "500" },
  emptyText: { fontSize: 13, fontStyle: "italic", paddingLeft: 16 },

  // ── Search wrapper – uses theme dynamically ──
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 120 },

  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  thumbFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 12, marginTop: 2 },
  profileBtn: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },

  hintText: { fontSize: 12, width: "100%", marginBottom: 4 },

  requestRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: { fontSize: 13, fontWeight: "600" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  submitBtn: { borderRadius: 50, overflow: "hidden" },
  submitGradient: {
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  modalLabel: { fontSize: 14 },
  modalValue: { fontSize: 14, fontWeight: "500" },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  modalRouteCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modalRouteName: { fontSize: 14, fontWeight: "600" },
  modalRouteTime: { fontSize: 12, marginTop: 2 },
  modalRouteStops: { fontSize: 12, marginTop: 2 },
  modalSub: { fontSize: 13, fontStyle: "italic" },
});
