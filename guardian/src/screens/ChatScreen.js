import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRoute } from "@react-navigation/native";
import {
  Text,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "../contexts/ThemeContext";
import useSocketRedux from "../hooks/useSocket";
import { useDispatch, useSelector } from "react-redux";
import {
  clearUnread,
  fetchMessages,
  markAsRead,
  selectCurrentMessages,
  selectIsLoading,
  selectIsSending,
  selectTypingUsers,
  sendMessage,
  setCurrentConversations,
  setCurrentMessages,
} from "../lib/MessagesSlice";
import { formatChatTime, formatTime, getInitials } from "../utils/helpers";

const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
const TYPING_STOP_DELAY = 2000;

const selectUser = (s) => s.auth?.user;

// ── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#EF4444",
];

// ── Helper Functions ──────────────────────────────────────────────────────────

const getImageUrl = (filePath) => {
  if (!filePath) return null;

  // Replace backslashes with forward slashes for URL
  let normalizedPath = filePath.replace(/\\/g, "/");

  // Remove 'uploads/' prefix if present (to avoid double)
  if (normalizedPath.startsWith("uploads/")) {
    normalizedPath = normalizedPath;
  }

  // Construct the full URL
  const baseUrl = API_BASE_URL.replace("/api", "");
  const imageUrl = `${baseUrl}/${normalizedPath}`;

  return imageUrl;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getMessageStatus = (message, userId) => {
  if (
    !message ||
    (message.senderId !== userId && message.senderId !== userId?._id)
  ) {
    return null;
  }

  // Check read status
  if (message.readBy && Array.isArray(message.readBy)) {
    const otherReaders = message.readBy.filter(
      (id) => id !== userId && id !== userId?._id,
    );
    if (otherReaders.length > 0) {
      return "read";
    }
  }

  // Check delivered status
  if (message.deliveredTo && Array.isArray(message.deliveredTo)) {
    const otherDeliveries = message.deliveredTo.filter(
      (id) => id !== userId && id !== userId?._id,
    );
    if (otherDeliveries.length > 0) {
      return "delivered";
    }
  }

  // Check if it's a real message (has an ID from server)
  if (message.id && !String(message.id).startsWith("temp-")) {
    return "sent";
  }

  // If it has a temp ID, it's still sending
  if (message.id && String(message.id).startsWith("temp-")) {
    return "sending";
  }

  return "sent";
};

// ── Status Icon Component ──────────────────────────────────────────────────────

const MessageStatusIcon = ({ status }) => {
  const { theme } = useTheme();

  switch (status) {
    case "sending":
      return (
        <ActivityIndicator
          size={12}
          color={theme.textMuted}
          style={{ marginLeft: 4 }}
        />
      );
    case "sent":
      return (
        <Ionicons
          name="checkmark"
          size={14}
          color={theme.textMuted}
          style={{ marginLeft: 4 }}
        />
      );
    case "delivered":
      return (
        <Ionicons
          name="checkmark-done"
          size={14}
          color={theme.textMuted}
          style={{ marginLeft: 4 }}
        />
      );
    case "read":
      return (
        <Ionicons
          name="checkmark-done"
          size={14}
          color="#4CAF50"
          style={{ marginLeft: 4 }}
        />
      );
    case "failed":
      return (
        <Ionicons
          name="alert-circle"
          size={14}
          color="#f44336"
          style={{ marginLeft: 4 }}
        />
      );
    default:
      return null;
  }
};

// ── Avatar Component ──────────────────────────────────────────────────────────

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

// ── Date Formatter ────────────────────────────────────────────────────────────

const formatDateDivider = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `Today, ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
  }
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// ─── Fullscreen Image Viewer ──────────────────────────────────────────────────

const FullscreenImageViewer = ({ visible, imageUrl, onClose }) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.fullscreenOverlay}>
        <TouchableOpacity style={styles.fullscreenClose} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.fullscreenError}>
            <Ionicons name="image-outline" size={60} color="#666" />
            <Text style={{ color: "#fff", marginTop: 10 }}>
              Image not available
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Message Bubble with Attachments ──────────────────────────────────────────

const MessageBubble = ({ message, isMine, theme, onImagePress }) => {
  const [showOptions, setShowOptions] = useState(false);
  const status = getMessageStatus(message, message.senderId);

  // Extract image and file attachments
  const imageAttachments =
    message.attachments?.filter((a) => a.mimeType?.startsWith("image/")) || [];
  const fileAttachments =
    message.attachments?.filter((a) => !a.mimeType?.startsWith("image/")) || [];

  if (message.isDeleted) {
    return (
      <View
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        ]}
      >
        <View
          style={[
            styles.deletedBubble,
            { backgroundColor: theme.surfaceRaised },
          ]}
        >
          <Ionicons name="trash-outline" size={13} color={theme.textMuted} />
          <Text
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: theme.textMuted,
            }}
          >
            Message deleted
          </Text>
        </View>
      </View>
    );
  }

  const bubbleBg = isMine ? theme.accent : theme.surfaceRaised;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={() => setShowOptions(true)}
      delayLongPress={300}
    >
      <View
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleBg,
              borderWidth: isMine ? 0 : 1,
              borderColor: theme.border,
            },
          ]}
        >
          {/* ── Image Attachments ── */}
          {imageAttachments.length > 0 && (
            <View style={styles.imageGrid}>
              {imageAttachments.map((img, idx) => {
                const imageUrl = getImageUrl(img.filePath);
                return (
                  <TouchableOpacity
                    key={img.id || idx}
                    activeOpacity={0.9}
                    onPress={() => onImagePress?.(imageUrl)}
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={
                          imageAttachments.length === 1
                            ? styles.imageSingle
                            : styles.imageThumb
                        }
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.imageThumb,
                          {
                            backgroundColor: theme.inputBg,
                            justifyContent: "center",
                            alignItems: "center",
                          },
                        ]}
                      >
                        <Ionicons
                          name="image-outline"
                          size={30}
                          color={theme.textMuted}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Text Message ── */}
          {message.message ? (
            <Text
              style={[
                styles.bubbleText,
                { color: isMine ? "#ffffff" : theme.text },
              ]}
            >
              {message.message}
            </Text>
          ) : null}

          {/* ── File Attachments ── */}
          {fileAttachments.map((file, idx) => {
            const fileUrl = getImageUrl(file.filePath);
            const fileName = file.fileName || file.name || "File";

            return (
              <TouchableOpacity
                key={file.id || idx}
                style={[
                  styles.fileRow,
                  {
                    backgroundColor: isMine
                      ? "rgba(255,255,255,0.15)"
                      : theme.inputBg,
                  },
                ]}
                onPress={() => {
                  if (fileUrl) {
                    Alert.alert("Download", `Download ${fileName}?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Download",
                        onPress: () => {
                          // Implement actual download here
                          Alert.alert("Download started", fileName);
                        },
                      },
                    ]);
                  }
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: isMine
                      ? "rgba(255,255,255,0.2)"
                      : theme.accent + "20",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={isMine ? "#fff" : theme.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "500",
                      color: isMine ? "#fff" : theme.text,
                    }}
                    numberOfLines={1}
                  >
                    {fileName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: isMine
                        ? "rgba(255,255,255,0.65)"
                        : theme.textMuted,
                    }}
                  >
                    {formatFileSize(file.fileSize)}
                  </Text>
                </View>
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={isMine ? "rgba(255,255,255,0.65)" : theme.textMuted}
                />
              </TouchableOpacity>
            );
          })}

          {/* ── Footer ── */}
          <View style={styles.bubbleFooter}>
            <Text
              style={[
                styles.bubbleTime,
                { color: isMine ? "rgba(255,255,255,0.65)" : theme.textMuted },
              ]}
            >
              {formatChatTime(message.createdAt)}
              {message.isEdited ? " · edited" : ""}
            </Text>
            {isMine && <MessageStatusIcon status={status} />}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main ChatScreen Component ──────────────────────────────────────────────

export default function ChatScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const dispatch = useDispatch();
  const route = useRoute();
  const { conversationId, title } = route.params || {};

  const { joinConversation, leaveConversation, sendTyping } = useSocketRedux();

  const user = useSelector(selectUser);
  const messages = useSelector(selectCurrentMessages);
  const isLoading = useSelector(selectIsLoading);
  const isSending = useSelector(selectIsSending);
  const typingUsers = useSelector(selectTypingUsers);

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const listRef = useRef(null);

  const othersTyping = useMemo(() => {
    const ids = typingUsers?.[conversationId] || [];
    return ids.filter((id) => id !== user?.id);
  }, [typingUsers, conversationId, user?.id]);

  const chatName = title || "Conversation";
  const avatarColor = useMemo(() => getAvatarColor(chatName), [chatName]);
  const headerSubtitle = othersTyping.length > 0 ? "Typing…" : "Online";

  // Hide the default navigator header
  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // ── Enter the conversation ──────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;

    dispatch(setCurrentConversations({ id: conversationId }));
    dispatch(fetchMessages({ conversationId }));
    dispatch(markAsRead(conversationId));
    dispatch(clearUnread(conversationId));
    joinConversation(conversationId);

    return () => {
      leaveConversation(conversationId);
      dispatch(setCurrentConversations(null));
      dispatch(setCurrentMessages([]));

      if (isTypingRef.current) {
        sendTyping(conversationId, false);
        isTypingRef.current = false;
      }

      clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId]);

  // ── Typing indicator ──────────────────────────────────────────────────────

  const handleChangeText = useCallback(
    (value) => {
      setText(value);
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(conversationId, true);
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTyping(conversationId, false);
      }, TYPING_STOP_DELAY);
    },
    [conversationId, sendTyping],
  );

  // ── Attachments ────────────────────────────────────────────────────────────

  const handlePickMedia = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photos to attach images or videos.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const picked = result.assets.map((asset, idx) => {
      const isVideo = asset.type === "video";
      return {
        id: `media-${Date.now()}-${idx}`,
        kind: isVideo ? "video" : "image",
        uri: asset.uri,
        name:
          asset.fileName ||
          `${isVideo ? "video" : "photo"}-${idx + 1}.${
            isVideo ? "mp4" : "jpg"
          }`,
        type: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
      };
    });

    setAttachments((prev) => [...prev, ...picked]);
  }, []);

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "application/zip",
      ],
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const files = result.assets || (result.uri ? [result] : []);
    const picked = files.map((file, idx) => ({
      id: `doc-${Date.now()}-${idx}`,
      kind: "document",
      uri: file.uri,
      name: file.name || `document-${idx + 1}`,
      type: file.mimeType || "application/octet-stream",
    }));

    setAttachments((prev) => [...prev, ...picked]);
  }, []);

  const handleAttachPress = useCallback(() => {
    Alert.alert("Add attachment", "What would you like to attach?", [
      { text: "Photo or Video", onPress: handlePickMedia },
      { text: "Document", onPress: handlePickDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handlePickMedia, handlePickDocument]);

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Sending ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const senderId = user?.id || user?._id;

    dispatch(
      sendMessage({
        conversationId,
        message: trimmed,
        attachments: attachments,
        tempId,
        senderId,
      }),
    );
    setText("");
    setAttachments([]);
    clearTimeout(typingTimeoutRef.current);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(conversationId, false);
    }
  }, [
    text,
    attachments,
    isSending,
    conversationId,
    dispatch,
    sendTyping,
    user,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // ── Build list data: date dividers + grouped messages ──────────────────────

  const listData = useMemo(() => {
    const out = [];
    let prevDateKey = null;
    let prevSenderId = null;

    messages.forEach((item, idx) => {
      const dateKey = item.createdAt
        ? new Date(item.createdAt).toDateString()
        : null;

      if (dateKey && dateKey !== prevDateKey) {
        out.push({
          type: "date",
          id: `date-${dateKey}-${idx}-${Date.now()}`,
          label: formatDateDivider(item.createdAt),
        });
        prevSenderId = null;
      }

      const next = messages[idx + 1];
      const nextDateKey = next?.createdAt
        ? new Date(next.createdAt).toDateString()
        : null;
      const isLastOfGroup =
        !next || next.senderId !== item.senderId || nextDateKey !== dateKey;
      const isFirstOfGroup =
        prevSenderId === null || prevSenderId !== item.senderId;

      const uniqueId = item.id || item._id || `msg-${idx}`;

      out.push({
        type: "message",
        id: `${uniqueId}-${idx}`,
        message: item,
        isFirstOfGroup,
        isLastOfGroup,
      });

      prevDateKey = dateKey;
      prevSenderId = item.senderId;
    });

    return out;
  }, [messages]);

  // ── Render Item ──────────────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    if (item.type === "date") {
      return (
        <View style={styles.dateDividerRow}>
          <Text style={[styles.dateDividerText, { color: theme.textMuted }]}>
            {item.label}
          </Text>
        </View>
      );
    }

    const msg = item.message;
    const isMine = msg.senderId === user?.id || msg.senderId === user?._id;

    return (
      <MessageBubble
        message={msg}
        isMine={isMine}
        theme={theme}
        onImagePress={(url) => setFullscreenImage(url)}
      />
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.bg,
              borderBottomColor: theme.border,
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={[styles.headerAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.headerAvatarText}>{getInitials(chatName)}</Text>
          </View>

          <View style={styles.headerTextContainer}>
            <Text
              style={[styles.headerName, { color: theme.text }]}
              numberOfLines={1}
            >
              {chatName}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color:
                    othersTyping.length > 0 ? theme.accent : theme.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>
          </View>

          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="videocam-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="call-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        {isLoading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* ── Attachment Strip ── */}
        {attachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.attachmentStrip}
            contentContainerStyle={styles.attachmentStripContent}
          >
            {attachments.map((att) => (
              <View
                key={att.id}
                style={[
                  styles.attachmentChip,
                  {
                    backgroundColor: theme.surfaceRaised,
                    borderColor: theme.border,
                  },
                ]}
              >
                {att.kind === "image" ? (
                  <Image
                    source={{ uri: att.uri }}
                    style={styles.attachmentThumb}
                  />
                ) : (
                  <View
                    style={[
                      styles.attachmentThumb,
                      styles.attachmentDocIcon,
                      { backgroundColor: theme.inputBg },
                    ]}
                  >
                    <Ionicons
                      name={
                        att.kind === "video"
                          ? "videocam-outline"
                          : "document-text-outline"
                      }
                      size={18}
                      color={theme.textMuted}
                    />
                  </View>
                )}
                <Text
                  style={[styles.attachmentName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {att.name}
                </Text>
                <TouchableOpacity
                  style={styles.attachmentRemove}
                  onPress={() => removeAttachment(att.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Input Bar ── */}
        <View style={[styles.inputBar, { backgroundColor: theme.bg }]}>
          <View
            style={[
              styles.inputPill,
              { backgroundColor: theme.inputBg, borderColor: theme.border },
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Enter text"
              placeholderTextColor={theme.placeholder}
              value={text}
              onChangeText={handleChangeText}
              multiline
            />
            <TouchableOpacity
              style={styles.inputIconButton}
              onPress={handleAttachPress}
            >
              <Ionicons
                name="attach-outline"
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: theme.accent,
                opacity: text.trim() || attachments.length > 0 ? 1 : 0.4,
              },
            ]}
            onPress={handleSend}
            disabled={(!text.trim() && attachments.length === 0) || isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Fullscreen Image Viewer ── */}
      <FullscreenImageViewer
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackButton: {
    marginRight: 4,
    padding: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  headerTextContainer: { flex: 1, marginRight: 8 },
  headerName: { fontSize: 16, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  // List
  listContent: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  dateDividerRow: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateDividerText: { fontSize: 12 },

  // Bubbles
  bubbleRow: { flexDirection: "column", marginBottom: 4 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubbleRowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 2,
  },
  bubbleTime: { fontSize: 11 },

  // Deleted message
  deletedBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: "75%",
  },

  // Image grid
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 4,
  },
  imageSingle: {
    width: 210,
    height: 210,
    borderRadius: 10,
  },
  imageThumb: {
    width: 110,
    height: 110,
    borderRadius: 8,
  },

  // File attachments
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    borderRadius: 10,
    marginBottom: 5,
  },

  // Fullscreen image viewer
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
  fullscreenError: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 6,
  },
  inputIconButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Attachment strip
  attachmentStrip: {
    maxHeight: 80,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "transparent",
  },
  attachmentStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  attachmentDocIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    fontSize: 11,
    maxWidth: 80,
  },
  attachmentRemove: {
    marginLeft: 2,
    padding: 2,
  },
});
