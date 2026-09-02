// components/DrawerOptionsScreen.js
// Shared building blocks for every screen that a grouped drawer item opens
// (Vehicle, Students, History, Account, Settings, Support, About & Legal).
// Keeping this in one place means each screen file only has to describe
// *what* rows it shows, not how a row/header/section looks.
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";

// Full-screen wrapper: background + scroll container
export default function OptionsScreenContainer({ children }) {
  const { theme: T } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// Back button + title, standard on every sub-screen
export function OptionsScreenHeader({ title }) {
  const { theme: T } = useTheme();
  const navigation = useNavigation();
  return (
    <View style={[styles.header, { borderBottomColor: T.border }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={24} color={T.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// Optional sub-header label above a group of rows (e.g. "PREFERENCES")
export function OptionsSectionLabel({ label }) {
  const { theme: T } = useTheme();
  if (!label) return null;
  return (
    <Text style={[styles.sectionLabel, { color: T.textMuted }]}>{label}</Text>
  );
}

// Rounded card that groups a set of OptionRow items
export function OptionsSection({ children, style }) {
  const { theme: T } = useTheme();
  return (
    <View
      style={[
        styles.sectionContent,
        { backgroundColor: T.surface, borderColor: T.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// A single tappable row: icon, label, optional subtitle, optional right element
export function OptionRow({
  icon,
  label,
  subtitle,
  onPress,
  rightElement = null,
  danger = false,
  disabled = false,
}) {
  const { theme: T } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled || !onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={danger ? "#ff4444" : T.text} />
        <View style={styles.rowTextWrap}>
          <Text
            style={[styles.rowLabel, { color: danger ? "#ff4444" : T.text }]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, { color: T.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightElement !== null
        ? rightElement
        : onPress && (
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          )}
    </TouchableOpacity>
  );
}

// Plain-text block for legal/info screens (a heading + paragraph). Renders
// inside OptionsScreenContainer just like OptionsSection does, but for
// prose rather than tappable rows.
export function TextBlock({ heading, children }) {
  const { theme: T } = useTheme();
  return (
    <View style={styles.textBlock}>
      {heading ? (
        <Text style={[styles.textBlockHeading, { color: T.text }]}>
          {heading}
        </Text>
      ) : null}
      <Text style={[styles.textBlockBody, { color: T.textSecondary }]}>
        {children}
      </Text>
    </View>
  );
}

// Thin divider between rows inside a section
export function OptionDivider() {
  const { theme: T } = useTheme();
  return <View style={[styles.divider, { backgroundColor: T.border }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSpacer: { width: 40 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionContent: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowSubtitle: { fontSize: 12, marginTop: 2 },

  divider: { height: 0.5, marginLeft: 50 },

  textBlock: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  textBlockHeading: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  textBlockBody: {
    fontSize: 13.5,
    lineHeight: 21,
  },
});
