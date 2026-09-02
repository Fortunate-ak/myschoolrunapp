// screens/guardian/AddStudentScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { addStudentToGuardian } from "../lib/UserSlice";
import { forwardGeocode } from "../utils/mapbox";

const GENDERS = ["male", "female"];
const RELATIONSHIPS = ["parent", "guardian", "relative"];

// ── AddressField Component ──────────────────────────────────────────────────

const AddressField = ({
  label,
  placeholder,
  value,
  onChange,
  required,
  icon = "location-outline",
}) => {
  const [query, setQuery] = useState(value?.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  // Sync query when external value changes (e.g., prefilled from parent)
  useEffect(() => {
    setQuery(value?.address || "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChangeText = (text) => {
    setQuery(text);
    setShowDropdown(true);

    if (value) onChange(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await forwardGeocode(text);
        setSuggestions(results);
      } catch (error) {
        console.error("Geocode error:", error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelect = (result) => {
    setQuery(result.address);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
    onChange({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    });
  };

  return (
    <View style={[styles.fieldWrap, styles.addressFieldWrap]}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.inputWrapper}>
        <Ionicons
          name={icon}
          size={16}
          color="rgba(255,255,255,0.3)"
          style={styles.fieldIcon}
        />
        <TextInput
          style={[styles.input, { paddingLeft: 36, paddingRight: 32 }]}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        <View style={styles.validationIcon} pointerEvents="none">
          {isSearching ? (
            <ActivityIndicator size="small" color="#e83030" />
          ) : value ? (
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          ) : null}
        </View>
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionRow}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="location-outline"
                size={14}
                color="rgba(255,255,255,0.4)"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.suggestionAddress} numberOfLines={1}>
                  {s.address}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showDropdown &&
        !isSearching &&
        !value &&
        query.trim().length >= 3 &&
        suggestions.length === 0 && (
          <Text style={styles.addressHint}>
            No matches — try a more specific address
          </Text>
        )}
    </View>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function AddStudentScreen({ navigation }) {
  const dispatch = useDispatch();
  const { guardianProfile } = useSelector((state) => state.users);
  const existingStudents = guardianProfile?.students || [];
  const referenceStudent = existingStudents[0] || null;

  const [studentName, setStudentName] = useState("");
  const [studentGender, setStudentGender] = useState(null);
  const [relationshipToStudent, setRelationshipToStudent] =
    useState("guardian");
  const [homeAddress, setHomeAddress] = useState(null);
  const [schoolAddress, setSchoolAddress] = useState(null);
  const [loading, setLoading] = useState(false);

  // Prefill from an existing sibling once, but leave both fully editable
  useEffect(() => {
    if (referenceStudent) {
      if (referenceStudent.homeAddress?.address) {
        setHomeAddress({
          address: referenceStudent.homeAddress.address,
          latitude: referenceStudent.homeAddress.latitude || null,
          longitude: referenceStudent.homeAddress.longitude || null,
        });
      }
      if (referenceStudent.schoolAddress?.address) {
        setSchoolAddress({
          address: referenceStudent.schoolAddress.address,
          latitude: referenceStudent.schoolAddress.latitude || null,
          longitude: referenceStudent.schoolAddress.longitude || null,
        });
      }
    }
  }, [referenceStudent?.id]);

  const validate = () => {
    if (!studentName.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter the student's name",
      });
      return false;
    }
    if (!studentGender) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please select the student's gender",
      });
      return false;
    }
    if (!homeAddress || !homeAddress.address) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please select a valid home address from the suggestions",
      });
      return false;
    }
    return true;
  };

  const handleAddStudent = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        studentName: studentName.trim(),
        studentGender,
        relationshipToStudent,
        homeAddress,
        schoolAddress: schoolAddress || null,
      };

      await dispatch(addStudentToGuardian(payload)).unwrap();

      Toast.show({
        type: "success",
        text1: "Student Added!",
        text2: `${studentName} has been added to your account`,
      });

      navigation.navigate("StudentsList");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't Add Student",
        text2: typeof error === "string" ? error : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add a Student</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Student Name</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={studentName}
              onChangeText={setStudentName}
            />
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.pill,
                  studentGender === g && styles.pillSelected,
                ]}
                onPress={() => setStudentGender(g)}
              >
                <Text
                  style={[
                    styles.pillText,
                    studentGender === g && styles.pillTextSelected,
                  ]}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Your Relationship</Text>
          <View style={styles.pillRow}>
            {RELATIONSHIPS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.pill,
                  relationshipToStudent === r && styles.pillSelected,
                ]}
                onPress={() => setRelationshipToStudent(r)}
              >
                <Text
                  style={[
                    styles.pillText,
                    relationshipToStudent === r && styles.pillTextSelected,
                  ]}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Home Address */}
          <AddressField
            label="Home Address"
            placeholder="Start typing your pickup address..."
            value={homeAddress}
            onChange={setHomeAddress}
            icon="home-outline"
            required
          />
          {referenceStudent && homeAddress?.address && (
            <Text style={styles.prefillNote}>
              Prefilled from {referenceStudent.fullname} — edit if this student
              lives elsewhere.
            </Text>
          )}

          {/* School Address */}
          <AddressField
            label="School Address"
            placeholder="Start typing the drop-off address..."
            value={schoolAddress}
            onChange={setSchoolAddress}
            icon="school-outline"
          />
          {referenceStudent && schoolAddress?.address && (
            <Text style={styles.prefillNote}>
              Prefilled from {referenceStudent.fullname} — edit if this student
              attends a different school.
            </Text>
          )}

          {referenceStudent && (
            <View style={styles.noteBox}>
              <Ionicons name="information-circle" size={16} color="#e83030" />
              <Text style={styles.noteText}>
                Addresses default to {referenceStudent.fullname}'s on file, but
                feel free to change them — useful if this student goes to a
                different school or lives at another address.
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleAddStudent}
            activeOpacity={0.85}
            style={styles.submitBtn}
            disabled={loading}
          >
            <LinearGradient
              colors={["#e83030", "#c01818"]}
              style={styles.submitBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Add Student</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  content: { paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#ffffff" },

  formSection: { paddingHorizontal: 24 },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
    marginTop: 4,
  },
  required: { color: "#e83030" },

  inputWrapper: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: "center",
  },
  input: { color: "#ffffff", fontSize: 14, flex: 1 },

  fieldWrap: { marginBottom: 16 },
  addressFieldWrap: { zIndex: 20 },
  fieldIcon: { position: "absolute", left: 13, top: 17 },
  validationIcon: { position: "absolute", right: 14 },
  addressHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginTop: 5,
    marginLeft: 2,
  },
  suggestionsBox: {
    marginTop: 6,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  suggestionName: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  suggestionAddress: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 1,
  },

  prefillNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: -10,
    marginBottom: 16,
    fontStyle: "italic",
  },

  pillRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#1a1a1a",
  },
  pillSelected: { backgroundColor: "#e83030", borderColor: "#e83030" },
  pillText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  pillTextSelected: { color: "#fff" },

  noteBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(232,48,48,0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(232,48,48,0.15)",
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 17,
  },

  submitBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  submitBtnGradient: { paddingVertical: 16, alignItems: "center" },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
});
