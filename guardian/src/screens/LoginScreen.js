import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { LoginUser } from "../lib/AuthSlice";
import { useTheme } from "../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const { theme: T } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const validateInputs = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter a valid email address",
        visibilityTime: 3000,
      });
      return false;
    }

    if (!password) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Password is required",
        visibilityTime: 3000,
      });
      return false;
    }

    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Password must be at least 6 characters",
        visibilityTime: 3000,
      });
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;
    if (isLoading) return;

    Keyboard.dismiss();

    try {
      const result = await dispatch(LoginUser({ email, password })).unwrap();

      Toast.show({
        type: "success",
        text1: "Welcome Back!",
        text2: `Hello ${result.fullname || "User"}`,
        visibilityTime: 2000,
      });

      if (!result.isVerified) {
        navigation.navigate("OTP", {
          email: email,
          fromLogin: true,
        });
      }
    } catch (error) {
      const errorMessage =
        typeof error === "string"
          ? error
          : error?.message || "Something went wrong. Please try again.";

      if (
        error?.status === 423 ||
        errorMessage.toLowerCase().includes("locked")
      ) {
        Toast.show({
          type: "error",
          text1: "Account Locked 🔒",
          text2: errorMessage,
          visibilityTime: 5000,
        });
        return;
      }

      if (
        error?.status === 429 ||
        errorMessage.toLowerCase().includes("too many")
      ) {
        Toast.show({
          type: "error",
          text1: "Too Many Attempts",
          text2: "Please wait a moment before trying again",
          visibilityTime: 4000,
        });
        return;
      }

      if (
        errorMessage.toLowerCase().includes("invalid") ||
        errorMessage.toLowerCase().includes("credentials")
      ) {
        Toast.show({
          type: "error",
          text1: "Login Failed",
          text2: "Invalid email or password. Please try again.",
          visibilityTime: 3000,
        });
        return;
      }

      Toast.show({
        type: "error",
        text1: "Login Failed",
        text2: errorMessage,
        visibilityTime: 3000,
      });
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate("ForgotPassword", { email });
  };

  const handleSignUp = () => {
    navigation.navigate("Signup");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bounces={true}
            contentInsetAdjustmentBehavior="automatic"
          >
            <View style={styles.centeredContent}>
              {/* App Logo */}
              <View style={styles.logoContainer}>
                <Image
                  source={require("../../assets/logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={[styles.title, { color: T.text }]}>Sign In</Text>
              <Text style={[styles.subtitle, { color: T.textSecondary }]}>
                Log in to continue your seamless journey
              </Text>

              {/* Email input */}
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: T.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={T.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailInputRef}
                  style={[styles.input, { color: T.text }]}
                  placeholder="Enter Your Email"
                  placeholderTextColor={T.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    passwordInputRef.current?.focus();
                  }}
                />
              </View>

              {/* Password input */}
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: T.inputBg,
                    borderColor: T.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={T.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.input, { color: T.text, paddingRight: 48 }]}
                  placeholder="Enter Your Password"
                  placeholderTextColor={T.placeholder}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPass(!showPass)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPass ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color={T.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Login button */}
              <TouchableOpacity
                onPress={handleLogin}
                activeOpacity={0.85}
                style={styles.loginBtn}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={isLoading ? ["#666", "#444"] : [T.accent, "#c01818"]}
                  style={styles.loginBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Login</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                <Text style={[styles.forgotText, { color: T.textMuted }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View
                  style={[styles.dividerLine, { backgroundColor: T.border }]}
                />
                <View
                  style={[styles.dividerLine, { backgroundColor: T.border }]}
                />
              </View>

              {/* Sign up */}
              <TouchableOpacity
                style={styles.signupRow}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                <Text style={[styles.signupText, { color: T.textSecondary }]}>
                  Don't have an account?{"  "}
                  <Text style={[styles.signupLink, { color: T.accent }]}>
                    Sign Up
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  centeredContent: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 28,
    lineHeight: 20,
    textAlign: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  loginBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 14,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  loginBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  forgotBtn: { alignItems: "center", marginBottom: 22 },
  forgotText: { fontSize: 13 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1 },
  signupRow: { alignItems: "center" },
  signupText: { fontSize: 14 },
  signupLink: { fontWeight: "700" },
});
