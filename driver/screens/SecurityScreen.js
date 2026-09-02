// screens/SecurityScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { changePassword } from "../lib/AuthSlice";
import Toast from "react-native-toast-message";

export default function SecurityScreen() {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { isLoading } = useSelector((s) => s.auth);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Toast.show({ type: "error", text1: "Please fill all fields" });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }
    try {
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap();
      Toast.show({ type: "success", text1: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      Toast.show({ type: "error", text1: err || "Failed to change password" });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: T.surface, borderColor: T.border },
        ]}
      >
        <Text style={[styles.title, { color: T.text }]}>Change Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="Current Password"
            placeholderTextColor={T.textMuted}
            secureTextEntry={!showCurrent}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TouchableOpacity
            onPress={() => setShowCurrent(!showCurrent)}
            style={styles.eye}
          >
            <Ionicons
              name={showCurrent ? "eye-off" : "eye"}
              size={20}
              color={T.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="New Password"
            placeholderTextColor={T.textMuted}
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity
            onPress={() => setShowNew(!showNew)}
            style={styles.eye}
          >
            <Ionicons
              name={showNew ? "eye-off" : "eye"}
              size={20}
              color={T.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { color: T.text, borderColor: T.border }]}
            placeholder="Confirm New Password"
            placeholderTextColor={T.textMuted}
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirm(!showConfirm)}
            style={styles.eye}
          >
            <Ionicons
              name={showConfirm ? "eye-off" : "eye"}
              size={20}
              color={T.textMuted}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: T.accent }]}
          onPress={handleChangePassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#ccc",
  },
  input: { flex: 1, padding: 12, fontSize: 15 },
  eye: { padding: 12 },
  btn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
