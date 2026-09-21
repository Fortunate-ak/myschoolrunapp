// screens/guardian/AddPaymentMethodScreen.js
import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { processPayment, PAYMENT_METHODS } from "../services/paymentService";
import { updateLocalGuardianProfile } from "../lib/UserSlice";

// NOTE: there is no backend endpoint yet to update a payment method on its
// own — subscribeGuardian (POST /users/subscribe) is the only endpoint that
// writes paymentMethod/paymentReference, and it requires a plan too. So
// this screen runs the same dummy processPayment() flow used at checkout,
// then saves the result into Redux ONLY (via updateLocalGuardianProfile,
// an existing reducer in UserSlice.js) rather than the server. This means
// it will look right in the app immediately, but the change won't survive
// a logout or a fresh getGuardianProfile() fetch. If you want this to
// actually persist, we'd need a small new backend endpoint (e.g. PATCH
// /users/payment-method) — happy to build that next if you want it.
export default function AddPaymentMethodScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [bankReference, setBankReference] = useState("");

  const handleSave = async () => {
    if (!selectedMethod) {
      Toast.show({
        type: "error",
        text1: "Select a Payment Method",
        text2: "Choose which method to add",
      });
      return;
    }

    setIsLoading(true);
    try {
      const details =
        selectedMethod === "card"
          ? { cardNumber, expiry: cardExpiry, cvv: cardCvv, cardholderName }
          : selectedMethod === "ecocash" || selectedMethod === "onemoney"
            ? { phoneNumber: mobileNumber }
            : selectedMethod === "bank_transfer"
              ? { reference: bankReference }
              : {};

      const result = await processPayment(selectedMethod, details);

      dispatch(
        updateLocalGuardianProfile({
          field: "paymentMethod",
          value: result.paymentMethod,
        }),
      );
      dispatch(
        updateLocalGuardianProfile({
          field: "paymentReference",
          value: result.paymentReference,
        }),
      );

      Toast.show({
        type: "success",
        text1: "Payment Method Added",
        text2: "This is stored locally only until it's confirmed at your next subscription payment.",
      });
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't Add Payment Method",
        text2: typeof error === "string" ? error : error?.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderMethodRow = (method) => {
    const isSelected = selectedMethod === method.id;
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.methodRow,
          { borderColor: T.border, backgroundColor: T.surface },
          isSelected && { borderColor: T.accent },
        ]}
        onPress={() => setSelectedMethod(method.id)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={method.icon}
          size={20}
          color={isSelected ? T.accent : T.textMuted}
        />
        <Text
          style={[
            styles.methodLabel,
            { color: isSelected ? T.text : T.textMuted },
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

  const renderDetails = () => {
    if (selectedMethod === "card") {
      return (
        <View style={styles.detailsBlock}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="Name on card"
            placeholderTextColor={T.textMuted}
            value={cardholderName}
            onChangeText={setCardholderName}
          />
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="Card number"
            placeholderTextColor={T.textMuted}
            keyboardType="number-pad"
            maxLength={19}
            value={cardNumber}
            onChangeText={setCardNumber}
          />
          <View style={styles.row}>
            <TextInput
              style={[
                styles.input,
                { flex: 1, marginRight: 10, color: T.text, borderColor: T.border },
              ]}
              placeholder="MM/YY"
              placeholderTextColor={T.textMuted}
              maxLength={5}
              value={cardExpiry}
              onChangeText={setCardExpiry}
            />
            <TextInput
              style={[styles.input, { flex: 1, color: T.text, borderColor: T.border }]}
              placeholder="CVV"
              placeholderTextColor={T.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={cardCvv}
              onChangeText={setCardCvv}
            />
          </View>
          <Text style={[styles.mockNote, { color: T.textMuted }]}>
            Dummy checkout — no real card is charged.
          </Text>
        </View>
      );
    }

    if (selectedMethod === "ecocash" || selectedMethod === "onemoney") {
      return (
        <View style={styles.detailsBlock}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder={
              selectedMethod === "ecocash" ? "EcoCash number" : "OneMoney number"
            }
            placeholderTextColor={T.textMuted}
            keyboardType="phone-pad"
            value={mobileNumber}
            onChangeText={setMobileNumber}
          />
          <Text style={[styles.mockNote, { color: T.textMuted }]}>
            Dummy prompt — simulates a USSD push and PIN confirmation.
          </Text>
        </View>
      );
    }

    if (selectedMethod === "bank_transfer") {
      return (
        <View style={styles.detailsBlock}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="Transfer reference / receipt number"
            placeholderTextColor={T.textMuted}
            value={bankReference}
            onChangeText={setBankReference}
          />
          <Text style={[styles.mockNote, { color: T.textMuted }]}>
            Dummy flow — a real integration would hold this as pending until reconciled.
          </Text>
        </View>
      );
    }

    if (selectedMethod === "cash_on_pickup") {
      return (
        <Text style={[styles.mockNote, { color: T.textMuted, marginTop: 10 }]}>
          You'll pay the driver in cash — nothing else to add here.
        </Text>
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: T.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={T.text}
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          suppressHighlighting
        />
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Add Payment Method
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {PAYMENT_METHODS.map(renderMethodRow)}
        {selectedMethod && renderDetails()}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: T.accent },
            (!selectedMethod || isLoading) && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={!selectedMethod || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Payment Method</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },

  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
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

  detailsBlock: { marginTop: 6, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row" },
  mockNote: { fontSize: 11, fontStyle: "italic", marginTop: 4 },

  saveBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
