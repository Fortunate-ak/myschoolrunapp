// screens/HistoryScreen.js
import React from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

export default function HistoryScreen() {
  const navigation = useNavigation();

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="History" />

      <OptionsSection>
        {/* No dedicated Trip History screen exists yet — replace this
            Alert with real navigation once one is built. */}
        <OptionRow
          icon="time-outline"
          label="Trip History"
          subtitle="Past trips and routes driven"
          onPress={() =>
            Alert.alert("Coming Soon", "Trip history is on its way.")
          }
        />
        <OptionDivider />
        <OptionRow
          icon="stats-chart-outline"
          label="Performance"
          subtitle="Punctuality, speed & ratings"
          onPress={() => navigation.navigate("PerformanceScreen")}
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}
