// utils/notifications.js
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import api from "./axiosInstance";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    let priority = Notifications.AndroidNotificationPriority.DEFAULT;

    if (
      data?.priority === "urgent" ||
      data?.type === "alert" ||
      data?.type === "sos" ||
      data?.type === "message"
    ) {
      priority = Notifications.AndroidNotificationPriority.MAX;
    } else if (data?.priority === "high") {
      priority = Notifications.AndroidNotificationPriority.HIGH;
    }

    return {
      shouldShowList: true,
      shouldPlaySound: true,
      shouldShowBanner: true,
      priority,
      shouldSetBadge: true,
    };
  },
});

export const configureAndroidChannels = async () => {
  if (Platform.OS !== "android") return;

  const channels = [
    {
      id: "default",
      name: "General Notification",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "notif",
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    },
    {
      id: "announcements",
      name: "Announcements",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F59E0B",
      sound: "notif",
      bypassDnd: true,
    },
    {
      id: "messages",
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3B82F6",
      sound: "notif",
      bypassDnd: false,
    },
    {
      id: "alerts",
      name: "Safety Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#EF4444",
      sound: "notif",
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    },
    {
      id: "tracking",
      name: "Tracking",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
      sound: "notif",
    },
    {
      id: "requests",
      name: "Requests",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3B82F6",
      sound: "notif",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    },
  ];

  for (const ch of channels) {
    await Notifications.setNotificationChannelAsync(ch.id, ch);
  }
  console.log("[Notifications] Android channels configured");
};

export const registerPushNotifications = async () => {
  if (!Device.isDevice) {
    console.warn(
      "[Notifications] Push notifications only work on physical devices.",
    );
    return null;
  }

  await configureAndroidChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Notifications] Permission denied.");
    return null;
  }

  // app.json stores this at extra.eas.projectId, not extra.projectId.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn(
      "[Notifications] No EAS project ID found. Push notifications won't work.",
    );
    return null;
  }

  try {
    // FIX: getExpoPushTokenAsync returns a Promise<{ data: string }>,
    // so we must await it and then access .data — not chain .data directly.
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const expoPushToken = tokenResult.data;

    await api.post("/push-tokens/register-push-token", {
      expoPushToken,
      deviceName: Device.deviceName || "Unknown Device",
      deviceType: Platform.OS === "ios" ? "iphone" : "android",
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || "1.0.0",
    });

    console.log("[Notifications] Push token registered:", expoPushToken);
    return expoPushToken;
  } catch (error) {
    console.error("[Notifications] Failed to register push token:", error);
    return null;
  }
};

export const getBadgeCount = async () => Notifications.getBadgeCountAsync();

export const setBadgeCount = async (count) =>
  Notifications.setBadgeCountAsync(count);

export const getLastNotificationResponse = async () =>
  Notifications.getLastNotificationResponse();

export const handleInitialNotification = async () =>
  getLastNotificationResponse();

export const addNotificationListener = (callback) =>
  Notifications.addNotificationReceivedListener(callback);

export const addResponseListener = (callback) =>
  Notifications.addNotificationResponseReceivedListener(callback);
