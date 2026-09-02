import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isRefreshing: false,
  isMarkingAll: false,
  error: null,
};

// Backend response shape isn't guaranteed to be consistent (some endpoints
// might return { notifications, unreadCount }, others might just return the
// bare array), so normalize defensively rather than assuming one shape.
const extractNotifications = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.notifications || [];
};

const extractUnreadCount = (payload, fallbackList) => {
  if (typeof payload?.unreadCount === "number") return payload.unreadCount;
  const list = fallbackList || extractNotifications(payload);
  return list.filter((n) => !n.read).length;
};

export const getNotifications = createAsyncThunk(
  "notifications/getNotifications",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/notifications/my-notifications");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch notifications",
      );
    }
  },
);

export const markNotificationAsRead = createAsyncThunk(
  "notifications/markNotificationAsRead",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(`/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to mark notification as read",
      );
    }
  },
);

export const markAllNotificationsAsRead = createAsyncThunk(
  "notifications/markAllNotificationsAsRead",
  async (_, thunkAPI) => {
    try {
      const response = await api.patch("/notifications/mark-all-read");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message ||
          "Failed to mark all notifications as read",
      );
    }
  },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    reset: () => initialState,
    clearError: (state) => {
      state.error = null;
    },
    // Called from the socket "new-notification" listener to push a
    // real-time notification into the list without a re-fetch.
    notificationReceived: (state, action) => {
      const incoming = action.payload;
      if (!incoming) return;

      const alreadyExists = state.notifications.some(
        (n) => n.id === incoming.id,
      );
      if (alreadyExists) return;

      state.notifications.unshift(incoming);
      if (!incoming.read) {
        state.unreadCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getNotifications.pending, (state, action) => {
        // Distinguish pull-to-refresh from the initial/background load so
        // the screen can show the right spinner.
        if (action.meta.arg?.isRefresh) {
          state.isRefreshing = true;
        } else {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isRefreshing = false;
        const list = extractNotifications(action.payload);
        state.notifications = list;
        state.unreadCount = extractUnreadCount(action.payload, list);
      })
      .addCase(getNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.isRefreshing = false;
        state.error = action.payload;
      });

    builder
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const updated = action.payload?.notification || action.payload;
        if (!updated?.id) return;

        const index = state.notifications.findIndex((n) => n.id === updated.id);
        if (index !== -1) {
          const wasUnread = !state.notifications[index].read;
          state.notifications[index] = updated;
          if (wasUnread && updated.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload;
      });

    builder
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.isMarkingAll = true;
        state.error = null;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.isMarkingAll = false;
        state.notifications = state.notifications.map((n) => ({
          ...n,
          read: true,
        }));
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.isMarkingAll = false;
        state.error = action.payload;
      });
  },
});

export const { reset, clearError, notificationReceived } =
  notificationsSlice.actions;
export default notificationsSlice.reducer;
