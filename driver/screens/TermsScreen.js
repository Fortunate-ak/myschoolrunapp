// screens/TermsScreen.js
// Was previously Linking.openURL("https://yourapp.com/terms") — now a real
// in-app screen. Replace the placeholder copy below with your actual terms
// (or fetch it from your backend / CMS if it needs to stay editable there).
import React from "react";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  TextBlock,
} from "../components/DrawerOptionsScreen";

export default function TermsScreen() {
  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Terms & Conditions" />

      <TextBlock heading="Last updated">21 July 2026</TextBlock>

      <TextBlock heading="Acceptance of terms">
        By using this app as a driver, you agree to operate your assigned
        vehicle and routes safely, keep your profile and vehicle information
        accurate, and comply with your school or transport operator's policies.
      </TextBlock>

      <TextBlock heading="Driver responsibilities">
        You're responsible for verifying student pickups and drop-offs, starting
        and ending trips accurately, keeping vehicle documents (registration,
        insurance, service records) up to date, and reporting incidents promptly
        through the app.
      </TextBlock>

      <TextBlock heading="Location sharing">
        Starting a trip enables live location sharing with guardians and your
        administrator for the duration of that trip. Ending the trip stops live
        sharing.
      </TextBlock>

      <TextBlock heading="Account & access">
        Your account is personal to you and shouldn't be shared. We may suspend
        access if information provided is inaccurate or if usage violates safety
        policies.
      </TextBlock>

      <TextBlock heading="Changes to these terms">
        We may update these terms from time to time. Continued use of the app
        after an update means you accept the revised terms.
      </TextBlock>

      <TextBlock heading="Contact us">
        Questions about these terms can be sent through Support → Contact
        Support in the app.
      </TextBlock>
    </OptionsScreenContainer>
  );
}
