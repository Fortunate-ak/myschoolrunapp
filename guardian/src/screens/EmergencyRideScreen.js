/**
 * screens/EmergencyRideScreen.js
 *
 * Guardian Emergency Ride entry point
 * - Displays Emergency Ride feature overview
 * - Shows PRO badge (feature is PRO-only)
 * - Checks subscription status
 * - Routes to SubscriptionScreen if not PRO
 * - Launches child selection if PRO
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useSelector } from "react-redux";

export default function EmergencyRideScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { guardianProfile, isLoading } = useSelector((state) => state.users);

  const [isPreparing, setIsPreparing] = useState(false);

  // Check if guardian has active PRO subscription
  const isProSubscriber = guardianProfile?.isSubscribed === true;

  const handleStartEmergencyRide = () => {
    if (!isProSubscriber) {
      // Redirect to subscription screen
      navigation.navigate("SubscriptionScreen", {
        reason: "emergency_ride_feature",
      });
      return;
    }

    setIsPreparing(true);
    // Navigate to child selection screen
    setTimeout(() => {
      navigation.navigate("SelectChildForEmergency");
      setIsPreparing(false);
    }, 300);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: T.bg }]}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: T.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      {/* ─── Header with back button ─────────────────────────────────────── */}
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
          Emergency Ride
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <View style={styles.content}>
        {/* ─── PRO Badge ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#ff6b6b", "#e83030"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.proBadge, { marginBottom: 24 }]}
        >
          <Ionicons name="star" size={16} color="#fff" />
          <Text style={styles.proBadgeText}>PRO FEATURE</Text>
          <Ionicons name="star" size={16} color="#fff" />
        </LinearGradient>

        {/* ─── Feature Title ─────────────────────────────────────────────── */}
        <Text style={[styles.title, { color: T.text }]}>
          Find an Alternative Driver
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: T.textSecondary, marginBottom: 32 },
          ]}
        >
          Need a backup transportation option for your child? Request an
          alternative driver in minutes.
        </Text>

        {/* ─── Features List ─────────────────────────────────────────────── */}
        <View style={styles.featuresList}>
          {/* Feature 1 */}
          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: T.accentDim },
              ]}
            >
              <Ionicons name="car" size={24} color={T.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureName, { color: T.text }]}>
                Verified Drivers
              </Text>
              <Text style={[styles.featureDesc, { color: T.textMuted }]}>
                Professionally verified and rated
              </Text>
            </View>
          </View>

          {/* Feature 2 */}
          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: T.accentDim },
              ]}
            >
              <Ionicons name="location" size={24} color={T.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureName, { color: T.text }]}>
                Real-Time Tracking
              </Text>
              <Text style={[styles.featureDesc, { color: T.textMuted }]}>
                Live GPS location during the ride
              </Text>
            </View>
          </View>

          {/* Feature 3 */}
          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: T.accentDim },
              ]}
            >
              <Ionicons name="stopwatch" size={24} color={T.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureName, { color: T.text }]}>
                Quick Booking
              </Text>
              <Text style={[styles.featureDesc, { color: T.textMuted }]}>
                Find a driver in minutes
              </Text>
            </View>
          </View>

          {/* Feature 4 */}
          <View style={styles.featureItem}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: T.accentDim },
              ]}
            >
              <Ionicons name="star" size={24} color={T.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureName, { color: T.text }]}>
                Driver Ratings
              </Text>
              <Text style={[styles.featureDesc, { color: T.textMuted }]}>
                Rate your driver experience
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Subscription Status ───────────────────────────────────────── */}
        {!isProSubscriber && (
          <View
            style={[
              styles.subscriptionStatus,
              {
                backgroundColor: T.warningDim,
                borderColor: T.warning,
              },
            ]}
          >
            <Ionicons
              name="lock-closed"
              size={20}
              color={T.warning}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: T.text }]}>
                PRO Subscription Required
              </Text>
              <Text style={[styles.statusDesc, { color: T.textMuted }]}>
                Upgrade your plan to access emergency rides
              </Text>
            </View>
          </View>
        )}

        {/* ─── Active Status ─────────────────────────────────────────────── */}
        {isProSubscriber && (
          <View
            style={[
              styles.subscriptionStatus,
              {
                backgroundColor: T.successDim,
                borderColor: T.success,
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={T.success}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: T.text }]}>
                PRO Active
              </Text>
              <Text style={[styles.statusDesc, { color: T.textMuted }]}>
                You can now request emergency rides
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── Action Button ────────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleStartEmergencyRide}
          disabled={isPreparing}
          style={{
            opacity: isPreparing ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["#ff6b6b", "#e83030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionButton}
          >
            {isPreparing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="car" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {isProSubscriber
                    ? "Request Emergency Ride"
                    : "Upgrade to PRO"}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {isProSubscriber && (
          <Text
            style={[
              styles.footerNote,
              { color: T.textMuted, marginTop: 12 },
            ]}
          >
            Emergency rides are charged at a per-use rate
          </Text>
        )}
      </View>
    </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: "flex-start",
    gap: 8,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    justifyContent: "center",
  },
  featureName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  subscriptionStatus: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  footerNote: {
    fontSize: 13,
    textAlign: "center",
  },
});
