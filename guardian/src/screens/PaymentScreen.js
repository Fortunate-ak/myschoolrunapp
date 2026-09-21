// screens/guardian/PaymentScreen.js
import React from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Plan display config ────────────────────────────────────────────────────
// Mirrored from the `plans` array in GuardianSubscriptionScreen.js so the
// prices shown here match what guardians actually paid. These two screens
// currently duplicate this list — worth extracting to a shared
// constants/plans.js that both screens import, so they can't drift out of
// sync again the way PaymentScreen's old hardcoded "$39.99" already had.
const PLAN_DETAILS = {
  basic: {
    label: "Basic",
    price: "$19.99 / month",
    features: [
      "Track up to 1 child",
      "Real-time location",
      "Arrival notifications",
    ],
  },
  family: {
    label: "Family",
    price: "$39.99 / month",
    features: [
      "Track up to 3 children",
      "Real-time location",
      "Arrival notifications",
      "Trip history",
      "Driver ratings",
    ],
  },
  premium: {
    label: "Premium",
    price: "$69.99 / month",
    features: [
      "Track up to 6 children",
      "Real-time location",
      "Arrival notifications",
      "Trip history",
      "Driver ratings",
      "Priority support",
      "Advanced analytics",
    ],
  },
};

const PAYMENT_METHOD_LABELS = {
  card: "Card",
  ecocash: "EcoCash",
  onemoney: "OneMoney",
  bank_transfer: "Bank Transfer",
  cash_on_pickup: "Cash on Pickup",
};

export default function PaymentScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();

  // Confirmed against App.js and GuardianSubscriptionScreen.js: the real
  // guardian profile (with isSubscribed/subscriptionPlan/etc.) lives in
  // state.users, populated by getGuardianProfile() — NOT state.auth.
  const { guardianProfile } = useSelector((state) => state.users);

  const isSubscribed = !!guardianProfile?.isSubscribed;
  const planKey = guardianProfile?.subscriptionPlan; // "basic" | "family" | "premium" | null
  const plan = planKey ? PLAN_DETAILS[planKey] : null;
  const paymentMethodKey = guardianProfile?.paymentMethod;
  const paymentMethodLabel = paymentMethodKey
    ? PAYMENT_METHOD_LABELS[paymentMethodKey] ?? paymentMethodKey
    : null;

  const handleChangePlan = () => {
    // Confirmed in App.js: <Stack.Screen name="Subscription" component={SubscriptionScreen} .../>
    navigation.navigate("Subscription");
  };

  const handleViewAllTransactions = () => {
    // NOTE: this screen did not exist anywhere in what's been shared so far.
    // Create a "TransactionHistory" screen and register it in the guardian
    // navigator, or update this string to match wherever billing history
    // actually lives.
    navigation.navigate("TransactionHistory");
  };

  const handleAddPaymentMethod = () => {
    // NOTE: same situation as above — "AddPaymentMethod" is not confirmed
    // to exist yet. Create it (likely where your Paynow/EcoCash checkout
    // flow lives) or update this string.
    navigation.navigate("AddPaymentMethod");
  };

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
            {isSubscribed && plan
              ? `Active - ${plan.label} Plan`
              : "No Active Subscription"}
          </Text>
        </View>

        {/* Current Plan */}
        {isSubscribed && plan && (
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
                <Text style={[styles.planName, { color: T.text }]}>
                  {plan.label}
                </Text>
                <Text style={[styles.planPrice, { color: T.accent }]}>
                  {plan.price}
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
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={T.success}
                  />
                  <Text style={[styles.featureText, { color: T.textMuted }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.changeBtn, { borderColor: T.border }]}
              onPress={handleChangePlan}
            >
              <Text style={[styles.changeBtnText, { color: T.accent }]}>
                Change Plan
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isSubscribed && (
          <TouchableOpacity
            style={[
              styles.planCard,
              styles.subscribeCta,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
            onPress={handleChangePlan}
          >
            <Text style={[styles.changeBtnText, { color: T.accent }]}>
              Choose a Plan
            </Text>
          </TouchableOpacity>
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

          {/*
            TODO: this previously showed two hardcoded fake transactions
            regardless of the account. There is no billing-history data
            source wired up yet (no Redux slice / API call has been shared).
            Replace this block with a real list once a getBillingHistory
            endpoint/thunk exists — showing an honest empty state in the
            meantime rather than fabricated transactions.
          */}
          <Text style={[styles.emptyText, { color: T.textMuted }]}>
            {isSubscribed
              ? "Your recent payments will appear here."
              : "No billing history yet."}
          </Text>

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={handleViewAllTransactions}
          >
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

          {paymentMethodLabel ? (
            <View style={styles.paymentMethod}>
              <View style={styles.paymentLeft}>
                <View
                  style={[
                    styles.paymentIcon,
                    { backgroundColor: T.accentDim },
                  ]}
                >
                  <Ionicons name="card" size={20} color={T.accent} />
                </View>
                <View>
                  <Text style={[styles.paymentName, { color: T.text }]}>
                    {paymentMethodLabel}
                  </Text>
                  {guardianProfile?.paymentReference && (
                    <Text
                      style={[styles.paymentExpiry, { color: T.textMuted }]}
                    >
                      Ref: {guardianProfile.paymentReference}
                    </Text>
                  )}
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
          ) : (
            <Text style={[styles.emptyText, { color: T.textMuted }]}>
              No payment method on file.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.addBtn, { borderColor: T.border }]}
            onPress={handleAddPaymentMethod}
          >
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
  subscribeCta: { alignItems: "center", justifyContent: "center" },
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

  emptyText: { fontSize: 13, paddingVertical: 8 },

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
