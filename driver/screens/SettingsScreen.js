// screens/SettingsScreen.js
import React from "react";
import { Text, Switch } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../contexts/ThemeContext";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

export default function SettingsScreen() {
  const { theme: T, isDark, setPreference } = useTheme();
  const navigation = useNavigation();

  const toggleDarkMode = () => {
    if (typeof setPreference !== "function") {
      console.warn("setPreference is not available from useTheme()");
      return;
    }
    setPreference(isDark ? "light" : "dark");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Settings" />

      <OptionsSection>
        <OptionRow
          icon={isDark ? "moon" : "sunny-outline"}
          label="Appearance"
          subtitle={isDark ? "Dark mode is on" : "Light mode is on"}
          onPress={toggleDarkMode}
          rightElement={
            <Switch
              value={isDark}
              onValueChange={toggleDarkMode}
              trackColor={{ false: "#767577", true: T.accent }}
              thumbColor={isDark ? "#fff" : "#f4f3f4"}
            />
          }
        />
        <OptionDivider />
        <OptionRow
          icon="language-outline"
          label="Language"
          subtitle="English (default)"
          onPress={() => navigation.navigate("LanguageScreen")}
          rightElement={
            <Text style={{ fontSize: 13, color: T.textMuted }}>EN</Text>
          }
        />
        <OptionDivider />
        <OptionRow
          icon="notifications-outline"
          label="Notifications"
          subtitle="Push, SMS & email preferences"
          onPress={() => navigation.navigate("NotificationsSettingsScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="map-outline"
          label="Map Preferences"
          subtitle="Map style, units & tracking"
          onPress={() => navigation.navigate("MapSettingsScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="cellular-outline"
          label="Data Usage"
          subtitle="Offline maps & background sync"
          onPress={() => navigation.navigate("DataUsageScreen")}
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}
