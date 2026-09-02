/**
 * screens/SelectChildForEmergencyScreen.js
 *
 * Child selection for emergency ride
 * - Display all children linked to the guardian
 * - Allow selection of one child for the emergency ride
 * - Validate that at least one child exists
 * - Navigate to emergency ride request form
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useSelector, useDispatch } from "react-redux";
import { getGuardianStudents } from "../lib/UserSlice";
import Toast from "react-native-toast-message";
import { getInitials } from "../utils/helpers";

export default function SelectChildForEmergencyScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { students, isLoading } = useSelector((state) => state.users);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refresh student list on mount
  useEffect(() => {
    dispatch(getGuardianStudents());
  }, [dispatch]);

  // Auto-select first student if only one exists
  useEffect(() => {
    if (students && students.length === 1 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const handleContinue = async () => {
    if (!selectedStudentId) {
      Toast.show({
        type: "error",
        text1: "Select a Child",
        text2: "Please select which child needs the emergency ride",
      });
      return;
    }

    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    if (!selectedStudent) {
      Toast.show({
        type: "error",
        text1: "Invalid Selection",
        text2: "The selected child could not be found",
      });
      return;
    }

    setIsSubmitting(true);
    // Brief delay for visual feedback
    setTimeout(() => {
      navigation.navigate("EmergencyRideForm", {
        studentId: selectedStudentId,
        student: selectedStudent,
      });
      setIsSubmitting(false);
    }, 300);
  };

  if (isLoading && !students) {
    return (
      <View style={[styles.center, { backgroundColor: T.bg }]}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  // No students case
  if (!students || students.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: T.surface,
              borderBottomColor: T.border,
              paddingTop: insets.top,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Select Child
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: T.accentDim },
            ]}
          >
            <Ionicons name="people-outline" size={48} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No Children Linked
          </Text>
          <Text
            style={[
              styles.emptyDesc,
              { color: T.textMuted, marginBottom: 24 },
            ]}
          >
            You need to add at least one child before requesting an emergency
            ride.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("StudentsStack")}
            style={{
              width: "100%",
            }}
          >
            <LinearGradient
              colors={["#ff6b6b", "#e83030"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyButton}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Add a Child</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: T.surface,
            borderBottomColor: T.border,
            paddingTop: insets.top,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Select Child
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Content ───────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <Text style={[styles.subtitle, { color: T.textSecondary }]}>
          Which child needs an emergency ride?
        </Text>

        {/* ─── Student List ──────────────────────────────────────────────── */}
        <View style={styles.studentsList}>
          {students.map((student, index) => (
            <TouchableOpacity
              key={student.id}
              onPress={() => setSelectedStudentId(student.id)}
              activeOpacity={0.7}
              style={{ marginBottom: index < students.length - 1 ? 12 : 0 }}
            >
              <View
                style={[
                  styles.studentCard,
                  {
                    backgroundColor:
                      selectedStudentId === student.id
                        ? T.accentDim
                        : T.surface,
                    borderColor:
                      selectedStudentId === student.id
                        ? T.accent
                        : T.border,
                    borderWidth: 2,
                  },
                ]}
              >
                {/* Left: Avatar + Info */}
                <View style={styles.studentCardLeft}>
                  {student.profileImage ? (
                    <Image
                      source={{ uri: student.profileImage }}
                      style={styles.studentAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.studentAvatarFallback,
                        { backgroundColor: T.accent },
                      ]}
                    >
                      <Text style={styles.avatarInitials}>
                        {getInitials(student.firstName + " " + student.lastName)}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.studentName,
                        { color: T.text },
                      ]}
                      numberOfLines={1}
                    >
                      {student.firstName} {student.lastName}
                    </Text>
                    {student.rollNo && (
                      <Text
                        style={[
                          styles.studentRoll,
                          { color: T.textMuted },
                        ]}
                      >
                        Roll: {student.rollNo}
                      </Text>
                    )}
                    {student.vehicleRoute?.vehicleName && (
                      <Text
                        style={[
                          styles.studentRoute,
                          { color: T.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {student.vehicleRoute.vehicleName}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Right: Selection indicator */}
                <View style={styles.studentCardRight}>
                  <View
                    style={[
                      styles.selectionCircle,
                      {
                        borderColor: T.accent,
                        backgroundColor:
                          selectedStudentId === student.id
                            ? T.accent
                            : "transparent",
                      },
                    ]}
                  >
                    {selectedStudentId === student.id && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#fff"
                      />
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Child Info Card ───────────────────────────────────────────── */}
        {selectedStudentId && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: T.infoDim,
                borderColor: T.info,
              },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={T.info}
              style={{ marginRight: 12 }}
            />
            <Text style={[styles.infoText, { color: T.text }]}>
              Emergency ride will be charged per-use. Your child will be notified
              once a driver is assigned.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ─── Footer Button ──────────────────────────────────────────────── */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 20,
            borderTopColor: T.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!selectedStudentId || isSubmitting}
          style={{
            opacity: !selectedStudentId || isSubmitting ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["#ff6b6b", "#e83030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  studentsList: {
    marginBottom: 24,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  studentCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  studentAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  studentRoll: {
    fontSize: 12,
  },
  studentRoute: {
    fontSize: 12,
  },
  studentCardRight: {
    marginLeft: 12,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
