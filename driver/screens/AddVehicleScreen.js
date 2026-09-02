// screens/AddVehicleScreen.js
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
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import Toast from "react-native-toast-message";
import { createVehicle } from "../lib/VehicleSlice";
import { useTheme } from "../contexts/ThemeContext";
import { getRegistrationFormatStatus } from "../utils/helpers";

// ── Reusable Field Component ──
const Field = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  required,
  icon,
  validation,
  validationMessage,
  maxLength,
  theme,
}) => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.label, { color: theme.textSecondary }]}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    <View
      style={[
        styles.inputWrapper,
        { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
        validation === false && styles.inputError,
        validation === true && styles.inputSuccess,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={theme.textMuted}
          style={styles.fieldIcon}
        />
      )}
      <TextInput
        style={[
          styles.input,
          { color: theme.text },
          icon && { paddingLeft: 36 },
          validation !== undefined &&
            validation !== null && { paddingRight: 32 },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="characters"
        maxLength={maxLength}
      />
      {validation !== undefined && validation !== null && (
        <View style={styles.validationIcon} pointerEvents="none">
          <Ionicons
            name={validation ? "checkmark-circle" : "alert-circle"}
            size={20}
            color={validation ? "#4CAF50" : "#e83030"}
          />
        </View>
      )}
    </View>
    {validationMessage && (
      <Text
        style={[
          styles.validationMessage,
          validation ? styles.validationSuccess : styles.validationError,
        ]}
      >
        {validationMessage}
      </Text>
    )}
  </View>
);

// ── Reusable DateField Component with updated DateTimePicker API ──
const DateField = ({
  label,
  value,
  onChangeText,
  required,
  theme,
  icon = "calendar-outline",
  maximumDate,
  minimumDate,
}) => {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(value) : new Date();

  const formatDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (event.type === "set" && selectedDate) {
        onChangeText(formatDate(selectedDate));
      }
      return;
    }
    // iOS: keep the spinner open, just track the picked value
    if (selectedDate) {
      onChangeText(formatDate(selectedDate));
    }
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[
          styles.inputWrapper,
          { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
        ]}
        activeOpacity={0.75}
        onPress={() => setShow(true)}
      >
        <Ionicons
          name={icon}
          size={16}
          color={theme.textMuted}
          style={styles.fieldIcon}
        />
        <Text
          style={[
            styles.input,
            { color: theme.text, paddingLeft: 36 },
            !value && { color: theme.placeholder },
          ]}
        >
          {value || "YYYY-MM-DD"}
        </Text>
      </TouchableOpacity>

      {show && (
        <>
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            themeVariant="dark"
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.dateDoneBtn}
              onPress={() => setShow(false)}
            >
              <Text style={styles.dateDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

export default function AddVehicleScreen() {
  const { theme: T } = useTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.vehicles);

  const [formData, setFormData] = useState({
    carMake: "",
    carModel: "",
    registrationNumber: "",
    capacity: "",
    lastServiceDate: "",
    nextServiceDate: "",
    insuranceExpiry: "",
  });
  const [vehicleImage, setVehicleImage] = useState(null);
  const [vehicleImageUri, setVehicleImageUri] = useState(null);
  const [registrationNumberValidation, setRegistrationNumberValidation] =
    useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "registrationNumber") {
      const validation = getRegistrationFormatStatus(value);
      setRegistrationNumberValidation(validation);
    }
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
      setVehicleImageUri(uri);
      // Convert to File object for upload
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      const file = {
        uri: Platform.OS === "ios" ? uri.replace("file://", "") : uri,
        name: filename,
        type,
      };
      setVehicleImage(file);
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

    const registrationValidation = getRegistrationFormatStatus(
      formData.registrationNumber,
    );
    if (!registrationValidation || !registrationValidation.valid) {
      Toast.show({
        type: "error",
        text1: "Invalid Registration Number",
        text2:
          registrationValidation?.message ||
          "Please enter a valid registration number",
      });
      return false;
    }

    if (!formData.capacity || parseInt(formData.capacity) <= 0) {
      Toast.show({ type: "error", text1: "Valid capacity required" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      ...formData,
      capacity: parseInt(formData.capacity),
    };

    // Add image if selected
    if (vehicleImage) {
      payload.image = vehicleImage;
    }

    const result = await dispatch(createVehicle(payload));

    if (createVehicle.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Vehicle Added!",
        text2: "Your vehicle has been registered successfully.",
      });
      navigation.goBack();
    } else {
      Toast.show({
        type: "error",
        text1: "Failed to add vehicle",
        text2: result.payload || "Please try again",
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Add Vehicle</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Image Upload - Original Style */}
          <TouchableOpacity
            style={[
              styles.imageUpload,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {vehicleImageUri ? (
              <Image
                source={{ uri: vehicleImageUri }}
                style={styles.vehicleImage}
              />
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

          {/* Car Make */}
          <Field
            label="Car Make"
            placeholder="e.g. Toyota"
            value={formData.carMake}
            onChangeText={(v) => handleInputChange("carMake", v)}
            icon="car-outline"
            required
            theme={T}
          />

          {/* Car Model */}
          <Field
            label="Car Model"
            placeholder="e.g. Hiace"
            value={formData.carModel}
            onChangeText={(v) => handleInputChange("carModel", v)}
            icon="car-sport-outline"
            required
            theme={T}
          />

          {/* Registration Number */}
          <Field
            label="Registration Number"
            placeholder="e.g. ABC 1234"
            value={formData.registrationNumber}
            onChangeText={(v) => handleInputChange("registrationNumber", v)}
            icon="barcode-outline"
            required
            maxLength={7}
            validation={
              registrationNumberValidation
                ? registrationNumberValidation.valid
                : undefined
            }
            validationMessage={
              registrationNumberValidation
                ? registrationNumberValidation.message
                : ""
            }
            theme={T}
          />

          {/* Capacity */}
          <Field
            label="Capacity (seats)"
            placeholder="e.g. 16"
            value={formData.capacity}
            onChangeText={(v) => handleInputChange("capacity", v)}
            icon="people-outline"
            keyboardType="numeric"
            required
            theme={T}
          />

          {/* Last Service Date */}
          <DateField
            label="Last Service Date"
            value={formData.lastServiceDate}
            onChangeText={(v) => handleInputChange("lastServiceDate", v)}
            icon="calendar-outline"
            theme={T}
            maximumDate={new Date()}
          />

          {/* Next Service Date */}
          <DateField
            label="Next Service Date"
            value={formData.nextServiceDate}
            onChangeText={(v) => handleInputChange("nextServiceDate", v)}
            icon="calendar-clear-outline"
            theme={T}
            minimumDate={new Date()}
          />

          {/* Insurance Expiry */}
          <DateField
            label="Insurance Expiry"
            value={formData.insuranceExpiry}
            onChangeText={(v) => handleInputChange("insuranceExpiry", v)}
            icon="shield-outline"
            theme={T}
            minimumDate={new Date()}
          />

          {/* Submit Button */}
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
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Add Vehicle</Text>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // ── Original Image Upload Styles ──
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

  // ── Field styles ──
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  required: { color: "#e83030" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 12,
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    paddingLeft: 4,
  },
  inputError: { borderColor: "#e83030" },
  inputSuccess: { borderColor: "#4CAF50" },
  validationIcon: {
    position: "absolute",
    right: 14,
  },
  validationMessage: {
    fontSize: 11,
    marginTop: 5,
    marginLeft: 2,
  },
  validationError: { color: "#e83030" },
  validationSuccess: { color: "#4CAF50" },

  // ── Date picker ──
  dateDoneBtn: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e83030",
  },
  dateDoneText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // ── Submit Button ──
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
