import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n) {
  return n.toString().padStart(2, "0");
}

export default function TimePickerField({
  label,
  value,
  onChange,
  icon = "time-outline",
}) {
  const [visible, setVisible] = useState(false);
  const [h, m] = value ? value.split(":").map(Number) : [7, 0];
  const [tempH, setTempH] = useState(h);
  const [tempM, setTempM] = useState(m);

  const open = () => {
    setTempH(h);
    setTempM(m);
    setVisible(true);
  };

  const confirm = () => {
    onChange(`${pad(tempH)}:${pad(tempM)}`);
    setVisible(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={open} activeOpacity={0.8}>
        <Ionicons name={icon} size={16} color="rgba(255,255,255,0.35)" />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value || "Select time"}
        </Text>
        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>

            <View style={styles.pickerRow}>
              {/* Hours */}
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Hour</Text>
                <View style={styles.scrollBox}>
                  {HOURS.map((hr) => (
                    <TouchableOpacity
                      key={hr}
                      style={[
                        styles.option,
                        tempH === hr && styles.optionActive,
                      ]}
                      onPress={() => setTempH(hr)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tempH === hr && styles.optionTextActive,
                        ]}
                      >
                        {pad(hr)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.colon}>:</Text>

              {/* Minutes */}
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Min</Text>
                <View style={styles.scrollBox}>
                  {MINUTES.map((min) => (
                    <TouchableOpacity
                      key={min}
                      style={[
                        styles.option,
                        tempM === min && styles.optionActive,
                      ]}
                      onPress={() => setTempM(min)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tempM === min && styles.optionTextActive,
                        ]}
                      >
                        {pad(min)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirm} style={{ flex: 1 }}>
                <LinearGradient
                  colors={["#e83030", "#c01818"]}
                  style={styles.confirmBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmText}>Set Time</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 7,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    height: 50,
    paddingHorizontal: 14,
  },
  fieldText: { flex: 1, color: "#fff", fontSize: 14 },
  fieldPlaceholder: { color: "rgba(255,255,255,0.25)" },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    backgroundColor: "#161616",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
    textAlign: "center",
  },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 18,
  },
  column: { alignItems: "center" },
  columnLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 6,
  },
  scrollBox: {
    height: 160,
    width: 70,
    backgroundColor: "#0d0d0d",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  option: {
    paddingVertical: 10,
    alignItems: "center",
  },
  optionActive: { backgroundColor: "rgba(232,48,48,0.15)" },
  optionText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "600",
  },
  optionTextActive: { color: "#e83030" },
  colon: { fontSize: 20, color: "#fff", fontWeight: "700", marginTop: 18 },

  actionsRow: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtn: {
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
