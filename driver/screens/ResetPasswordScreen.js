import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { resetPassword, reset } from "../lib/AuthSlice";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
// ── Password strength calculator ─────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Very weak", color: "#ef4444" };
  if (score === 2) return { score, label: "Weak", color: "#f97316" };
  if (score === 3) return { score, label: "Fair", color: "#f59e0b" };
  if (score === 4) return { score, label: "Strong", color: "#22c55e" };
  return { score, label: "Very strong", color: "#16a34a" };
}

const REQUIREMENTS = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// ── Field component ───────────────────────────────────────────────────────────
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
  T,
  showPassword,
  onToggleShow,
  returnKeyType = "next",
  onSubmit,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: T.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: T.inputBg,
            borderColor: error ? T.accent : T.inputBorder,
          },
        ]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={error ? T.accent : T.textMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, { color: T.text }]}
          placeholder={placeholder}
          placeholderTextColor={T.placeholder}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
        />
        <TouchableOpacity
          onPress={onToggleShow}
          style={styles.eyeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={18}
            color={T.textMuted}
          />
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={styles.fieldErrorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={T.accent} />
          <Text style={[styles.fieldErrorText, { color: T.accent }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ResetPasswordScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { isLoading, error, success } = useSelector((s) => s.auth);

  // Token + email come from the deep link / navigation params
  // Deep link shape: yourapp://reset-password?token=XXX&email=YYY
  const token = route?.params?.token || "";
  const email = route?.params?.email || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [done, setDone] = useState(false);

  const strength = getStrength(newPassword);
  const confirmRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;

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
      setDone(true);
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 55,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [success]);

  // Animate strength bar width
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: newPassword ? strength.score / 5 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [newPassword, strength.score]);

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

  const validate = () => {
    const e = { newPassword: "", confirmPassword: "" };
    let valid = true;

    if (!newPassword) {
      e.newPassword = "Please enter a new password";
      valid = false;
    } else if (newPassword.length < 8) {
      e.newPassword = "Password must be at least 8 characters";
      valid = false;
    } else if (strength.score < 3) {
      e.newPassword =
        "Password is too weak — add uppercase, numbers, or symbols";
      valid = false;
    }

    if (!confirmPassword) {
      e.confirmPassword = "Please confirm your new password";
      valid = false;
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = "Passwords don't match";
      valid = false;
    }

    setErrors(e);
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      shake();
      return;
    }

    const result = await dispatch(
      resetPassword({
        token,
        email,
        newPassword,
        confirmPassword,
      }),
    );

    if (resetPassword.rejected.match(result)) {
      // error is already in Redux state, shake for feedback
      shake();
    }
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
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
          {/* Checkmark icon */}
          <View style={styles.checkmarkWrap}>
            <View
              style={[
                styles.checkmarkOuter,
                {
                  backgroundColor: T.successDim,
                  borderColor: T.success + "44",
                },
              ]}
            >
              <View
                style={[
                  styles.checkmarkInner,
                  { backgroundColor: T.success + "22" },
                ]}
              >
                <Ionicons name="checkmark-circle" size={44} color={T.success} />
              </View>
            </View>
            {/* Decorative ring */}
            <View
              style={[styles.checkRing, { borderColor: T.success + "18" }]}
            />
          </View>

          <Text style={[styles.successTitle, { color: T.text }]}>
            Password reset!
          </Text>
          <Text style={[styles.successBody, { color: T.textMuted }]}>
            Your password has been updated successfully. You can now log in with
            your new password.
          </Text>

          {/* Security tip */}
          <View
            style={[
              styles.tipCard,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
          >
            <View style={[styles.tipIcon, { backgroundColor: T.infoDim }]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={T.info}
              />
            </View>
            <Text style={[styles.tipText, { color: T.textMuted }]}>
              For your security, you have been logged out of all other devices.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Login" }] })
            }
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.loginBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="log-in-outline" size={18} color="#fff" />
              <Text style={styles.loginBtnText}>Log in now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
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
                  <Ionicons name="key" size={32} color={T.accent} />
                </View>
              </View>
              <View
                style={[styles.dotTL, { backgroundColor: T.accent + "30" }]}
              />
              <View
                style={[styles.dotBR, { backgroundColor: T.accent + "20" }]}
              />
            </View>

            {/* Heading */}
            <Text style={[styles.title, { color: T.text }]}>
              Create new password
            </Text>
            <Text style={[styles.subtitle, { color: T.textMuted }]}>
              Your new password must be different from your previous password.
            </Text>

            {/* Token missing warning */}
            {!token && (
              <View
                style={[
                  styles.warnBanner,
                  {
                    backgroundColor: T.warningDim,
                    borderColor: T.warning + "44",
                  },
                ]}
              >
                <Ionicons name="warning-outline" size={16} color={T.warning} />
                <Text style={[styles.warnBannerText, { color: T.warning }]}>
                  Reset link appears invalid. Please request a new one.
                </Text>
              </View>
            )}

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

            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {/* New password field */}
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={(v) => {
                  setNewPassword(v);
                  if (errors.newPassword)
                    setErrors((e) => ({ ...e, newPassword: "" }));
                }}
                placeholder="Enter new password"
                error={errors.newPassword}
                T={T}
                showPassword={showNew}
                onToggleShow={() => setShowNew(!showNew)}
                returnKeyType="next"
                onSubmit={() => confirmRef.current?.focus()}
              />

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <View style={styles.strengthSection}>
                  {/* Segmented bars */}
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4, 5].map((seg) => (
                      <View
                        key={seg}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor:
                              strength.score >= seg ? strength.color : T.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[styles.strengthLabel, { color: strength.color }]}
                  >
                    {strength.label}
                  </Text>
                </View>
              )}

              {/* Requirements checklist */}
              {newPassword.length > 0 && (
                <View
                  style={[
                    styles.requirementsList,
                    { backgroundColor: T.surface, borderColor: T.border },
                  ]}
                >
                  {REQUIREMENTS.map((req) => {
                    const met = req.test(newPassword);
                    return (
                      <View key={req.label} style={styles.requirementRow}>
                        <View
                          style={[
                            styles.reqDot,
                            {
                              backgroundColor: met
                                ? T.success + "20"
                                : T.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={met ? "checkmark" : "remove"}
                            size={11}
                            color={met ? T.success : T.textDisabled}
                          />
                        </View>
                        <Text
                          style={[
                            styles.requirementText,
                            { color: met ? T.textSecondary : T.textMuted },
                          ]}
                        >
                          {req.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Confirm password field */}
              <View ref={confirmRef}>
                <PasswordField
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    if (errors.confirmPassword)
                      setErrors((e) => ({ ...e, confirmPassword: "" }));
                  }}
                  placeholder="Re-enter your new password"
                  error={errors.confirmPassword}
                  T={T}
                  showPassword={showConfirm}
                  onToggleShow={() => setShowConfirm(!showConfirm)}
                  returnKeyType="done"
                  onSubmit={handleSubmit}
                />

                {/* Match indicator */}
                {confirmPassword.length > 0 && newPassword.length > 0 && (
                  <View
                    style={[
                      styles.matchRow,
                      {
                        backgroundColor:
                          newPassword === confirmPassword
                            ? T.successDim
                            : T.accentDim,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        newPassword === confirmPassword
                          ? "checkmark-circle"
                          : "close-circle"
                      }
                      size={14}
                      color={
                        newPassword === confirmPassword ? T.success : T.accent
                      }
                    />
                    <Text
                      style={[
                        styles.matchText,
                        {
                          color:
                            newPassword === confirmPassword
                              ? T.success
                              : T.accent,
                        },
                      ]}
                    >
                      {newPassword === confirmPassword
                        ? "Passwords match"
                        : "Passwords don't match"}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (isLoading || !token) && { opacity: 0.65 },
              ]}
              onPress={handleSubmit}
              disabled={isLoading || !token}
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
                    <Ionicons name="lock-closed" size={16} color="#fff" />
                    <Text style={styles.submitText}>Reset password</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Request new link if token is expired */}
            <TouchableOpacity
              style={styles.newLinkBtn}
              onPress={() => navigation.navigate("ForgotPassword")}
              activeOpacity={0.7}
            >
              <Text style={[styles.newLinkText, { color: T.textMuted }]}>
                Link expired?{" "}
                <Text style={{ color: T.accent, fontWeight: "700" }}>
                  Request a new one
                </Text>
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 120 : 100,
    paddingBottom: 48,
  },

  // Icon
  iconWrap: {
    alignSelf: "center",
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
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
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, lineHeight: 22, marginBottom: 24 },

  // Banners
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  warnBannerText: { flex: 1, fontSize: 13, fontWeight: "500" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: "500" },

  // Field
  fieldWrap: { marginBottom: 16 },
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
  eyeBtn: { padding: 2 },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  fieldErrorText: { fontSize: 12, fontWeight: "500" },

  // Strength meter
  strengthSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: -8,
    marginBottom: 12,
  },
  strengthBars: { flex: 1, flexDirection: "row", gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 72,
    textAlign: "right",
  },

  // Requirements
  requirementsList: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reqDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  requirementText: { fontSize: 13 },

  // Match indicator
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: -8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  matchText: { fontSize: 12, fontWeight: "600" },

  // Submit
  submitBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 16,
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

  // New link
  newLinkBtn: { alignItems: "center", paddingVertical: 8 },
  newLinkText: { fontSize: 13, textAlign: "center" },

  // ── Success state ──────────────────────────────────────────────────────────
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
  },
  checkmarkWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  checkmarkOuter: {
    width: 96,
    height: 96,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkInner: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  checkRing: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  successBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 32,
    width: "100%",
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
  loginBtn: {
    borderRadius: 50,
    overflow: "hidden",
    width: "100%",
    elevation: 6,
    shadowColor: "#e83030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  loginBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
