import React, { Component, useEffect, useRef, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Animated,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import { reset, forgotPassword } from "../lib/AuthSlice";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";

export default function ForgotPasswordScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { isLoading, error, success } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    return () => dispatch(reset());
  }, []);

  useEffect(() => {
    if (success) {
      setSent(true);
      startResendTimer();
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [success]);

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const validateEmail = (val) => {
    if (!val.trim()) return "Email address is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()))
      return "Enter a valid email address";
    return "";
  };

  const handleSend = async () => {
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      shake();
      return;
    }
    setEmailError("");
    dispatch(forgotPassword({ email: email.trim().toLowerCase() }));
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    dispatch(forgotPassword({ email: email.trim().toLowerCase() }));
    startResendTimer();
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.successWrap,
            {
              opacity: successAnim,
              transform: [
                {
                  scale: successAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.successIcon,
              { backgroundColor: T.successDim, borderColor: T.success + "44" },
            ]}
          >
            <View
              style={[
                styles.successIconInner,
                { backgroundColor: T.success + "22" },
              ]}
            >
              <Ionicons name="mail-open" size={36} color={T.success} />
            </View>
          </View>

          <Text style={[styles.successTitle, { color: T.text }]}>
            Check your inbox
          </Text>
          <Text style={[styles.successBody, { color: T.textMuted }]}>
            We sent a password reset link to
          </Text>
          <View
            style={[
              styles.emailChip,
              { backgroundColor: T.surface, borderColor: T.borderStrong },
            ]}
          >
            <Ionicons name="mail" size={14} color={T.accent} />
            <Text
              style={[styles.emailChipText, { color: T.text }]}
              numberOfLines={1}
            >
              {email.trim().toLowerCase()}
            </Text>
          </View>

          <Text style={[styles.successHint, { color: T.textMuted }]}>
            The link expires in 15 minutes. Check your spam folder if you don't
            see it.
          </Text>

          {/* Open email app button */}
          <TouchableOpacity
            style={[
              styles.openMailBtn,
              { backgroundColor: T.surface, borderColor: T.borderStrong },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={16} color={T.textSecondary} />
            <Text style={[styles.openMailText, { color: T.textSecondary }]}>
              Open email app
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendTimer > 0 || isLoading}
            style={styles.resendBtn}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={T.accent} />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  { color: resendTimer > 0 ? T.textDisabled : T.accent },
                ]}
              >
                {resendTimer > 0
                  ? `Resend in ${resendTimer}s`
                  : "Didn't receive it? Resend"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity
            style={[styles.backToLoginBtn, { borderColor: T.border }]}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={15} color={T.textMuted} />
            <Text style={[styles.backToLoginText, { color: T.textMuted }]}>
              Back to login
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Back button */}
      <TouchableOpacity
        style={[
          styles.backBtn,
          { backgroundColor: T.surface, borderColor: T.border },
        ]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={20} color={T.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Icon */}
            <View style={styles.iconWrap}>
              <View
                style={[
                  styles.iconOuter,
                  { backgroundColor: T.accentDim, borderColor: T.accentBorder },
                ]}
              >
                <View
                  style={[styles.iconInner, { backgroundColor: T.accentDim }]}
                >
                  <Ionicons name="lock-closed" size={32} color={T.accent} />
                </View>
              </View>
              {/* Decorative dots */}
              <View
                style={[styles.dotTL, { backgroundColor: T.accent + "30" }]}
              />
              <View
                style={[styles.dotBR, { backgroundColor: T.accent + "20" }]}
              />
            </View>

            {/* Heading */}
            <Text style={[styles.title, { color: T.text }]}>
              Forgot password?
            </Text>
            <Text style={[styles.subtitle, { color: T.textMuted }]}>
              No worries — enter your email and we'll send you a reset link.
            </Text>

            {/* API error banner */}
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: T.accentDim, borderColor: T.accentBorder },
                ]}
              >
                <Ionicons name="alert-circle" size={16} color={T.accent} />
                <Text style={[styles.errorBannerText, { color: T.accent }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Email field */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: T.textSecondary }]}>
                Email address
              </Text>
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: T.inputBg,
                      borderColor: emailError ? T.accent : T.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={emailError ? T.accent : T.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: T.text }]}
                    placeholder="Enter your email address"
                    placeholderTextColor={T.placeholder}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (emailError) setEmailError("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                  />
                  {email.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setEmail("")}
                      style={styles.clearBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={17}
                        color={T.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
              {emailError ? (
                <View style={styles.fieldErrorRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={13}
                    color={T.accent}
                  />
                  <Text style={[styles.fieldErrorText, { color: T.accent }]}>
                    {emailError}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSend}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#e83030", "#c01818"]}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.submitText}>Send reset link</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Back to login */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={15} color={T.textMuted} />
              <Text style={[styles.loginLinkText, { color: T.textMuted }]}>
                Back to login
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 120 : 100,
    paddingBottom: 40,
  },

  // Icon
  iconWrap: {
    alignSelf: "center",
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  iconOuter: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dotTL: {
    position: "absolute",
    top: 6,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotBR: {
    position: "absolute",
    bottom: 4,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  // Heading
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 28,
  },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: "500" },

  // Field
  fieldWrap: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 54,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputIcon: { flexShrink: 0 },
  input: { flex: 1, fontSize: 15, height: "100%" },
  clearBtn: { padding: 2 },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  fieldErrorText: { fontSize: 12, fontWeight: "500" },

  // Submit
  submitBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 20,
    elevation: 6,
    shadowColor: "#e83030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Back link
  loginLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  loginLinkText: { fontSize: 14 },

  // ── Success state ──────────────────────────────────────────────────────────
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 80 : 60,
    paddingBottom: 40,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  successIconInner: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  successBody: { fontSize: 15, textAlign: "center", marginBottom: 12 },
  emailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    marginBottom: 20,
    maxWidth: "100%",
  },
  emailChipText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  successHint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 8,
  },

  openMailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    marginBottom: 16,
    width: "100%",
    justifyContent: "center",
  },
  openMailText: { fontSize: 14, fontWeight: "600" },

  resendBtn: { paddingVertical: 10, marginBottom: 20 },
  resendText: { fontSize: 14, fontWeight: "600" },

  backToLoginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 50,
    borderWidth: 1,
  },
  backToLoginText: { fontSize: 13 },
});
