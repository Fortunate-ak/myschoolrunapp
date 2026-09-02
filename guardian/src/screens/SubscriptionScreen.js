// screens/guardian/GuardianSubscriptionScreen.js
import { subscribeGuardian } from "../lib/UserSlice";
import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";

export default function SubscriptionScreen({ navigation }) {
  const dispatch = useDispatch();
  const { guardianProfile } = useSelector((state) => state.users);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const route = useRoute();
  // "trial_expired" is passed when a gated action (e.g. sending a pickup
  // request) redirects here because the trial/subscription has lapsed.
  // Undefined means the guardian opened this screen voluntarily and can
  // dismiss it.
  const reason = route.params?.reason;
  const canDismiss = reason !== "trial_expired" && navigation.canGoBack();

  const plans = [
    {
      id: "basic",
      name: "Basic",
      price: 19.99,
      period: "month",
      features: [
        "Track up to 1 child",
        "Real-time location",
        "Arrival notifications",
      ],
      popular: false,
    },
    {
      id: "family",
      name: "Family",
      price: 39.99,
      period: "month",
      features: [
        "Track up to 3 children",
        "Real-time location",
        "Arrival notifications",
        "Trip history",
        "Driver ratings",
      ],
      popular: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: 69.99,
      period: "month",
      features: [
        "Track up to 6 children",
        "Real-time location",
        "Arrival notifications",
        "Trip history",
        "Driver ratings",
        "Priority support",
        "Advanced analytics",
      ],
      popular: false,
    },
  ];

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      Toast.show({
        type: "error",
        text1: "Select a Plan",
        text2: "Please choose a subscription plan",
      });
      return;
    }

    setIsLoading(true);

    try {
      await dispatch(subscribeGuardian(selectedPlan)).unwrap();

      Toast.show({
        type: "success",
        text1: "Subscription Active!",
        text2: "Welcome aboard! Your child's journey is now being tracked.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Subscription Failed",
        text2: typeof error === "string" ? error : "Please try again later",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPlan = (plan) => {
    const isSelected = selectedPlan === plan.id;

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          plan.popular && styles.planCardPopular,
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        activeOpacity={0.8}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}

        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planPrice}>
          ${plan.price}
          <Text style={styles.planPeriod}> /{plan.period}</Text>
        </Text>

        <View style={styles.featuresList}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {isSelected && (
          <View style={styles.selectedCheck}>
            <Ionicons name="checkmark-circle" size={24} color="#e83030" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {canDismiss && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {reason === "trial_expired" ? "Your Trial Has Ended" : "Choose Your Plan"}
          </Text>
          {guardianProfile?.trialActive ? (
            <Text style={styles.headerSub}>
              {guardianProfile?.trialDaysLeft} day
              {guardianProfile?.trialDaysLeft === 1 ? "" : "s"} left in your free trial
            </Text>
          ) : (
            <Text style={styles.headerSub}>Step 3 of 3</Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#e83030" />
          <Text style={styles.infoText}>
            {reason === "trial_expired"
              ? "Subscribe to keep booking pickups and tracking your driver."
              : guardianProfile?.trialActive
              ? "You can keep browsing for free — subscribe anytime, no rush."
              : "Subscribe to start tracking your child's school transport in real-time"}
          </Text>
        </View>

        {plans.map(renderPlan)}

        <TouchableOpacity
          style={[
            styles.subscribeBtn,
            (!selectedPlan || isLoading) && styles.disabledBtn,
          ]}
          onPress={handleSubscribe}
          disabled={!selectedPlan || isLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={
              selectedPlan && !isLoading
                ? ["#e83030", "#c01818"]
                : ["#333", "#222"]
            }
            style={styles.subscribeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.subscribeText}>Subscribe Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.secureNote}>
          <Ionicons
            name="lock-closed"
            size={12}
            color="rgba(255,255,255,0.3)"
          />{" "}
          Secure payment. Cancel anytime.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  closeButton: {
    position: "absolute",
    left: 20,
    top: 58,
    zIndex: 1,
    padding: 4,
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(232,48,48,0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(232,48,48,0.15)",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },

  planCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 12,
    position: "relative",
  },
  planCardSelected: { borderColor: "#e83030", backgroundColor: "#1f0808" },
  planCardPopular: { borderColor: "rgba(232,48,48,0.3)" },

  popularBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: "#e83030",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },

  planName: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  planPrice: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e83030",
    marginTop: 4,
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.3)",
  },

  featuresList: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13, color: "rgba(255,255,255,0.6)" },

  selectedCheck: { position: "absolute", top: 16, right: 16 },

  subscribeBtn: { borderRadius: 50, overflow: "hidden", marginTop: 12 },
  disabledBtn: { opacity: 0.6 },
  subscribeGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  subscribeText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },

  secureNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    marginTop: 16,
  },
});