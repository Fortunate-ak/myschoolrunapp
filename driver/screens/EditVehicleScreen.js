import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { useDispatch } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { updateVehicle } from "../lib/VehicleSlice";
import { useTheme } from "../contexts/ThemeContext";

export default function EditVehicleScreen() {
  const { theme: T } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { vehicle } = route.params || {};
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    carMake: vehicle?.carMake || "",
    carModel: vehicle?.carModel || "",
    registrationNumber: vehicle?.registrationNumber || "",
    capacity: vehicle?.capacity?.toString() || "",
    lastServiceDate: vehicle?.lastServiceDate || "",
    nextServiceDate: vehicle?.nextServiceDate || "",
    insuranceExpiry: vehicle?.insuranceExpiry || "",
  });
  const [image, setImage] = useState(null);
  const [imageUri, setImageUri] = useState(vehicle?.image || null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Toast.show({
        type: "error",
        text1: "Permission denied",
        text2: "We need camera roll permission to upload vehicle images",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      const file = {
        uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
        name: filename,
        type,
      };
      setImage(file);
    }
  };

  const validate = () => {
    if (!formData.carMake.trim()) {
      Toast.show({ type: "error", text1: "Car make required" });
      return false;
    }
    if (!formData.carModel.trim()) {
      Toast.show({ type: "error", text1: "Car model required" });
      return false;
    }
    if (!formData.registrationNumber.trim()) {
      Toast.show({ type: "error", text1: "Registration number required" });
      return false;
    }
    if (!formData.capacity || parseInt(formData.capacity) <= 0) {
      Toast.show({ type: "error", text1: "Valid capacity required" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !vehicle) return;

    setIsLoading(true);
    const payload = {
      ...formData,
      capacity: parseInt(formData.capacity),
    };

    if (image) {
      payload.image = image;
    }

    const result = await dispatch(
      updateVehicle({ id: vehicle.id, ...payload }),
    );
    setIsLoading(false);

    if (updateVehicle.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Vehicle Updated!",
        text2: "Your vehicle has been updated successfully.",
      });
      navigation.goBack();
    } else {
      Toast.show({
        type: "error",
        text1: "Failed to update vehicle",
        text2: result.payload || "Please try again",
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Edit Vehicle
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[
              styles.imageUpload,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.vehicleImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={40} color={T.textMuted} />
                <Text
                  style={[styles.imagePlaceholderText, { color: T.textMuted }]}
                >
                  Tap to upload vehicle photo
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form fields - same as AddVehicleScreen */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Car Make *
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="car-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="e.g. Toyota"
                placeholderTextColor={T.placeholder}
                value={formData.carMake}
                onChangeText={(v) => handleInputChange("carMake", v)}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Car Model *
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="car-sport-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="e.g. Hiace"
                placeholderTextColor={T.placeholder}
                value={formData.carModel}
                onChangeText={(v) => handleInputChange("carModel", v)}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Registration Number *
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="e.g. ABC 1234"
                placeholderTextColor={T.placeholder}
                value={formData.registrationNumber}
                onChangeText={(v) => handleInputChange("registrationNumber", v)}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Capacity (seats) *
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="e.g. 16"
                placeholderTextColor={T.placeholder}
                value={formData.capacity}
                onChangeText={(v) => handleInputChange("capacity", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Last Service Date
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.placeholder}
                value={formData.lastServiceDate}
                onChangeText={(v) => handleInputChange("lastServiceDate", v)}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Next Service Date
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.placeholder}
                value={formData.nextServiceDate}
                onChangeText={(v) => handleInputChange("nextServiceDate", v)}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: T.textSecondary }]}>
              Insurance Expiry
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: T.inputBg, borderColor: T.inputBorder },
              ]}
            >
              <Ionicons
                name="shield-outline"
                size={18}
                color={T.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={T.placeholder}
                value={formData.insuranceExpiry}
                onChangeText={(v) => handleInputChange("insuranceExpiry", v)}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.submitBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                </>
              )}
            </LinearGradient>
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
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  imageUpload: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    height: 180,
    overflow: "hidden",
    marginBottom: 24,
  },
  vehicleImage: { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imagePlaceholderText: { fontSize: 13 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14 },
  submitBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 12,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
