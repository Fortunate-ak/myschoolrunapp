import React, { useCallback, useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Toast from "react-native-toast-message";
import { timeAgo } from "../utils/helpers";
import { onNewNotification, offNewNotification } from "../utils/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  notificationReceived,
} from "../lib/NotificationsSlice";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP = {
  request: {
    icon: "person-add-outline",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
  },
  route: { icon: "map-outline", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  alert: {
    icon: "alert-circle-outline",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
  },
  system: {
    icon: "settings-outline",
    color: "rgba(255,255,255,0.45)", // will be overridden with theme later
    bg: "rgba(255,255,255,0.06)",
  },
  message: {
    icon: "chatbubble-outline",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.12)",
  },
};

// ── Notification Card ──────────────────────────────────────────────────────
function NotifCard({ item, onPress, T }) {
  // Determine if this type exists in the map
  const isKnownType = Object.prototype.hasOwnProperty.call(ICON_MAP, item.type);
  const meta = ICON_MAP[item.type] || ICON_MAP.system;

  // For unknown types or 'system', use theme's muted color; otherwise use the predefined color
  const iconColor =
    item.type === "system" || !isKnownType ? T.textMuted : meta.color;

  // Use a themed background for fallback, otherwise the mapped one
  const bgColor = !isKnownType ? T.surfaceRaised : meta.bg;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: T.surface, borderColor: T.border },
        !item.read && styles.cardUnread,
        !item.read && { borderColor: T.accentBorder },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.notifIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={meta.icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: T.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.cardTime, { color: T.textMuted }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.cardBody, { color: T.textMuted }]}
          numberOfLines={2}
        >
          {item.body}
        </Text>
      </View>
      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: T.accent }]} />
      )}
    </TouchableOpacity>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ T }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: T.surface }]}>
        <Ionicons
          name="notifications-off-outline"
          size={32}
          color={T.textMuted}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: T.text }]}>
        No notifications yet
      </Text>
      <Text style={[styles.emptySub, { color: T.textMuted }]}>
        We'll let you know when something needs your attention
      </Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const { theme: T } = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, isLoading, isRefreshing, isMarkingAll } =
    useSelector((s) => s.notifications);

  const [refreshing, setRefreshing] = useState(false);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(getNotifications());
  }, []);

  // ── Live updates over the socket ────────────────────────────────────────
  useEffect(() => {
    const handleNewNotification = (payload) => {
      dispatch(notificationReceived(payload));
    };

    onNewNotification(handleNewNotification);
    return () => offNewNotification(handleNewNotification);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(getNotifications({ isRefresh: true })).unwrap();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't refresh notifications",
        text2: typeof error === "string" ? error : "Please try again",
      });
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const handlePressNotification = useCallback(
    (item) => {
      if (!item.read) {
        dispatch(markNotificationAsRead(item.id)).catch(() => {
          // Errors are surfaced via state.error; nothing else to do here.
        });
      }
      // Extension point: route to the relevant screen based on item.type /
      // item.data once those destinations are defined for this app.
    },
    [dispatch],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    try {
      await dispatch(markAllNotificationsAsRead()).unwrap();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't mark all as read",
        text2: typeof error === "string" ? error : "Please try again",
      });
    }
  }, [dispatch, unreadCount, isMarkingAll]);

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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Notifications
          </Text>
          <Text style={[styles.headerSub, { color: T.textMuted }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0 || isMarkingAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isMarkingAll ? (
            <ActivityIndicator size="small" color={T.accent} />
          ) : (
            <Ionicons
              name="checkmark-done-outline"
              size={20}
              color={unreadCount === 0 ? T.textDisabled : T.accent}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading && notifications.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, i) => String(item.id ?? `notif-${i}`)}
          contentContainerStyle={
            notifications.length === 0
              ? styles.listContentEmpty
              : [styles.listContent, { paddingBottom: insets.bottom + 32 }]
          }
          renderItem={({ item }) => (
            <NotifCard item={item} onPress={handlePressNotification} T={T} />
          )}
          ListEmptyComponent={<EmptyState T={T} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || (isRefreshing && !refreshing)}
              onRefresh={handleRefresh}
              tintColor={T.accent}
              colors={[T.accent]}
            />
          }
        />
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSub: { fontSize: 12, marginTop: 2 },
  markAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  listContentEmpty: { flexGrow: 1 },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: {
    borderWidth: 1.5,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  cardTime: { fontSize: 11 },
  cardBody: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
    marginTop: 5,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
