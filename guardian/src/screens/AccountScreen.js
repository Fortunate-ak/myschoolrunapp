// screens/guardian/AccountScreen.js
import React from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const { user } = useSelector((state) => state.auth);
  const { guardianProfile } = useSelector((state) => state.users);

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

          <Text style={[styles.headerTitle, { color: T.text }]}>Account</Text>

          <View style={{ width: 36 }} />
        </View>

        {/* Profile Section */}
        <View
          style={[
            styles.profileSection,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.fullname?.charAt(0) || "G"}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: T.text }]}>
            {user?.fullname || "Guardian"}
          </Text>
          <Text style={[styles.profileEmail, { color: T.textMuted }]}>
            {user?.email || "No email"}
          </Text>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: T.border }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Text style={[styles.editBtnText, { color: T.accent }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account Settings */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>Account</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("Security")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("PaymentScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="card-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Payment & Subscription
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("NotificationsSettingsScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>
                Notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Family Section */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>Family</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate("StudentsStack", { screen: "StudentsList" })
            }
          >
            <View style={styles.rowLeft}>
              <Ionicons name="people-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                My Students
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("VehicleScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="bus-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Vehicle & Driver
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
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

  profileSection: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(232,48,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  profileAvatarText: { fontSize: 28, fontWeight: "700", color: "#e83030" },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  editBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  editBtnText: { fontSize: 13, fontWeight: "600" },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { fontSize: 14 },
});
