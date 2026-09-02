// screens/driver/RequestsScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { DrawerActions } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import {
  getAllRequests,
  approveRequest,
  rejectRequest,
} from "../lib/GuardianRequestsSlice";
import Toast from "react-native-toast-message";

// ── Collapsible Request Card ──────────────────────────────────────────────────

function RequestCard({ item, onAccept, onReject, accepting, T }) {
  const isPending = item.status === "pending";
  const students = item.students || [];
  const isOnboard = item.requestType === "student_onboard_request";
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    pending: { color: T.warning, bg: T.warningDim, label: "Pending" },
    approved: { color: T.success, bg: T.successDim, label: "Approved" },
    rejected: { color: T.textMuted, bg: T.border, label: "Rejected" },
    cancelled: { color: T.textMuted, bg: T.border, label: "Cancelled" },
  };
  const s = statusColors[item.status] || statusColors.pending;

  const toggleExpanded = () => setExpanded(!expanded);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: T.surface,
          borderColor: isPending ? T.accentBorder : T.border,
        },
      ]}
    >
      {/* Guardian Header */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: T.accentDim, borderColor: T.accentBorder },
          ]}
        >
          <Ionicons name="person" size={20} color={T.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.guardianName, { color: T.text }]}>
            {item.guardian?.user?.fullname || "Guardian"}
          </Text>
          <Text style={[styles.guardianPhone, { color: T.textMuted }]}>
            {item.guardian?.user?.phone || "No phone provided"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          <Ionicons
            name={isOnboard ? "school-outline" : "map-outline"}
            size={16}
            color={T.textMuted}
          />
          <Text style={[styles.summaryType, { color: T.text }]}>
            {isOnboard ? "Onboard" : "Route Stop"}
          </Text>
          <Text style={[styles.summaryCount, { color: T.textMuted }]}>
            {students.length} student{students.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {!isOnboard && item.route && (
          <View style={styles.summaryRoute}>
            <Ionicons name="bus-outline" size={14} color={T.textMuted} />
            <Text style={[styles.summaryRouteText, { color: T.text }]}>
              {item.route.routeName || "Unnamed Route"}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={toggleExpanded} style={styles.expandBtn}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={T.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Expanded Details – only visible when `expanded` is true */}
      {expanded && (
        <View style={[styles.detailsContainer, { borderTopColor: T.border }]}>
          {students.map((s, idx) => (
            <View
              key={idx}
              style={[
                styles.studentItem,
                { borderBottomColor: T.border },
                idx === students.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[styles.studentName, { color: T.text }]}>
                {s.fullname || "Student"}
              </Text>
              <View style={styles.addressRow}>
                <Ionicons name="home-outline" size={14} color={T.textMuted} />
                <Text style={[styles.addressText, { color: T.textMuted }]}>
                  {s.homeAddress?.address || "No home address"}
                </Text>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="school-outline" size={14} color={T.textMuted} />
                <Text style={[styles.addressText, { color: T.textMuted }]}>
                  {s.schoolAddress?.address || "No school address"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions – only for pending requests */}
      {isPending && (
        <View style={[styles.actionRow, { borderTopColor: T.border }]}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: T.border }]}
            onPress={() => onReject(item.id)}
            activeOpacity={0.8}
            disabled={accepting === item.id}
          >
            <Ionicons name="close" size={16} color={T.textMuted} />
            <Text style={[styles.rejectText, { color: T.textMuted }]}>
              Decline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => onAccept(item.id)}
            disabled={accepting === item.id}
            activeOpacity={0.85}
          >
            {accepting === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function RequestsScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();

  const [filter, setFilter] = useState("pending");
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(null);

  const { requests, isLoading } = useSelector(
    (state) => state.guardianRequests,
  );

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      await dispatch(getAllRequests()).unwrap();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: error || "Failed to load requests",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async (id) => {
    setAccepting(id);
    try {
      await dispatch(approveRequest(id)).unwrap();
      Toast.show({
        type: "success",
        text1: "Request approved successfully",
      });
      await loadRequests();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: error || "Failed to accept request",
      });
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (id) => {
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setAccepting(id);
            try {
              await dispatch(rejectRequest(id)).unwrap();
              Toast.show({
                type: "success",
                text1: "Request declined",
              });
              await loadRequests();
            } catch (error) {
              Toast.show({
                type: "error",
                text1: error || "Failed to reject request",
              });
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
    );
  };

  // Count statuses
  const statusCounts =
    requests && Array.isArray(requests)
      ? requests.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {})
      : {};

  const pendingCount = statusCounts.pending || 0;
  const approvedCount = statusCounts.approved || 0;
  const rejectedCount = statusCounts.rejected || 0;
  const cancelledCount = statusCounts.cancelled || 0;

  const displayed =
    requests && Array.isArray(requests)
      ? filter === "all"
        ? requests
        : requests.filter((r) => r.status === filter)
      : [];

  const filterTabs = [
    { key: "all", label: "All", count: requests?.length || 0 },
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
    { key: "cancelled", label: "Cancelled", count: cancelledCount },
  ];

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={[styles.menuBtn, { backgroundColor: T.surface }]}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={22} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Guardian Requests
          </Text>
          {pendingCount > 0 && (
            <Text style={[styles.headerSub, { color: T.accent }]}>
              {pendingCount} pending
            </Text>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View
        style={[
          styles.filterRow,
          { backgroundColor: T.surface, borderBottomColor: T.border },
        ]}
      >
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && {
                borderBottomColor: T.accent,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filter === tab.key ? T.accent : T.textMuted },
              ]}
            >
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.accent} size="large" />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: T.accentDim }]}>
            <Ionicons name="people-outline" size={36} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            {filter === "pending" ? "No pending requests" : "No requests yet"}
          </Text>
          <Text style={[styles.emptyBody, { color: T.textMuted }]}>
            {filter === "pending"
              ? "When guardians request seats on your routes, they'll appear here."
              : "You haven't received any guardian requests."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadRequests();
              }}
              tintColor={T.accent}
            />
          }
          renderItem={({ item }) => (
            <RequestCard
              item={item}
              onAccept={handleAccept}
              onReject={handleReject}
              accepting={accepting}
              T={T}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },

  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabText: { fontSize: 13, fontWeight: "700" },

  list: { padding: 16, gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },

  // ── Card styles ──
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  guardianName: { fontSize: 15, fontWeight: "700" },
  guardianPhone: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Summary row
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryType: { fontSize: 13, fontWeight: "500" },
  summaryCount: { fontSize: 13 },
  summaryRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryRouteText: { fontSize: 12, fontWeight: "500" },
  expandBtn: { padding: 4 },

  // Expanded details
  detailsContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  studentItem: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  studentName: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  addressText: { fontSize: 12, flex: 1 },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 50,
    borderWidth: 1,
  },
  rejectText: { fontSize: 13, fontWeight: "600" },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 50,
    backgroundColor: "#e83030",
  },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Empty state
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
