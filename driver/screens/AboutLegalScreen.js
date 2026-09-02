// screens/AboutLegalScreen.js
import React from "react";
import { Text, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

// No dedicated screens exist for these yet — placeholders so tapping them
// doesn't crash. Swap in real navigation once each screen is built.
const comingSoon = (feature) =>
  Alert.alert("Coming Soon", `${feature} is on its way.`);

export default function AboutLegalScreen() {
  const navigation = useNavigation();
  const { theme: T } = useTheme();

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="About & Legal" />

      <OptionsSection>
        <OptionRow
          icon="information-circle-outline"
          label="About the App"
          subtitle="Version, team & mission"
          onPress={() => comingSoon("About the App")}
        />
        <OptionDivider />
        <OptionRow
          icon="sparkles-outline"
          label="What's New"
          subtitle="See the latest updates"
          onPress={() => comingSoon("What's New")}
        />
        <OptionDivider />
        {/* These two are real, registered in-app screens. */}
        <OptionRow
          icon="lock-closed-outline"
          label="Privacy Policy"
          onPress={() => navigation.navigate("PrivacyPolicyScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="document-text-outline"
          label="Terms & Conditions"
          onPress={() => navigation.navigate("TermsScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="shield-checkmark-outline"
          label="Data & Permissions"
          subtitle="What we collect and why"
          onPress={() => comingSoon("Data & Permissions")}
        />
        <OptionDivider />
        <OptionRow
          icon="code-outline"
          label="Open Source Licenses"
          onPress={() => comingSoon("Open Source Licenses")}
        />
        <OptionDivider />
        <OptionRow
          icon="information-outline"
          label="App Version"
          rightElement={
            <Text style={{ fontSize: 13, color: T.textMuted }}>2.4.1</Text>
          }
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}
