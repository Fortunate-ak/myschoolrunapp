// screens/AccountScreen.js
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import OptionsScreenContainer, {
  OptionsScreenHeader,
  OptionsSection,
  OptionRow,
  OptionDivider,
} from "../components/DrawerOptionsScreen";

export default function AccountScreen() {
  const navigation = useNavigation();
  const { theme: T } = useTheme();
  const { user } = useSelector((s) => s.auth);
  const { driverProfile } = useSelector((s) => s.users);

  const displayName = user?.fullname || driverProfile?.fullName || "Driver";

  return (
    <OptionsScreenContainer>
      <OptionsScreenHeader title="Account" />

      {/* Profile summary */}
      <View
        style={[
          styles.profileCard,
          { backgroundColor: T.surface, borderColor: T.border },
        ]}
      >
        {driverProfile?.profileImage ? (
          <Image
            source={{ uri: driverProfile.profileImage }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: T.accentDim || T.surface },
            ]}
          >
            <Ionicons name="person" size={26} color={T.accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.profileName, { color: T.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={[styles.profileMeta, { color: T.textMuted }]}
            numberOfLines={1}
          >
            {user?.email || "No email on file"}
          </Text>
        </View>
      </View>

      {/* Account actions */}
      <OptionsSection>
        <OptionRow
          icon="create-outline"
          label="Edit Profile"
          subtitle="Update your personal and vehicle info"
          onPress={() => navigation.navigate("EditProfileScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="lock-closed-outline"
          label="Change Password"
          subtitle="Update your login password"
          onPress={() => navigation.navigate("SecurityScreen")}
        />
        <OptionDivider />
        <OptionRow
          icon="document-text-outline"
          label="View Full Profile"
          subtitle="See all your driver details"
          onPress={() => navigation.navigate("ViewProfileScreen")}
        />
      </OptionsSection>
    </OptionsScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  profileMeta: { fontSize: 13 },
});
