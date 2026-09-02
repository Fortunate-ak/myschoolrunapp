// screens/SupportScreen.js
import React from "react";
import { Alert, Linking } from "react-native";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

// None of these have dedicated screens yet — each Alert below is a
// placeholder. Swap in real navigation/screens as you build them.
const comingSoon = (feature) =>
  Alert.alert("Coming Soon", `${feature} is on its way.`);

export default function SupportScreen() {
  const emailSupport = () => {
    Linking.openURL("mailto:support@yourapp.com").catch(() =>
      Alert.alert("Error", "Could not open your email app."),
    );
  };

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Support" />

      <OptionsSection>
        <OptionRow
          icon="help-circle-outline"
          label="Help Centre"
          subtitle="FAQs and how-to guides"
          onPress={() => comingSoon("The Help Centre")}
        />
        <OptionDivider />
        {/* Real action: opens the device's email app instead of a
            nonexistent in-app screen. */}
        <OptionRow
          icon="mail-outline"
          label="Contact Support"
          subtitle="Get help from our team"
          onPress={emailSupport}
        />
        <OptionDivider />
        <OptionRow
          icon="flag-outline"
          label="Report a Problem"
          subtitle="Something broken? Tell us"
          onPress={() => comingSoon("Reporting a problem")}
        />
        <OptionDivider />
        <OptionRow
          icon="chatbubble-outline"
          label="Send Feedback"
          subtitle="Help us improve the app"
          onPress={() => comingSoon("Sending feedback")}
        />
        <OptionDivider />
        <OptionRow
          icon="call-outline"
          label="Emergency Contacts"
          subtitle="SOS and emergency numbers"
          onPress={() => comingSoon("Emergency contacts")}
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}
