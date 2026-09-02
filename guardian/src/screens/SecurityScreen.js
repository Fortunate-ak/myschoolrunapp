// screens/guardian/SecurityScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { changePassword } from "../lib/AuthSlice";

export default function SecurityScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Toast.show({ type: "error", text1: "All fields are required" });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      Toast.show({
        type: "error",
        text1: "Password must be at least 6 characters",
      });
      return;
    }
    try {
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap();
      Toast.show({ type: "success", text1: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: error || "Failed to change password",
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: T.border, paddingTop: insets.top + 10 },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Security</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Change Password
          </Text>
          {/* Current Password */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: T.text }]}
              placeholder="Current Password"
              placeholderTextColor={T.textMuted}
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(!showCurrent)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showCurrent ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={T.textMuted}
              />
            </TouchableOpacity>
          </View>
          {/* New Password */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: T.text }]}
              placeholder="New Password"
              placeholderTextColor={T.textMuted}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              onPress={() => setShowNew(!showNew)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showNew ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={T.textMuted}
              />
            </TouchableOpacity>
          </View>
          {/* Confirm Password */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: T.text }]}
              placeholder="Confirm New Password"
              placeholderTextColor={T.textMuted}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showConfirm ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={T.textMuted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.updateBtn, { backgroundColor: T.accent }]}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateBtnText}>Update Password</Text>
            )}
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
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14 },
  eyeBtn: { padding: 4 },
  updateBtn: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  updateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
