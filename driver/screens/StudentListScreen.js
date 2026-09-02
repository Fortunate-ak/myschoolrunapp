// screens/StudentListScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { getVehicleRoutesForDriver } from "../lib/VehicleRoutesSlice";
import { getAllRequests } from "../lib/GuardianRequestsSlice";

// ── Student Card ──────────────────────────────────────────────────────────────
function StudentCard({ student, routeName, T }) {
  const guardian = student.guardian || {};

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: T.surface, borderColor: T.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: T.accentDim }]}>
          <Text style={[styles.avatarText, { color: T.accent }]}>
            {student.fullname?.charAt(0) || "S"}
          </Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={[styles.studentName, { color: T.text }]}>
            {student.fullname || "Student"}
          </Text>
          <Text style={[styles.routeLabel, { color: T.textMuted }]}>
            <Ionicons name="bus-outline" size={12} color={T.textMuted} />{" "}
            {routeName}
          </Text>
        </View>
      </View>

      {/* Guardian details */}
      <View style={[styles.guardianSection, { borderTopColor: T.border }]}>
        <Text style={[styles.guardianLabel, { color: T.textMuted }]}>
          Guardian
        </Text>
        <View style={styles.guardianRow}>
          <Ionicons name="person-outline" size={14} color={T.textMuted} />
          <Text style={[styles.guardianText, { color: T.text }]}>
            {guardian.fullname || guardian.name || "Not assigned"}
          </Text>
        </View>
        {guardian.phone && (
          <View style={styles.guardianRow}>
            <Ionicons name="call-outline" size={14} color={T.textMuted} />
            <Text style={[styles.guardianText, { color: T.text }]}>
              {guardian.phone}
            </Text>
          </View>
        )}
        {guardian.email && (
          <View style={styles.guardianRow}>
            <Ionicons name="mail-outline" size={14} color={T.textMuted} />
            <Text style={[styles.guardianText, { color: T.text }]}>
              {guardian.email}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function StudentListScreen() {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const { driverRoutes, isLoading: routesLoading } = useSelector(
    (s) => s.vehicleroutes,
  );
  const [sections, setSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      await dispatch(getVehicleRoutesForDriver()).unwrap();
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Build sections from driverRoutes
  useEffect(() => {
    const sectionsData = driverRoutes
      .filter((route) => route.stops && route.stops.length > 0)
      .map((route) => {
        const students = [];
        route.stops.forEach((stop) => {
          if (stop.students && stop.students.length > 0) {
            stop.students.forEach((s) => {
              students.push({
                ...s,
                stopName: stop.stopName,
              });
            });
          }
        });
        return {
          title: route.routeName,
          data: students,
        };
      })
      .filter((section) => section.data.length > 0);

    setSections(sectionsData);
  }, [driverRoutes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderSectionHeader = ({ section }) => (
    <View
      style={[
        styles.sectionHeader,
        { backgroundColor: T.surface, borderBottomColor: T.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: T.text }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: T.textMuted }]}>
        {section.data.length} students
      </Text>
    </View>
  );

  const renderItem = ({ item, section }) => (
    <StudentCard student={item} routeName={section.title} T={T} />
  );

  if (routesLoading && sections.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: T.bg }]}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header with back button */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>My Students</Text>
        <View style={{ width: 24 }} />
      </View>

      {sections.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: T.accentDim }]}>
            <Ionicons name="school-outline" size={40} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No Students Assigned
          </Text>
          <Text style={[styles.emptySub, { color: T.textMuted }]}>
            Students will appear here once they are assigned to your routes.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id || `student-${index}`}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.accent}
            />
          }
          stickySectionHeadersEnabled
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionCount: { fontSize: 13 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: "600" },
  routeLabel: { fontSize: 13, marginTop: 2 },
  guardianSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  guardianLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  guardianRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  guardianText: { fontSize: 14 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
