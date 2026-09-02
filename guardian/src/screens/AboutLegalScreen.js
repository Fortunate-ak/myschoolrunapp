// screens/guardian/AboutLegalScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AboutLegalScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", body: "" });

  const appVersion = "1.0.0";
  const companyName = "Transport Solutions Inc.";
  const year = new Date().getFullYear();

  const privacyPolicy = `
Privacy Policy

Last updated: ${new Date().toLocaleDateString()}

Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.

1. Information We Collect
- Account information (name, email, phone)
- Location data for tracking
- Vehicle and route details
- Payment information

2. How We Use Your Information
- To provide and improve our services
- To communicate with you
- For safety and security
- To comply with legal obligations

3. Data Security
We implement appropriate technical and organizational measures to protect your data.

4. Your Rights
You have the right to access, correct, or delete your personal data.

5. Contact
For privacy concerns, contact us at privacy@transportsolutions.com
`;

  const termsOfService = `
Terms of Service

Last updated: ${new Date().toLocaleDateString()}

1. Acceptance of Terms
By using this app, you agree to these terms.

2. Service Description
We provide transport management and tracking services for guardians and drivers.

3. User Responsibilities
- Provide accurate information
- Use the service lawfully
- Respect other users' privacy

4. Payments and Subscriptions
- Subscription fees are billed in advance
- Refunds are handled per our refund policy

5. Termination
We reserve the right to terminate accounts for violations.

6. Limitation of Liability
The service is provided "as is" without warranties.

7. Governing Law
These terms are governed by the laws of your jurisdiction.

8. Changes to Terms
We may update these terms; continued use constitutes acceptance.

Contact: legal@transportsolutions.com
`;

  const openLink = (url) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open link"),
    );
  };

  const showModal = (title, body) => {
    setModalContent({ title, body });
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: T.border,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          About & Legal
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* App Info */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <View style={styles.appInfo}>
            <View style={[styles.appIcon, { backgroundColor: T.accentDim }]}>
              <Ionicons name="bus" size={32} color={T.accent} />
            </View>
            <Text style={[styles.appName, { color: T.text }]}>
              Transport Tracker
            </Text>
            <Text style={[styles.appVersion, { color: T.textMuted }]}>
              Version {appVersion}
            </Text>
            <Text style={[styles.appCompany, { color: T.textMuted }]}>
              {companyName}
            </Text>
            <Text style={[styles.appYear, { color: T.textMuted }]}>
              © {year} All rights reserved
            </Text>
          </View>
        </View>

        {/* Legal Documents */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Legal Documents
          </Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => showModal("Privacy Policy", privacyPolicy)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Privacy Policy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => showModal("Terms of Service", termsOfService)}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={T.textMuted}
              />
              <Text style={[styles.rowText, { color: T.text }]}>
                Terms of Service
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Contact & Support */}
        <View
          style={[
            styles.section,
            { backgroundColor: T.surface, borderColor: T.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: T.text }]}>
            Contact & Support
          </Text>

          <TouchableOpacity
            style={styles.row}
            onPress={() => openLink("mailto:support@transportsolutions.com")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="mail-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Email Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => openLink("tel:+1234567890")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="call-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Call Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => openLink("https://transportsolutions.com")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="globe-outline" size={20} color={T.textMuted} />
              <Text style={[styles.rowText, { color: T.text }]}>
                Visit Website
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: T.textMuted }]}>
            Made with ❤️ from Zimbabwe
          </Text>
        </View>
      </ScrollView>

      {/* Modal for legal documents */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: T.surface, borderColor: T.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>
                {modalContent.title}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={T.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalText, { color: T.text }]}>
                {modalContent.body}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: T.accent }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },

  appInfo: {
    alignItems: "center",
    paddingVertical: 8,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: { fontSize: 20, fontWeight: "700" },
  appVersion: { fontSize: 13, marginTop: 4 },
  appCompany: { fontSize: 13, marginTop: 2 },
  appYear: { fontSize: 12, marginTop: 4 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { fontSize: 14 },

  footer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footerText: { fontSize: 12 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { maxHeight: "70%" },
  modalText: { fontSize: 14, lineHeight: 22 },
  closeModalBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  closeModalText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
