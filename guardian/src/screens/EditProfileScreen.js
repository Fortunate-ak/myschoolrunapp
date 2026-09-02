// screens/guardian/EditProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { forwardGeocode } from "../utils/mapbox";
import { updateGuardianProfile } from "../lib/UserSlice"; // we'll need to add this thunk

// AddressField component (copied from SetProfileScreen)
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
  const debounceRef = React.useRef(null);

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
    onChange({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    });
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: T.text }]}>
        {label}
        {required && <Text style={{ color: T.accent }}> *</Text>}
      </Text>
      <View style={[styles.inputWrapper, { borderColor: T.border }]}>
        <Ionicons
          name={icon}
          size={16}
          color={T.textMuted}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={[styles.input, { color: T.text }]}
          placeholder={placeholder}
          placeholderTextColor={T.textMuted}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        {isSearching && <ActivityIndicator size="small" color={T.accent} />}
        {value && (
          <Ionicons name="checkmark-circle" size={20} color={T.success} />
        )}
      </View>
      {showDropdown && suggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsBox,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionRow}
              onPress={() => handleSelect(s)}
            >
              <Ionicons name="location-outline" size={14} color={T.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.suggestionName, { color: T.text }]}>
                  {s.name}
                </Text>
                <Text
                  style={[styles.suggestionAddress, { color: T.textMuted }]}
                >
                  {s.address}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function EditProfileScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { guardianProfile, isLoading } = useSelector((state) => state.users);

  const [fullname, setFullname] = useState(user?.fullname || "");
  const [gender, setGender] = useState(guardianProfile?.gender || "");
  const [address, setAddress] = useState(guardianProfile?.address || null);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!fullname.trim()) {
      Toast.show({ type: "error", text1: "Full name is required" });
      return;
    }
    setLoading(true);
    try {
      await dispatch(
        updateGuardianProfile({ fullname, gender, address }),
      ).unwrap();
      Toast.show({ type: "success", text1: "Profile updated" });
      navigation.goBack();
    } catch (error) {
      Toast.show({ type: "error", text1: error || "Failed to update profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: T.border, paddingTop: insets.top + 10 },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Edit Profile
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>
              Full Name <Text style={{ color: T.accent }}>*</Text>
            </Text>
            <View style={[styles.inputWrapper, { borderColor: T.border }]}>
              <TextInput
                style={[styles.input, { color: T.text }]}
                placeholder="Your full name"
                placeholderTextColor={T.textMuted}
                value={fullname}
                onChangeText={setFullname}
              />
            </View>
          </View>
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                { borderColor: T.border, opacity: 0.6 },
              ]}
            >
              <TextInput
                style={[styles.input, { color: T.textMuted }]}
                value={user?.email}
                editable={false}
              />
            </View>
          </View>
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: T.text }]}>Gender</Text>
            <View style={styles.genderRow}>
              {["male", "female", "other"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderPill,
                    { borderColor: T.border },
                    gender === g && {
                      backgroundColor: T.accent,
                      borderColor: T.accent,
                    },
                  ]}
                  onPress={() => setGender(g)}
                >
                  <Text
                    style={[
                      styles.genderText,
                      { color: gender === g ? "#fff" : T.textMuted },
                    ]}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <AddressField
            label="Address"
            placeholder="Start typing your address..."
            value={address}
            onChange={setAddress}
            icon="home-outline"
          />
          <TouchableOpacity
            style={[styles.updateBtn, { backgroundColor: T.accent }]}
            onPress={handleUpdate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 7 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 14 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  genderText: { fontSize: 13, fontWeight: "600" },
  updateBtn: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  updateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  suggestionName: { fontSize: 13, fontWeight: "600" },
  suggestionAddress: { fontSize: 11 },
});
