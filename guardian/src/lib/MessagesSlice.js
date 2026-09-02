import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "axios";

const initialState = {
  conversations: [],
  currentConversations: null,
  currentMessages: [],
  isLoading: false,
  isSending: false,
  typingUsers: {},
  onlineUsers: {},
  unreadCount: 0,
  error: null,
  driverRouteChannels: [], // routes the driver can create/open a route channel for
  isLoadingDriverRoutes: false,
  routeGuardians: [], // guardians for the currently-selected route
  routeGuardiansRouteId: null,
  isLoadingRouteGuardians: false,
};

// Keeps the conversations list (used by ConversationsScreen) in sync whenever
// a message is sent or received: updates the preview text/time and bumps the
// conversation to the top of the list, the way most chat apps behave.
const upsertConversationPreview = (state, conversationId, message) => {
  if (!conversationId || !message) return;
  const conversation = state.conversations.find(
    (c) => String(c.id) === String(conversationId),
  );
  if (!conversation) return;

  const existingMessages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];
  conversation.messages = [...existingMessages, message];
  conversation.lastMessageAt = message.createdAt || new Date().toISOString();
  conversation.updatedAt = conversation.lastMessageAt;

  // Move this conversation to the top of the list.
  state.conversations = [
    conversation,
    ...state.conversations.filter(
      (c) => String(c.id) !== String(conversationId),
    ),
  ];
};

// Add this helper function at the top of MessagesSlice.js
const deduplicateMessages = (messages) => {
  const seen = new Set();
  return messages.filter((msg) => {
    const id = msg.id || msg._id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const fetchConversations = createAsyncThunk(
  "messages/fetchConversations",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/messages/conversations");
      return response.data?.data || response.data || [];
    } catch (error) {
      return [];
    }
  },
);

export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async ({ conversationId, page = 1 }, thunkAPI) => {
    try {
      const response = await api.get(
        `/messages/conversations/${conversationId}/messages`,
        { params: { page, limit: 50 } },
      );
      return response.data?.data?.items || response.data?.items || [];
    } catch (error) {
      return [];
    }
  },
);

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async (
    { conversationId, message, attachments = [], tempId, senderId },
    thunkAPI,
  ) => {
    try {
      const formData = new FormData();
      if (message) formData.append("message", message);

      attachments.forEach((file) => {
        formData.append("attachments", {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      });

      const response = await api.post(
        `/messages/conversations/${conversationId}/messages`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      return response.data?.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to send message",
      );
    }
  },
);

export const markAsRead = createAsyncThunk(
  "messages/markAsRead",
  async (conversationId, thunkAPI) => {
    try {
      await api.patch(`/messages/conversations/${conversationId}/read`);
      return;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to mark conversation as read",
      );
    }
  },
);

export const deleteMessage = createAsyncThunk(
  "messages/deleteMessage",
  async (messageId, thunkAPI) => {
    try {
      await api.delete(`/messages/messages/${messageId}`);
      return;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to delete message",
      );
    }
  },
);

export const createRouteChannel = createAsyncThunk(
  "/messages/createRouteChannel",
  async ({ routeId, name }, thunkAPI) => {
    try {
      const response = await api.post("/messages/conversations/route", {
        routeId,
        name,
      });
      return response.data?.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to create route channel",
      );
    }
  },
);

export const getorCreatePrivateConversation = createAsyncThunk(
  "messages/getOrCreatePrivateConversation",
  async (userId, thunkAPI) => {
    try {
      const response = await api.post(
        `/messages/conversations/private/${userId}`,
      );

      return response.data?.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to create conversation",
      );
    }
  },
);

// Driver's own routes, annotated with whether a route channel already
// exists (hasChannel/conversationId) — used to let a driver create or
// jump into a route channel.
export const fetchDriverRouteChannels = createAsyncThunk(
  "messages/fetchDriverRouteChannels",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/messages/driver/routes");
      return response.data || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch your routes",
      );
    }
  },
);

// Guardians of students on one of the driver's routes, annotated with
// existingConversationId when a private conversation already exists —
// used to let a driver start a 1:1 chat with a guardian.
export const fetchRouteGuardians = createAsyncThunk(
  "messages/fetchRouteGuardians",
  async (routeId, thunkAPI) => {
    try {
      const response = await api.get(
        `/messages/driver/routes/${routeId}/guardians`,
      );
      return { routeId, guardians: response.data || [] };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch guardians",
      );
    }
  },
);

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setCurrentConversations: (state, action) => {
      state.currentConversations = action.payload;
    },
    setCurrentMessages: (state, action) => {
      state.currentMessages = action.payload;
    },
    addMessage: (state, action) => {
      const { conversationId, message: newMessage } =
        action.payload && action.payload.message
          ? action.payload
          : {
              conversationId: action.payload?.conversationId,
              message: action.payload,
            };

      if (!newMessage) return;

      // Check if this is a real message replacing a temporary one
      const tempId = action.payload?.tempId;
      if (tempId) {
        // Remove the temporary message
        state.currentMessages = state.currentMessages.filter(
          (msg) => msg.id !== tempId && msg._id !== tempId,
        );
      }

      // Only append to the open thread if this message actually belongs to it
      const belongsToOpenConversation =
        !conversationId ||
        String(conversationId) === String(state.currentConversations?.id);

      if (belongsToOpenConversation) {
        const exists = state.currentMessages.some(
          (msg) => msg.id === newMessage.id || msg._id === newMessage._id,
        );
        if (!exists) {
          state.currentMessages.push(newMessage);
        }
      }

      // Always keep the conversations list preview/order up to date
      upsertConversationPreview(
        state,
        conversationId || newMessage.conversationId,
        newMessage,
      );
    },
    updateMessageStatus: (state, action) => {
      const { messageId, status } = action.payload;
      const message = state.currentMessages.find(
        (m) => m.id === messageId || m._id === messageId,
      );
      if (message) {
        message.status = status;
      }
    },
    updateMessage: (state, action) => {
      const { messageId, updates } = action.payload;
      const message = state.currentMessages.find((m) => m.id === messageId);
      if (message) {
        Object.assign(message, updates);
      }
    },
    setTyping: (state, action) => {
      const { conversationId, userId, isTyping } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId)) {
          state.typingUsers[conversationId].push(userId);
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[
          conversationId
        ].filter((id) => id !== userId);
      }
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setSending: (state, action) => {
      state.isSending = action.payload;
    },
    incrementUnread: (state, action) => {
      const conversationId = action.payload;
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );

      if (conversation && conversation.id !== state.currentConversations?.id) {
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        state.unreadCount += 1;
      }
    },
    clearUnread: (state, action) => {
      const conversationId = action.payload;
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );

      if (conversation) {
        const unread = conversation.unreadCount || 0;
        conversation.unreadCount = 0;
        state.unreadCount = Math.max(0, state.unreadCount - unread);
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    resetMessages: () => initialState,
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(fetchMessages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const incomingMessages = action.payload;
        const existingIds = new Set(
          state.currentMessages.map((m) => m.id || m._id),
        );
        const newMessages = incomingMessages.filter(
          (m) => !existingIds.has(m.id || m._id),
        );
        state.currentMessages = [...state.currentMessages, ...newMessages];
        state.isLoading = false;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    // In MessagesSlice.js, update the sendMessage.fulfilled case:

    builder
      .addCase(sendMessage.pending, (state, action) => {
        state.isSending = true;
        state.error = null;

        // Add optimistic message with "sending" status
        const {
          conversationId,
          message,
          attachments = [],
          tempId,
          senderId,
        } = action.meta.arg;
        if (message || attachments.length > 0) {
          const optimisticMessage = {
            id: tempId || `temp-${Date.now()}`,
            _id: tempId || `temp-${Date.now()}`,
            conversationId,
            senderId:
              senderId ||
              state.currentConversations?.participants?.find((p) => p.userId)
                ?.userId,
            message: message || "",
            messageType:
              attachments.length > 0
                ? attachments.some((a) => a.type?.startsWith("image/"))
                  ? "image"
                  : "file"
                : "text",
            createdAt: new Date().toISOString(),
            status: "sending", // 'sending' | 'sent' | 'delivered' | 'read'
            attachments: attachments.map((a) => ({
              id: `temp-att-${Date.now()}-${Math.random()}`,
              fileName: a.name,
              filePath: a.uri,
              mimeType: a.type,
              fileSize: 0,
            })),
            sender: state.currentConversations?.participants?.find(
              (p) => p.userId === senderId,
            )?.user || {
              id: senderId,
              fullname: "You",
            },
          };

          // Add to current messages
          const exists = state.currentMessages.some(
            (msg) =>
              msg.id === optimisticMessage.id ||
              msg._id === optimisticMessage._id,
          );
          if (!exists) {
            state.currentMessages.push(optimisticMessage);
          }

          // Update conversation preview
          upsertConversationPreview(state, conversationId, optimisticMessage);
        }
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSending = false;
        const newMessage = action.payload;
        if (!newMessage) return;

        // Remove the temporary message and add the real one
        const tempId = action.meta.arg.tempId;
        if (tempId) {
          state.currentMessages = state.currentMessages.filter(
            (msg) => msg.id !== tempId && msg._id !== tempId,
          );
        }

        const exists = state.currentMessages.some(
          (msg) =>
            (msg.id && msg.id === newMessage.id) ||
            (msg._id && msg._id === newMessage._id),
        );
        if (!exists) {
          // Ensure proper status fields
          if (!newMessage.status) {
            newMessage.status = "sent";
          }
          state.currentMessages.push(newMessage);
        } else {
          // Update existing message with real data
          const index = state.currentMessages.findIndex(
            (msg) => msg.id === newMessage.id || msg._id === newMessage._id,
          );
          if (index !== -1) {
            state.currentMessages[index] = {
              ...state.currentMessages[index],
              ...newMessage,
              status: "sent",
            };
          }
        }

        // Update the conversations list preview
        upsertConversationPreview(
          state,
          action.meta.arg.conversationId,
          newMessage,
        );
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload;

        // Mark the temporary message as failed
        const tempId = action.meta.arg.tempId;
        if (tempId) {
          const index = state.currentMessages.findIndex(
            (msg) => msg.id === tempId || msg._id === tempId,
          );
          if (index !== -1) {
            state.currentMessages[index].status = "failed";
          }
        }
      });

    builder
      .addCase(markAsRead.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const conversationId = action.payload;
        const conversation = state.conversations.find(
          (c) => c.id === conversationId,
        );
        if (conversation) {
          conversation.unreadCount = 0;
        }
        // Update unread count
        state.unreadCount = state.conversations.reduce(
          (total, c) => total + (c.unreadCount || 0),
          0,
        );
      })
      .addCase(markAsRead.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(deleteMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const messageId = action.payload;
        const message = state.currentMessages.find((m) => m.id === messageId);
        if (message) {
          message.isDeleted = true;
        }
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(createRouteChannel.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createRouteChannel.fulfilled, (state, action) => {
        const conversation = action.payload;
        const exists = state.conversations.find(
          (c) => c.id === conversation.id,
        );
        if (!exists) {
          state.conversations.unshift(conversation);
        }
        // Keep the driver's "start a conversation" route list in sync so it
        // reflects the new channel without needing a refetch.
        const routeId = conversation.routeId ?? conversation.route?.id;
        const routeEntry = state.driverRouteChannels.find(
          (r) => r.routeId === routeId,
        );
        if (routeEntry) {
          routeEntry.hasChannel = true;
          routeEntry.conversationId = conversation.id;
        }
      })
      .addCase(createRouteChannel.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(getorCreatePrivateConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getorCreatePrivateConversation.fulfilled, (state, action) => {
        const conversation = action.payload;
        const exists = state.conversations.find(
          (c) => c.id === conversation.id,
        );
        if (!exists) {
          state.conversations.unshift(conversation);
        }
        state.currentConversations = conversation;
      })
      .addCase(getorCreatePrivateConversation.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(fetchDriverRouteChannels.pending, (state) => {
        state.isLoadingDriverRoutes = true;
        state.error = null;
      })
      .addCase(fetchDriverRouteChannels.fulfilled, (state, action) => {
        state.isLoadingDriverRoutes = false;
        state.driverRouteChannels = action.payload;
      })
      .addCase(fetchDriverRouteChannels.rejected, (state, action) => {
        state.isLoadingDriverRoutes = false;
        state.error = action.payload;
      });

    builder
      .addCase(fetchRouteGuardians.pending, (state) => {
        state.isLoadingRouteGuardians = true;
        state.error = null;
      })
      .addCase(fetchRouteGuardians.fulfilled, (state, action) => {
        state.isLoadingRouteGuardians = false;
        state.routeGuardians = action.payload.guardians;
        state.routeGuardiansRouteId = action.payload.routeId;
      })
      .addCase(fetchRouteGuardians.rejected, (state, action) => {
        state.isLoadingRouteGuardians = false;
        state.error = action.payload;
      });
  },
});

export const {
  setConversations,
  setCurrentConversations,
  setCurrentMessages,
  addMessage,
  updateMessage,
  updateMessageStatus,
  setTyping,
  setLoading,
  setSending,
  incrementUnread,
  clearUnread,
  clearError,
} = messagesSlice.actions;

export const selectConversations = (state) => state.messages.conversations;
export const selectCurrentConversation = (state) =>
  state.messages.currentConversations;
export const selectCurrentMessages = (state) => state.messages.currentMessages;
export const selectIsLoading = (state) => state.messages.isLoading;
export const selectIsSending = (state) => state.messages.isSending;
export const selectTypingUsers = (state) => state.messages.typingUsers;
export const selectOnlineUsers = (state) => state.messages.onlineUsers;
export const selectUnreadCount = (state) => state.messages.unreadCount;
export const selectDriverRouteChannels = (state) =>
  state.messages.driverRouteChannels;
export const selectIsLoadingDriverRoutes = (state) =>
  state.messages.isLoadingDriverRoutes;
export const selectRouteGuardians = (state) => state.messages.routeGuardians;
export const selectRouteGuardiansRouteId = (state) =>
  state.messages.routeGuardiansRouteId;
export const selectIsLoadingRouteGuardians = (state) =>
  state.messages.isLoadingRouteGuardians;

export default messagesSlice.reducer;
