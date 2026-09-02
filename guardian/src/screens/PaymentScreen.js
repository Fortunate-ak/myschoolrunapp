// screens/guardian/PaymentScreen.js
import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();

  const [isSubscribed, setIsSubscribed] = useState(true);
  const [plan, setPlan] = useState("Family");

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
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
            style={[styles.backBtn, { backgroundColor: T.surface }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: T.text }]}>Payment</Text>

          <View style={{ width: 36 }} />
        </View>

        {/* Subscription Status */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isSubscribed ? T.successDim : T.accentDim,
              borderColor: isSubscribed ? T.success + "44" : T.accentBorder,
            },
          ]}
        >
          <Ionicons
            name={isSubscribed ? "checkmark-circle" : "alert-circle"}
            size={24}
            color={isSubscribed ? T.success : T.accent}
          />
          <Text
            style={[
              styles.statusText,
              { color: isSubscribed ? T.success : T.accent },
            ]}
          >
            {isSubscribed ? `Active - ${plan} Plan` : "No Active Subscription"}
          </Text>
        </View>

        {/* Current Plan */}
        {isSubscribed && (
          <View
            style={[
              styles.planCard,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
          >
            <Text style={[styles.planTitle, { color: T.text }]}>
              Current Plan
            </Text>

            <View style={styles.planRow}>
              <View>
                <Text style={[styles.planName, { color: T.text }]}>{plan}</Text>
                <Text style={[styles.planPrice, { color: T.accent }]}>
                  $39.99 / month
                </Text>
              </View>
              <View
                style={[styles.planBadge, { backgroundColor: T.successDim }]}
              >
                <Text style={[styles.planBadgeText, { color: T.success }]}>
                  Active
                </Text>
              </View>
            </View>

            <View style={styles.planFeatures}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={T.success} />
                <Text style={[styles.featureText, { color: T.textMuted }]}>
                  Track up to 3 children
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={T.success} />
                <Text style={[styles.featureText, { color: T.textMuted }]}>
                  Real-time location tracking
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={T.success} />
                <Text style={[styles.featureText, { color: T.textMuted }]}>
                  Arrival notifications
                </Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={T.success} />
                <Text style={[styles.featureText, { color: T.textMuted }]}>
                  Trip history & driver ratings
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.changeBtn, { borderColor: T.border }]}
              onPress={() => navigation.navigate("GuardianSubscription")}
            >
              <Text style={[styles.changeBtnText, { color: T.accent }]}>
                Change Plan
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Billing History */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Billing History
          </Text>

          <View style={styles.billingItem}>
            <View>
              <Text style={[styles.billingDate, { color: T.text }]}>
                Jan 15, 2024
              </Text>
              <Text style={[styles.billingDesc, { color: T.textMuted }]}>
                Family Plan - Monthly
              </Text>
            </View>
            <Text style={[styles.billingAmount, { color: T.text }]}>
              $39.99
            </Text>
          </View>

          <View style={styles.billingItem}>
            <View>
              <Text style={[styles.billingDate, { color: T.text }]}>
                Dec 15, 2023
              </Text>
              <Text style={[styles.billingDesc, { color: T.textMuted }]}>
                Family Plan - Monthly
              </Text>
            </View>
            <Text style={[styles.billingAmount, { color: T.text }]}>
              $39.99
            </Text>
          </View>

          <TouchableOpacity style={styles.viewAllBtn}>
            <Text style={[styles.viewAllText, { color: T.accent }]}>
              View All Transactions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Payment Methods
          </Text>

          <View style={styles.paymentMethod}>
            <View style={styles.paymentLeft}>
              <View
                style={[styles.paymentIcon, { backgroundColor: T.accentDim }]}
              >
                <Ionicons name="card" size={20} color={T.accent} />
              </View>
              <View>
                <Text style={[styles.paymentName, { color: T.text }]}>
                  •••• 4242
                </Text>
                <Text style={[styles.paymentExpiry, { color: T.textMuted }]}>
                  Expires 12/26
                </Text>
              </View>
            </View>
            <View
              style={[styles.defaultBadge, { backgroundColor: T.successDim }]}
            >
              <Text style={[styles.defaultText, { color: T.success }]}>
                Default
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.addBtn, { borderColor: T.border }]}>
            <Ionicons name="add" size={20} color={T.accent} />
            <Text style={[styles.addBtnText, { color: T.accent }]}>
              Add Payment Method
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
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

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusText: { fontSize: 14, fontWeight: "600", flex: 1 },

  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  planTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: { fontSize: 16, fontWeight: "700" },
  planPrice: { fontSize: 14, fontWeight: "600" },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: { fontSize: 11, fontWeight: "600" },
  planFeatures: { marginTop: 12, gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13 },
  changeBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeBtnText: { fontSize: 13, fontWeight: "600" },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },

  billingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  billingDate: { fontSize: 14, fontWeight: "600" },
  billingDesc: { fontSize: 12 },
  billingAmount: { fontSize: 14, fontWeight: "600" },

  viewAllBtn: { alignItems: "center", paddingVertical: 10, marginTop: 4 },
  viewAllText: { fontSize: 13, fontWeight: "600" },

  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  paymentLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentName: { fontSize: 14, fontWeight: "600" },
  paymentExpiry: { fontSize: 12 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  defaultText: { fontSize: 10, fontWeight: "600" },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
});
