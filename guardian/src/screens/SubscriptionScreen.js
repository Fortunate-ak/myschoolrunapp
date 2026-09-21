// screens/SubscriptionScreen.js
import { subscribeGuardian } from "../lib/UserSlice";
import { processPayment, PAYMENT_METHODS } from "../services/paymentService";
import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";

export default function SubscriptionScreen({ navigation }) {
  const dispatch = useDispatch();
  const { theme: T } = useTheme();
  const { guardianProfile } = useSelector((state) => state.users);

  // step: "plan" -> "payment"
  const [step, setStep] = useState("plan");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dummy payment detail inputs — only the fields relevant to the selected
  // method are ever read by paymentService.processPayment().
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [bankReference, setBankReference] = useState("");

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

  const handleContinueToPayment = () => {
    if (!selectedPlan) {
      Toast.show({
        type: "error",
        text1: "Select a Plan",
        text2: "Please choose a subscription plan",
      });
      return;
    }
    setStep("payment");
  };

  const handlePay = async () => {
    if (!selectedMethod) {
      Toast.show({
        type: "error",
        text1: "Select a Payment Method",
        text2: "Choose how you'd like to pay",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Run the (dummy) payment for whichever method was chosen.
      const details =
        selectedMethod === "card"
          ? { cardNumber, expiry: cardExpiry, cvv: cardCvv, cardholderName }
          : selectedMethod === "ecocash" || selectedMethod === "onemoney"
            ? { phoneNumber: mobileNumber }
            : selectedMethod === "bank_transfer"
              ? { reference: bankReference }
              : {}; // cash_on_pickup needs nothing

      const paymentResult = await processPayment(selectedMethod, details);

      // 2. Persist the subscription server-side, including the payment
      // method/reference the mock payment produced.
      await dispatch(
        subscribeGuardian({
          plan: selectedPlan,
          paymentMethod: paymentResult.paymentMethod,
          paymentReference: paymentResult.paymentReference,
        }),
      ).unwrap();

      Toast.show({
        type: "success",
        text1: "Subscription Active!",
        text2: "Welcome aboard! Your child's journey is now being tracked.",
      });

      // Was opened on demand (via useRequireSubscription) from wherever the
      // guardian tried to do something gated. Closing it here returns them
      // to that screen so they can immediately continue.
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Payment Failed",
        text2: typeof error === "string" ? error : error?.message || "Please try again",
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
          {
            backgroundColor: isSelected ? T.accentDim : T.surface,
            borderColor: isSelected
              ? T.accent
              : plan.popular
                ? T.accentBorder
                : T.border,
          },
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        activeOpacity={0.8}
      >
        {plan.popular && (
          <View style={[styles.popularBadge, { backgroundColor: T.accent }]}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}

        <Text style={[styles.planName, { color: T.text }]}>{plan.name}</Text>
        <Text style={[styles.planPrice, { color: T.accent }]}>
          ${plan.price}
          <Text style={[styles.planPeriod, { color: T.textMuted }]}>
            {" "}
            /{plan.period}
          </Text>
        </Text>

        <View style={styles.featuresList}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={T.success} />
              <Text style={[styles.featureText, { color: T.textSecondary }]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {isSelected && (
          <View style={styles.selectedCheck}>
            <Ionicons name="checkmark-circle" size={24} color={T.accent} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPaymentMethod = (method) => {
    const isSelected = selectedMethod === method.id;
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.methodRow,
          {
            backgroundColor: isSelected ? T.accentDim : T.surface,
            borderColor: isSelected ? T.accent : T.border,
          },
        ]}
        onPress={() => setSelectedMethod(method.id)}
        activeOpacity={0.8}
      >
        <View
          style={[styles.methodIconWrap, { backgroundColor: T.bgSecondary }]}
        >
          <Ionicons
            name={method.icon}
            size={20}
            color={isSelected ? T.accent : T.textMuted}
          />
        </View>
        <Text
          style={[
            styles.methodLabel,
            { color: isSelected ? T.text : T.textSecondary },
          ]}
        >
          {method.label}
        </Text>
        <View
          style={[
            styles.radioOuter,
            { borderColor: isSelected ? T.accent : T.border },
          ]}
        >
          {isSelected && (
            <View style={[styles.radioInner, { backgroundColor: T.accent }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMethodDetails = () => {
    const inputStyle = [
      styles.input,
      {
        backgroundColor: T.inputBg,
        borderColor: T.inputBorder,
        color: T.text,
      },
    ];
    const labelStyle = [styles.detailsLabel, { color: T.textMuted }];
    const noteStyle = [styles.mockNote, { color: T.textMuted }];
    const blockStyle = [
      styles.detailsBlock,
      { backgroundColor: T.bgSecondary, borderColor: T.border },
    ];

    if (selectedMethod === "card") {
      return (
        <View style={blockStyle}>
          <Text style={labelStyle}>Name on card</Text>
          <TextInput
            style={inputStyle}
            placeholder="Jane Moyo"
            placeholderTextColor={T.placeholder}
            value={cardholderName}
            onChangeText={setCardholderName}
          />
          <Text style={labelStyle}>Card number</Text>
          <TextInput
            style={inputStyle}
            placeholder="4242 4242 4242 4242"
            placeholderTextColor={T.placeholder}
            keyboardType="number-pad"
            value={cardNumber}
            onChangeText={setCardNumber}
            maxLength={19}
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={labelStyle}>Expiry (MM/YY)</Text>
              <TextInput
                style={inputStyle}
                placeholder="08/28"
                placeholderTextColor={T.placeholder}
                value={cardExpiry}
                onChangeText={setCardExpiry}
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>CVV</Text>
              <TextInput
                style={inputStyle}
                placeholder="123"
                placeholderTextColor={T.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                value={cardCvv}
                onChangeText={setCardCvv}
                maxLength={4}
              />
            </View>
          </View>
          <Text style={noteStyle}>Dummy checkout — no real card is charged.</Text>
        </View>
      );
    }

    if (selectedMethod === "ecocash" || selectedMethod === "onemoney") {
      return (
        <View style={blockStyle}>
          <Text style={labelStyle}>
            {selectedMethod === "ecocash" ? "EcoCash" : "OneMoney"} number
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="077 123 4567"
            placeholderTextColor={T.placeholder}
            keyboardType="phone-pad"
            value={mobileNumber}
            onChangeText={setMobileNumber}
          />
          <Text style={noteStyle}>
            Dummy prompt — simulates a USSD push and PIN confirmation.
          </Text>
        </View>
      );
    }

    if (selectedMethod === "bank_transfer") {
      return (
        <View style={blockStyle}>
          <View
            style={[
              styles.bankDetailsCard,
              { backgroundColor: T.inputBg },
            ]}
          >
            <Text style={[styles.bankDetailsTitle, { color: T.textMuted }]}>
              Transfer to
            </Text>
            <Text style={[styles.bankDetailsLine, { color: T.text }]}>
              SchoolRun (Pvt) Ltd — Mock Bank
            </Text>
            <Text style={[styles.bankDetailsLine, { color: T.text }]}>
              Account: 0000 0000 0000
            </Text>
            <Text style={[styles.bankDetailsLine, { color: T.text }]}>
              Branch: Sample Branch
            </Text>
          </View>
          <Text style={labelStyle}>Transfer reference / receipt number</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. FT2608271234"
            placeholderTextColor={T.placeholder}
            value={bankReference}
            onChangeText={setBankReference}
          />
          <Text style={noteStyle}>
            Dummy flow — a real integration would hold this as "pending" until reconciled.
          </Text>
        </View>
      );
    }

    if (selectedMethod === "cash_on_pickup") {
      return (
        <View style={blockStyle}>
          <Text style={noteStyle}>
            Pay the driver in cash at the first pickup. Your subscription activates now
            so tracking can start immediately.
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: T.surface }]}
          onPress={() => (step === "payment" ? setStep("plan") : navigation.goBack())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={step === "payment" ? "chevron-back" : "close"}
            size={24}
            color={T.text}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            {step === "plan" ? "Choose Your Plan" : "Payment"}
          </Text>
          <Text style={[styles.headerSub, { color: T.textMuted }]}>
            {step === "plan" ? "Unlock live tracking & requests" : "Step 2 of 2"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === "plan" ? (
          <>
            <View
              style={[
                styles.infoBanner,
                { backgroundColor: T.accentDim, borderColor: T.accentBorder },
              ]}
            >
              <Ionicons name="information-circle" size={20} color={T.accent} />
              <Text style={[styles.infoText, { color: T.textSecondary }]}>
                Subscribe to start tracking your child's school transport in
                real-time
              </Text>
            </View>

            {plans.map(renderPlan)}

            <TouchableOpacity
              style={[styles.subscribeBtn, !selectedPlan && styles.disabledBtn]}
              onPress={handleContinueToPayment}
              disabled={!selectedPlan}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={selectedPlan ? ["#e83030", "#c01818"] : [T.border, T.border]}
                style={styles.subscribeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.subscribeText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View
              style={[
                styles.planSummary,
                { backgroundColor: T.surface, borderColor: T.border },
              ]}
            >
              <Text style={[styles.planSummaryLabel, { color: T.text }]}>
                {plans.find((p) => p.id === selectedPlan)?.name} plan
              </Text>
              <Text style={[styles.planSummaryPrice, { color: T.accent }]}>
                ${plans.find((p) => p.id === selectedPlan)?.price}/mo
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: T.textMuted }]}>
              Choose a payment method
            </Text>
            {PAYMENT_METHODS.map(renderPaymentMethod)}

            {selectedMethod && renderMethodDetails()}

            <TouchableOpacity
              style={[
                styles.subscribeBtn,
                (!selectedMethod || isLoading) && styles.disabledBtn,
              ]}
              onPress={handlePay}
              disabled={!selectedMethod || isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  selectedMethod && !isLoading
                    ? ["#e83030", "#c01818"]
                    : [T.border, T.border]
                }
                style={styles.subscribeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.subscribeText}>Confirm & Subscribe</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.secureNote, { color: T.textDisabled }]}>
          <Ionicons name="lock-closed" size={12} color={T.textDisabled} />{" "}
          Secure payment. Cancel anytime.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 2 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },

  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    position: "relative",
  },

  popularBadge: {
    position: "absolute",
    top: -10,
    right: 16,
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

  planName: { fontSize: 18, fontWeight: "700" },
  planPrice: { fontSize: 28, fontWeight: "800", marginTop: 4 },
  planPeriod: { fontSize: 14, fontWeight: "500" },

  featuresList: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13 },

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

  secureNote: { fontSize: 12, textAlign: "center", marginTop: 16 },

  // ── Payment step ─────────────────────────────────────────────────────────
  planSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  planSummaryLabel: { fontSize: 15, fontWeight: "700" },
  planSummaryPrice: { fontSize: 15, fontWeight: "700" },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  methodIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  methodLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  detailsBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  detailsLabel: { fontSize: 12, marginBottom: 6, marginTop: 10 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  row: { flexDirection: "row" },
  mockNote: { fontSize: 11, marginTop: 12, fontStyle: "italic" },
  bankDetailsCard: { borderRadius: 10, padding: 14, marginBottom: 4 },
  bankDetailsTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bankDetailsLine: { fontSize: 13, marginBottom: 2 },
});
