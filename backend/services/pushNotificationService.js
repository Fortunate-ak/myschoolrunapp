const { Expo } = require("expo-server-sdk");
const db = require("../models/index");
const PushNotificationToken = db.pushnotificationtokens;
const User = db.users;
const Role = db.role;

let expo = null;

const getExpoClient = () => {
  if (!expo) {
    expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
  }

  return expo;
};

const sendPushNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    const tokens = await PushNotificationToken.findAll({
      where: {
        userId: userId,
        isActive: true,
      },
    });

    if (tokens.length === 0) {
      console.warn(`[Push] No push tokens found for user ${userId}`);
      return { message: "No push tokens found" };
    }

    const messages = tokens
      .map((tokens) => {
        if (!Expo.isExpoPushToken(tokens.expoPushToken)) {
          console.warn(
            `[Push] Invalid Expo push token format for user ${userId}:`,
            tokens.expoPushToken,
          );
          return null;
        }

        return {
          to: tokens.expoPushToken,
          sound: "default",
          title: title,
          body: body,
          data: data,
          priority: data?.priority === "high" ? "high" : "default",
          ...(data?.category && { categoryId: data.category }),
          ...(data?.channelId && { channelId: data.channelId }),
        };
      })
      .filter(Boolean);

    if (messages.length === 0) {
      console.warn(`[Push] No valid push tokens for user ${userId}`);
      return { message: "No valid push tokens" };
    }

    const chunks = getExpoClient().chunkPushNotifications(messages);
    // FIX: Expo's ticket objects do NOT carry the push token in
    // `details` — `ticket.details.expoPushToken` is always undefined.
    // Tickets are only correlated to the token by *array position*:
    // sendPushNotificationsAsync(chunk) returns one ticket per message
    // in `chunk`, in the same order. Track that pairing explicitly
    // instead of trying to read the token back off the ticket, or a
    // failed ticket ends up deactivating whatever the Sequelize
    // `where: { expoPushToken: undefined }` query happens to return
    // first (i.e. an unrelated, effectively random token).
    const tickets = [];
    const ticketToToken = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk =
          await getExpoClient().sendPushNotificationsAsync(chunk);
        ticketChunk.forEach((ticket, i) => {
          tickets.push(ticket);
          ticketToToken.push(chunk[i].to);
        });
      } catch (error) {
        console.error("[Push] Error sending push notifications chunk:", error);
      }
    }

    const receiptIds = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const expoPushToken = ticketToToken[i];

      if (ticket.status === "error") {
        console.warn(
          `[Push] Ticket error (${ticket.details?.error || "unknown"}) for token ${expoPushToken}:`,
          ticket.message,
        );
        // FIX: DeviceNotRegistered means Expo/the OS has permanently
        // invalidated this token (app uninstalled, token rotated, etc).
        // It must be deactivated so we stop sending to it — the previous
        // code did `isActive: true`, which reactivated dead tokens and
        // guaranteed they'd be retried (and fail) forever.
        if (ticket.details?.error === "DeviceNotRegistered") {
          const token = await PushNotificationToken.findOne({
            where: { expoPushToken },
          });

          if (token) {
            await token.update({ isActive: false });
          }
        }
      } else if (ticket.id) {
        receiptIds.push(ticket.id);
      }
    }

    return {
      message: `Notifications sent to ${messages.length} devices`,
      tickets,
      receiptIds,
    };
  } catch (error) {
    // FIX: this catch was previously silent — any failure before the
    // per-ticket loop (bad Expo API response, network error, DB error,
    // etc.) vanished with no trace. Log it so failures are diagnosable.
    console.error(
      `[Push] Failed to send push notification to user ${userId}:`,
      error,
    );
    return {
      message: "Failed to send push notifications",
    };
  }
};

const sendPushNotificationToMultipleUsers = async (
  userIds,
  title,
  body,
  data = {},
) => {
  try {
    const tokens = await PushNotificationToken.findAll({
      where: { userId: userIds, isActive: true },
    });

    if (tokens.length === 0) {
      console.warn(`[Push] No push tokens found for users:`, userIds);
      return {
        message: "No push tokens found for these users",
      };
    }

    const messages = tokens
      .map((token) => {
        if (!Expo.isExpoPushToken(token.expoPushToken)) {
          console.warn(
            `[Push] Invalid Expo push token format for user ${token.userId}:`,
            token.expoPushToken,
          );
          return null;
        }

        return {
          to: token.expoPushToken,
          sound: "default",
          title: title,
          body: body,
          data: data,
          priority: data?.priority === "high" ? "high" : "default",
        };
      })
      .filter(Boolean);

    if (messages.length === 0) {
      console.warn(`[Push] No valid push tokens for users:`, userIds);
      return { message: "No valid push tokens" };
    }

    const chunks = getExpoClient().chunkPushNotifications(messages);
    // FIX: same issue as sendPushNotificationToUser — ticket.details never
    // contains the token, so it must be tracked by array position against
    // the chunk that produced it. This function is the shared path for
    // notifyRole/notifyMultipleRoles/notifyGuardiansOnVehicle, so this bug
    // is the one actually responsible for "push only worked for trip_start,
    // then stopped for everything else": the first errored ticket from
    // *any* batch (delay, arrival, SOS, ...) deactivated an unrelated
    // token — often the very one being tested with — silently breaking
    // push for that user going forward, while the DB row + socket emit
    // (which don't touch this table) kept arriving normally.
    const tickets = [];
    const ticketToToken = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk =
          await getExpoClient().sendPushNotificationsAsync(chunk);
        ticketChunk.forEach((ticket, i) => {
          tickets.push(ticket);
          ticketToToken.push(chunk[i].to);
        });
      } catch (error) {
        console.error("[Push] Error sending push notifications chunk:", error);
      }
    }

    // FIX: previously the per-ticket error/DeviceNotRegistered handling
    // that exists in sendPushNotificationToUser was missing entirely here,
    // so a ticket-level failure (invalid token, device unregistered, etc.)
    // was returned in `tickets` but never inspected or logged — it looked
    // like a "successful" send even when Expo rejected every message.
    const receiptIds = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const expoPushToken = ticketToToken[i];

      if (ticket.status === "error") {
        console.warn(
          `[Push] Ticket error (${ticket.details?.error || "unknown"}) for token ${expoPushToken}:`,
          ticket.message,
        );
        if (ticket.details?.error === "DeviceNotRegistered") {
          const token = await PushNotificationToken.findOne({
            where: { expoPushToken },
          });

          if (token) {
            await token.update({ isActive: false });
          }
        }
      } else if (ticket.id) {
        receiptIds.push(ticket.id);
      }
    }

    return {
      message: `Notifications sent to ${messages.length} devices`,
      tickets,
      receiptIds,
    };
  } catch (error) {
    // FIX: same silent-catch issue as sendPushNotificationToUser above.
    console.error(
      `[Push] Failed to send push notifications to users:`,
      userIds,
      error,
    );
    return {
      message: "Failed to send push notifications",
    };
  }
};

const sendPushNotificationToRole = async (roleId, title, body, data = {}) => {
  try {
    const users = await User.findAll({ where: { roleId: roleId } });
    if (users.length === 0) {
      return {
        message: `No users found with role: ${role}`,
      };
    }

    const userIds = users.map((u) => u.id);
    return await sendPushNotificationToMultipleUsers(
      userIds,
      title,
      body,
      data,
    );
  } catch (error) {
    console.error(
      `[Push] Failed to send push notification to role ${roleId}:`,
      error,
    );
    return {
      message: "Failed to send push notification to role",
    };
  }
};

module.exports = {
  sendPushNotificationToMultipleUsers,
  sendPushNotificationToRole,
  sendPushNotificationToUser,
};
