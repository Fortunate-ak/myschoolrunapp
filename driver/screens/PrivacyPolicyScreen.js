// screens/PrivacyPolicyScreen.js
// Was previously Linking.openURL("https://yourapp.com/privacy") — now a real
// in-app screen. Replace the placeholder copy below with your actual policy
// (or fetch it from your backend / CMS if it needs to stay editable there).
import React from "react";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  TextBlock,
} from "../components/DrawerOptionsScreen";

export default function PrivacyPolicyScreen() {
  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Privacy Policy" />

      <TextBlock heading="Last updated">21 July 2026</TextBlock>

      <TextBlock heading="Information we collect">
        We collect the information needed to run the school transport service
        safely: your account details, driver and vehicle information, live GPS
        location while a trip is active, and messages exchanged with guardians
        and dispatch through the app.
      </TextBlock>

      <TextBlock heading="How we use your information">
        Location data is used to power live tracking, ETAs, and delay alerts for
        guardians. Account and vehicle data are used to verify drivers, assign
        routes, and maintain safety records such as service and insurance dates.
      </TextBlock>

      <TextBlock heading="Location tracking">
        Your location is only shared while a trip is active. It is visible to
        guardians of students on your route and to your school administrator,
        and is stored temporarily to support trip history and incident review.
      </TextBlock>

      <TextBlock heading="Data sharing">
        We do not sell personal data. Information is shared only with the school
        or transport operator you drive for, and with service providers (such as
        mapping and messaging infrastructure) strictly to operate the app.
      </TextBlock>

      <TextBlock heading="Your choices">
        You can review and update your profile and vehicle details from the
        Account section at any time, and can contact support to request access
        to or deletion of your data, subject to safety record-keeping
        requirements.
      </TextBlock>

      <TextBlock heading="Contact us">
        Questions about this policy can be sent through Support → Contact
        Support in the app.
      </TextBlock>
    </OptionsScreenContainer>
  );
}
