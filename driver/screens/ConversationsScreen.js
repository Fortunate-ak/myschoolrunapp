import React, { useCallback, useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { getInitials, timeAgo } from "../utils/helpers";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchConversations,
  selectConversations,
  selectIsLoading,
  leaveConversation,
} from "../lib/MessagesSlice";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const AVATAR_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#EF4444",
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

export default function ConversationsScreen({ navigation }) {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const conversations = useSelector(selectConversations);
  const isLoading = useSelector(selectIsLoading);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchConversations());
    setRefreshing(false);
  }, [dispatch]);

  const openChat = (conversation) => {
    navigation.navigate("ChatThread", {
      conversationId: conversation.id,
      title: conversation.name || conversation.title || "Conversation",
    });
  };

  const handleLongPress = (conversation) => {
    const isRoute = conversation.type === "route";
    Alert.alert(
      isRoute ? "Leave Route Channel" : "Delete Conversation",
      isRoute
        ? "You will leave this route channel and won't receive new messages."
        : "This conversation will be removed from your list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isRoute ? "Leave" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(leaveConversation(conversation.id)).unwrap();
              Toast.show({
                type: "success",
                text1: isRoute ? "Left channel" : "Conversation deleted",
              });
              loadConversations(); // refresh list
            } catch (error) {
              Toast.show({
                type: "error",
                text1: error || "Failed to leave conversation",
              });
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const lastMessageObj =
      item.messages && item.messages.length > 0
        ? item.messages[item.messages.length - 1]
        : null;
    const lastMessageText =
      lastMessageObj?.message ||
      lastMessageObj?.text ||
      lastMessageObj?.content ||
      null;
    const hasUnread = (item.unreadCount || 0) > 0;
    const name = item.name || item.title || "Conversation";
    const avatarColor = getAvatarColor(name);

    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.border }]}
        activeOpacity={0.7}
        onPress={() => openChat(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text
              style={[
                styles.name,
                { color: theme.text, fontWeight: hasUnread ? "700" : "500" },
              ]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={[styles.time, { color: theme.textMuted }]}>
              {timeAgo(item.lastMessageAt || item.updatedAt)}
            </Text>
          </View>

          <View style={styles.rowBottom}>
            <Text
              style={[
                styles.preview,
                { color: hasUnread ? theme.text : theme.textMuted },
                hasUnread && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {lastMessageText || "No messages yet"}
            </Text>
            {hasUnread && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && conversations.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.listHeader,
          {
            borderBottomColor: theme.border,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <Text style={[styles.listTitle, { color: theme.text }]}>Messages</Text>
        <Text style={[styles.listSubtitle, { color: theme.textMuted }]}>
          {conversations.length} conversation
          {conversations.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[styles.emptyIcon, { backgroundColor: theme.accentDim }]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={40}
                color={theme.accent}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No messages yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Conversations with guardians and route channels will appear here
            </Text>
          </View>
        }
        contentContainerStyle={
          conversations.length === 0 ? { flexGrow: 1 } : undefined
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("NewConversation")}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  listHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  listTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  listSubtitle: { fontSize: 13, marginTop: 2 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: { fontSize: 15, flexShrink: 1, marginRight: 8 },
  time: { fontSize: 11 },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: { fontSize: 13, flex: 1, marginRight: 6 },
  previewUnread: { fontWeight: "600" },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
