// screens/EditProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  Image,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useDispatch, useSelector } from "react-redux";
import { updateDriver, getDriverProfile } from "../lib/UserSlice";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { getRegistrationFormatStatus } from "../utils/helpers";

// Reuse the same field components from SetProfileScreen (or define inline)
// For brevity we'll inline them here, but you can extract to a shared component file.

export default function EditProfileScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { driverProfile, isLoading } = useSelector((s) => s.users);
  const [formData, setFormData] = useState({
    idNumber: "",
    licenseNumber: "",
    gender: "",
    profileImage: null,
    carMake: "",
    carModel: "",
    vehicleImage: null,
    registrationNumber: "",
    capacity: "",
    lastServiceDate: "",
    nextServiceDate: "",
    insuranceExpiry: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (driverProfile) {
      setFormData({
        idNumber: driverProfile.idNumber || "",
        licenseNumber: driverProfile.licenseNumber || "",
        gender: driverProfile.gender || "",
        profileImage: driverProfile.profileImage || null,
        carMake: driverProfile.carMake || "",
        carModel: driverProfile.carModel || "",
        vehicleImage: driverProfile.vehicleImage || null,
        registrationNumber: driverProfile.registrationNumber || "",
        capacity: driverProfile.capacity?.toString() || "",
        lastServiceDate: driverProfile.lastServiceDate || "",
        nextServiceDate: driverProfile.nextServiceDate || "",
        insuranceExpiry: driverProfile.insuranceExpiry || "",
      });
    }
  }, [driverProfile]);

  const update = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async (fieldName) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setFormData((prev) => ({ ...prev, [fieldName]: result.assets[0] }));
    }
  };

  const handleSubmit = async () => {
    if (
      !formData.idNumber ||
      !formData.licenseNumber ||
      !formData.gender ||
      !formData.carMake ||
      !formData.carModel ||
      !formData.registrationNumber ||
      !formData.capacity
    ) {
      Toast.show({ type: "error", text1: "Missing required fields" });
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        updateDriver({
          id: driverProfile.id,
          data: {
            ...formData,
            capacity: parseInt(formData.capacity, 10),
          },
        }),
      ).unwrap();
      await dispatch(getDriverProfile()); // refresh
      Toast.show({ type: "success", text1: "Profile updated successfully" });
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: error || "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render fields – you can reuse the same components from SetProfileScreen
  // For brevity, I'll use simplified fields here. In practice, move them to a shared file.

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Edit Profile
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Image */}
          <TouchableOpacity
            style={styles.imageTile}
            onPress={() => pickImage("profileImage")}
          >
            {formData.profileImage?.uri ? (
              <Image
                source={{ uri: formData.profileImage.uri }}
                style={styles.imagePreview}
              />
            ) : formData.profileImage ? (
              <Image
                source={{ uri: formData.profileImage }}
                style={styles.imagePreview}
              />
            ) : (
              <>
                <Ionicons name="camera-outline" size={32} color={T.textMuted} />
                <Text style={{ color: T.textMuted, marginTop: 8 }}>
                  Add Profile Photo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Fields */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>ID Number *</Text>
            <TextInput
              style={[styles.input, { color: T.text, borderColor: T.border }]}
              value={formData.idNumber}
              onChangeText={update("idNumber")}
              placeholder="ID Number"
              placeholderTextColor={T.textMuted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>
              License Number *
            </Text>
            <TextInput
              style={[styles.input, { color: T.text, borderColor: T.border }]}
              value={formData.licenseNumber}
              onChangeText={update("licenseNumber")}
              placeholder="Driver's License"
              placeholderTextColor={T.textMuted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>Gender *</Text>
            <View style={styles.genderRow}>
              {["male", "female", "other"].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.genderOption,
                    { borderColor: T.border },
                    formData.gender === opt && {
                      borderColor: T.accent,
                      backgroundColor: T.accentDim,
                    },
                  ]}
                  onPress={() => update("gender")(opt)}
                >
                  <Text
                    style={[
                      styles.genderText,
                      {
                        color: formData.gender === opt ? T.accent : T.textMuted,
                      },
                    ]}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: T.text }]}>
                  Car Make *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: T.text, borderColor: T.border },
                  ]}
                  value={formData.carMake}
                  onChangeText={update("carMake")}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={T.textMuted}
                />
              </View>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: T.text }]}>
                  Car Model *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: T.text, borderColor: T.border },
                  ]}
                  value={formData.carModel}
                  onChangeText={update("carModel")}
                  placeholder="e.g. Hiace"
                  placeholderTextColor={T.textMuted}
                />
              </View>
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>
              Registration *
            </Text>
            <TextInput
              style={[styles.input, { color: T.text, borderColor: T.border }]}
              value={formData.registrationNumber}
              onChangeText={update("registrationNumber")}
              placeholder="ABC 1234"
              placeholderTextColor={T.textMuted}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>Capacity *</Text>
            <TextInput
              style={[styles.input, { color: T.text, borderColor: T.border }]}
              value={formData.capacity}
              onChangeText={update("capacity")}
              keyboardType="numeric"
              placeholder="4"
              placeholderTextColor={T.textMuted}
            />
          </View>

          {/* Optional dates – you can add date pickers here similar to SetProfileScreen */}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: T.accent }]}
            onPress={handleSubmit}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Update Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  imageTile: {
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: "100%" },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  genderRow: { flexDirection: "row", gap: 10 },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  genderText: { fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row" },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
