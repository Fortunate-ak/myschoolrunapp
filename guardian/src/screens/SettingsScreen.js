import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen({ navigation }) {
  const { theme: T, isDark, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);

  const themeOptions = [
    { key: "dark", label: "Dark", icon: "moon" },
    { key: "light", label: "Light", icon: "sunny" },
    { key: "system", label: "System", icon: "phone-portrait" },
  ];

  const handleThemeSelect = (key) => {
    console.log("Theme selected:", key); // For debugging
    setPreference(key);
  };

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

          <Text style={[styles.headerTitle, { color: T.text }]}>Settings</Text>

          <View style={{ width: 36 }} />
        </View>

        {/* Appearance */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Appearance
          </Text>

          <View style={styles.themeSelector}>
            {themeOptions.map((option) => {
              const isActive = preference === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.themeOption,
                    { borderColor: T.border },
                    isActive && {
                      borderColor: T.accent,
                      backgroundColor: T.accentDim,
                    },
                  ]}
                  onPress={() => handleThemeSelect(option.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={isActive ? T.accent : T.textMuted}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: isActive ? T.accent : T.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={T.accent}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("LanguageScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="language-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>Language</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: T.textMuted }]}>
                English
              </Text>
              <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Notifications
          </Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>
                Push Notifications
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#333", true: T.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name="volume-high-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>Sound</Text>
            </View>
            <Switch
              value={sound}
              onValueChange={setSound}
              trackColor={{ false: "#333", true: T.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>Vibration</Text>
            </View>
            <Switch
              value={vibration}
              onValueChange={setVibration}
              trackColor={{ false: "#333", true: T.accent }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("NotificationsSettingsScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="settings-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Advanced Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Tracking */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>Tracking</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("MapSettingsScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="map-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Map Preferences
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("DataUsageScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="cellular-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Data Usage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>About</Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("SupportScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="help-buoy-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>
                Help & Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("AboutLegalScreen")}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>
                About & Legal
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: T.textMuted }]}>
                v1.0.0
              </Text>
              <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
            </View>
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
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: { fontSize: 13 },

  themeSelector: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
    marginBottom: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "column",
    gap: 4,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
