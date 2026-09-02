import React, { useState } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { SignupUser } from "../lib/AuthSlice";
import { useDispatch } from "react-redux";
import Toast from "react-native-toast-message";
import { sendVerificationOTP } from "../lib/AuthSlice";

export default function SignupScreen({ navigation }) {
  const dispatch = useDispatch();
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const role = "driver";

  const validateForm = () => {
    if (!fullname.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter your full name",
      });
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter a valid email address",
      });
      return false;
    }

    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Password must be at least 6 characters",
      });
      return false;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Passwords do not match",
      });
      return false;
    }

    if (!agreed) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please agree to Terms & Conditions",
      });
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const signupData = { fullname, email, password, confirmPassword, role };
      await dispatch(SignupUser(signupData)).unwrap();
      navigation.navigate("OTP", { email });
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Signup Failed",
        text2: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Account</Text>
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          {/* Name */}
          <Text style={styles.label}>Name</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Please input your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={fullname}
              onChangeText={setFullname}
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="example@gmail.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { paddingRight: 48 }]}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { paddingRight: 48 }]}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          </View>

          {/* T&C */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={styles.checkText}>
              Agree with{" "}
              <Text style={styles.checkLink}>Terms & Conditions</Text>
            </Text>
          </TouchableOpacity>

          {/* Sign Up button */}
          <TouchableOpacity
            onPress={handleSignup}
            activeOpacity={0.85}
            style={styles.signupBtn}
            disabled={loading}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.signupBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.signupBtnText}>Sign Up</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
              <View style={styles.googleIconBg}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Sign in link */}
          <TouchableOpacity
            style={styles.signinRow}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.signinText}>
              Already have an account?{"  "}
              <Text style={styles.signinLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  content: { paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  formSection: { paddingHorizontal: 24 },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrapper: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: "center",
  },
  input: {
    color: "#ffffff",
    fontSize: 14,
    flex: 1,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#e83030",
    borderColor: "#e83030",
  },
  checkText: { fontSize: 13, color: "rgba(255,255,255,0.55)" },
  checkLink: { color: "#fff", fontWeight: "700" },

  signupBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  signupBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  signupBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerText: { fontSize: 12, color: "rgba(255,255,255,0.35)" },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 28,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 12,
    width: "100%",
  },
  googleIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4285f4",
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },

  signinRow: { alignItems: "center" },
  signinText: { fontSize: 14, color: "rgba(255,255,255,0.45)" },
  signinLink: { color: "#e83030", fontWeight: "700" },
});
