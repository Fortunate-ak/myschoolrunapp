import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { clearGuardianError, setGuardianProfile } from "../lib/UserSlice";
import Toast from "react-native-toast-message";
import { forwardGeocode } from "../utils/mapbox";
import { useTheme } from "../contexts/ThemeContext";

const SectionHeader = ({ icon, title, subtitle }) => {
  const { theme: T } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIconWrap,
          {
            backgroundColor: T.accentDim,
            borderColor: T.accentBorder,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={T.accent} />
      </View>
      <View>
        <Text style={[styles.sectionTitle, { color: T.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.sectionSubtitle, { color: T.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
};

const Field = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  required,
  icon,
  multiline,
}) => {
  const { theme: T } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: T.textSecondary }]}>
        {label}
        {required && (
          <Text style={[styles.required, { color: T.accent }]}> *</Text>
        )}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: T.inputBg,
            borderColor: T.inputBorder,
          },
          multiline && styles.inputWrapperMultiline,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={T.textMuted}
            style={styles.fieldIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            { color: T.text },
            icon && { paddingLeft: 36 },
            multiline && {
              height: "100%",
              textAlignVertical: "top",
              paddingTop: 12,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={T.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
        />
      </View>
    </View>
  );
};

const AddressField = ({
  label,
  placeholder,
  value,
  onChange,
  required,
  icon = "location-outline",
}) => {
  const { theme: T } = useTheme();
  const [query, setQuery] = useState(value?.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

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
      <Text style={[styles.label, { color: T.textSecondary }]}>
        {label}
        {required && (
          <Text style={[styles.required, { color: T.accent }]}> *</Text>
        )}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: T.inputBg,
            borderColor: T.inputBorder,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={T.textMuted}
          style={styles.fieldIcon}
        />
        <TextInput
          style={[
            styles.input,
            { color: T.text, paddingLeft: 36, paddingRight: 32 },
          ]}
          placeholder={placeholder}
          placeholderTextColor={T.placeholder}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        <View style={styles.validationIcon} pointerEvents="none">
          {isSearching ? (
            <ActivityIndicator size="small" color={T.accent} />
          ) : value ? (
            <Ionicons name="checkmark-circle" size={20} color={T.success} />
          ) : null}
        </View>
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsBox,
            {
              backgroundColor: T.surface,
              borderColor: T.border,
            },
          ]}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.suggestionRow, { borderBottomColor: T.border }]}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={14} color={T.textMuted} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.suggestionName, { color: T.text }]}
                  numberOfLines={1}
                >
                  {s.name}
                </Text>
                <Text
                  style={[styles.suggestionAddress, { color: T.textMuted }]}
                  numberOfLines={1}
                >
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
          <Text style={[styles.addressHint, { color: T.textMuted }]}>
            No matches — try a more specific address
          </Text>
        )}
    </View>
  );
};

const GenderSelector = ({ label = "Gender", value, onChange }) => {
  const { theme: T } = useTheme();
  const options = ["male", "female", "other"];
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: T.textSecondary }]}>
        {label}
        <Text style={[styles.required, { color: T.accent }]}> *</Text>
      </Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionPill,
              {
                backgroundColor: T.inputBg,
                borderColor: T.inputBorder,
              },
              value === opt && {
                backgroundColor: T.accentDim,
                borderColor: T.accent,
              },
            ]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={
                opt === "male" ? "male" : opt === "female" ? "female" : "person"
              }
              size={14}
              color={value === opt ? T.text : T.textMuted}
            />
            <Text
              style={[
                styles.optionText,
                { color: value === opt ? T.text : T.textMuted },
              ]}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const RelationshipSelector = ({ value, onChange }) => {
  const { theme: T } = useTheme();
  const options = [
    "father",
    "mother",
    "guardian",
    "aunt",
    "uncle",
    "sister",
    "brother",
    "grandfather",
    "grandmother",
  ];

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: T.textSecondary }]}>
        Relationship to Student
        <Text style={[styles.required, { color: T.accent }]}> *</Text>
      </Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionPill,
              {
                backgroundColor: T.inputBg,
                borderColor: T.inputBorder,
              },
              value === opt && {
                backgroundColor: T.accentDim,
                borderColor: T.accent,
              },
            ]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.optionText,
                { color: value === opt ? T.text : T.textMuted },
              ]}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const StudentForm = ({ student, index, onChange, onRemove }) => {
  const { theme: T } = useTheme();
  return (
    <View
      style={[
        styles.studentCard,
        {
          backgroundColor: T.surface,
          borderColor: T.border,
        },
      ]}
    >
      <View style={styles.studentCardHeader}>
        <Text style={[styles.studentCardTitle, { color: T.textSecondary }]}>
          Student {index + 1}
        </Text>
        {index > 0 && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Ionicons name="close-circle" size={22} color={T.accent} />
          </TouchableOpacity>
        )}
      </View>

      <Field
        label="Student Name"
        placeholder="Enter student's full name"
        value={student.studentName}
        onChangeText={(value) => onChange(index, "studentName", value)}
        icon="person-outline"
        required
      />

      <GenderSelector
        label="Student Gender"
        value={student.studentGender}
        onChange={(value) => onChange(index, "studentGender", value)}
      />

      <RelationshipSelector
        value={student.relationshipToStudent}
        onChange={(value) => onChange(index, "relationshipToStudent", value)}
      />

      <AddressField
        label="Home Address"
        placeholder="Start typing your pickup address..."
        value={student.homeAddress}
        onChange={(value) => onChange(index, "homeAddress", value)}
        icon="home-outline"
        required
      />

      <AddressField
        label="School Address"
        placeholder="Start typing the drop-off address..."
        value={student.schoolAddress}
        onChange={(value) => onChange(index, "schoolAddress", value)}
        icon="school-outline"
      />
    </View>
  );
};

export default function SetProfileScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.users);

  const [formData, setFormData] = useState({
    guardianGender: "",
    guardianAddress: "",
    students: [
      {
        studentName: "",
        studentGender: "",
        relationshipToStudent: "",
        homeAddress: null,
        schoolAddress: null,
      },
    ],
  });

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateGuardian = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateStudent = (index, field, value) => {
    setFormData((prev) => {
      const updatedStudents = [...prev.students];
      updatedStudents[index] = { ...updatedStudents[index], [field]: value };
      return { ...prev, students: updatedStudents };
    });
  };

  const addStudent = () => {
    setFormData((prev) => ({
      ...prev,
      students: [
        ...prev.students,
        {
          studentName: "",
          studentGender: "",
          relationshipToStudent: "",
          homeAddress: null,
          schoolAddress: null,
        },
      ],
    }));
  };

  const removeStudent = (index) => {
    if (formData.students.length <= 1) {
      Toast.show({
        type: "error",
        text1: "Cannot Remove",
        text2: "You need at least one student",
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      students: prev.students.filter((_, i) => i !== index),
    }));
  };

  const validateStep1 = () => {
    if (!formData.guardianGender) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please select your gender to continue",
      });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < formData.students.length; i++) {
      const s = formData.students[i];
      if (!s.studentName || !s.studentGender) {
        Toast.show({
          type: "error",
          text1: `Student ${i + 1} Missing Fields`,
          text2: "Student name and gender are required",
        });
        return false;
      }
      if (!s.homeAddress) {
        Toast.show({
          type: "error",
          text1: `Student ${i + 1} Home Address Required`,
          text2: "Please select an address from the suggestions",
        });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setIsSubmitting(true);

    try {
      for (const student of formData.students) {
        const profileData = {
          studentName: student.studentName,
          studentGender: student.studentGender,
          relationshipToStudent: student.relationshipToStudent || "guardian",
          guardianGender: formData.guardianGender,
          guardianAddress: formData.guardianAddress || null,
          homeAddress: student.homeAddress,
          schoolAddress: student.schoolAddress || null,
        };

        await dispatch(setGuardianProfile(profileData)).unwrap();
      }

      Toast.show({
        type: "success",
        text1: "Profile Created!",
        text2: `${formData.students.length} student(s) added. Now let's find a driver.`,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: "GuardianFindDriver" }],
      });
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Profile Creation Failed",
        text2: typeof error === "string" ? error : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      dispatch(clearGuardianError());
    };
  }, []);

  const StepBar = () => (
    <View style={styles.stepBar}>
      {[1, 2].map((s) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepDot,
              {
                backgroundColor: T.surface,
                borderColor: T.border,
              },
              step >= s && {
                borderColor: T.accent,
                backgroundColor: T.accentDim,
              },
              step > s && { backgroundColor: T.accent, borderColor: T.accent },
            ]}
          >
            {step > s ? (
              <Ionicons name="checkmark" size={12} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.stepNum,
                  { color: step >= s ? T.accent : T.textMuted },
                ]}
              >
                {s}
              </Text>
            )}
          </View>
          {s < 2 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: T.border },
                step > s && { backgroundColor: T.accent },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View style={styles.header}>
        {step === 2 ? (
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: T.surface,
                borderColor: T.border,
              },
            ]}
            onPress={() => setStep(1)}
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Complete Profile
          </Text>
          <Text style={[styles.headerSub, { color: T.textMuted }]}>
            {step === 1 ? "Your Details" : "Student Details"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <StepBar />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {step === 1 && (
            <>
              <SectionHeader
                icon="person-outline"
                title="Guardian Information"
                subtitle="Tell us a bit about yourself"
              />

              <GenderSelector
                value={formData.guardianGender}
                onChange={(value) => updateGuardian("guardianGender", value)}
              />

              <Field
                label="Home Address"
                placeholder="Enter your address"
                value={formData.guardianAddress}
                onChangeText={(value) =>
                  updateGuardian("guardianAddress", value)
                }
                icon="home-outline"
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[T.accent, "#c01818"]}
                  style={styles.primaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryBtnText}>Next — Student Info</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <SectionHeader
                icon="school-outline"
                title="Student Information"
                subtitle={`${formData.students.length} student(s) added`}
              />

              {formData.students.map((student, index) => (
                <StudentForm
                  key={index}
                  student={student}
                  index={index}
                  onChange={updateStudent}
                  onRemove={() => removeStudent(index)}
                />
              ))}

              <TouchableOpacity
                style={[
                  styles.addStudentBtn,
                  {
                    borderColor: T.accentBorder,
                  },
                ]}
                onPress={addStudent}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={T.accent}
                />
                <Text style={[styles.addStudentText, { color: T.accent }]}>
                  Add Another Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={isSubmitting || isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[T.accent, "#c01818"]}
                  style={styles.primaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryBtnText}>
                    {isSubmitting ? "Submitting..." : "Submit Profile"}
                  </Text>
                  {!isSubmitting && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 0,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontSize: 12, fontWeight: "700" },
  stepLine: {
    width: 60,
    height: 2,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    marginTop: 8,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },

  studentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  studentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  studentCardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  removeBtn: { padding: 4 },

  fieldWrap: { marginBottom: 16 },
  addressFieldWrap: { zIndex: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },
  required: {},
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 14,
  },
  inputWrapperMultiline: { height: 90, alignItems: "flex-start" },
  fieldIcon: { position: "absolute", left: 13, top: 17 },
  validationIcon: { position: "absolute", right: 14 },
  addressHint: {
    fontSize: 11,
    marginTop: 5,
    marginLeft: 2,
  },
  suggestionsBox: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  suggestionName: { fontSize: 13, fontWeight: "600" },
  suggestionAddress: { fontSize: 11, marginTop: 1 },
  input: {
    fontSize: 14,
    flex: 1,
    height: "100%",
    paddingLeft: 4,
  },

  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexGrow: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
  },

  addStudentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
    marginBottom: 16,
  },
  addStudentText: {
    fontSize: 14,
    fontWeight: "600",
  },

  primaryBtn: {
    borderRadius: 50,
    overflow: "hidden",
    marginTop: 24,
    marginBottom: 8,
    elevation: 8,
    shadowColor: "#e03030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});
