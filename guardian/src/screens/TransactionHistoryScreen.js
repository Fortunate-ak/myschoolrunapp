// screens/guardian/TransactionHistoryScreen.js
import React from "react";
import { Text, StyleSheet, View, FlatList } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// NOTE: there is no real billing-history endpoint/thunk yet — nothing in
// UserSlice.js or the backend currently returns a list of past payments.
// This screen shows a dummy history derived from the guardian's CURRENT
// subscription record (their real plan/payment method), so it's not fake
// data unrelated to the account, but it's also not a real transaction log —
// just one entry representing "when you (re)subscribed". Once a real
// getBillingHistory endpoint exists, replace the dummyEntries logic below
// with a thunk dispatch + real list.
export default function TransactionHistoryScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { guardianProfile } = useSelector((state) => state.users);

  const dummyEntries = [];
  if (guardianProfile?.isSubscribed && guardianProfile?.subscriptionPlan) {
    const planLabel =
      guardianProfile.subscriptionPlan.charAt(0).toUpperCase() +
      guardianProfile.subscriptionPlan.slice(1);
    const chargedOn = guardianProfile.updatedAt
      ? new Date(guardianProfile.updatedAt)
      : new Date();

    dummyEntries.push({
      id: "current-subscription",
      date: chargedOn.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      description: `${planLabel} Plan - Monthly`,
      reference: guardianProfile.paymentReference || "—",
      method: guardianProfile.paymentMethod || "—",
    });
  }

  const renderItem = ({ item }) => (
    <View style={[styles.row, { borderBottomColor: T.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: T.text }]}>
          {item.description}
        </Text>
        <Text style={[styles.rowSub, { color: T.textMuted }]}>
          {item.date} · Ref: {item.reference}
        </Text>
      </View>
      <Text style={[styles.rowMethod, { color: T.textMuted }]}>
        {item.method}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: T.border, paddingTop: insets.top + 10 },
        ]}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={T.text}
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: T.surface }]}
          suppressHighlighting
        />
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Transaction History
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={dummyEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 20,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={T.textMuted} />
            <Text style={[styles.emptyText, { color: T.textMuted }]}>
              No transactions yet. Once you subscribe, your payment history
              will show up here.
            </Text>
          </View>
        }
      />
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
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowMethod: { fontSize: 12, textTransform: "capitalize" },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});
