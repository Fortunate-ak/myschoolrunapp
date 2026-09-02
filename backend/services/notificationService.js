// services/notificationService.js
const db = require("../models/index");
const { Op } = require("sequelize");
const {
  sendPushNotificationToUser,
  sendPushNotificationToMultipleUsers,
} = require("./pushNotificationService");
const Notification = db.notifications;
const User = db.users;
const Role = db.role;
const Student = db.students;
const Guardian = db.guardians;
const Vehicle = db.vehicles;
const VehicleRoute = db.vehicleroutes;

// ── Push notification wiring ────────────────────────────────────────────────
// Every notification created through this file already gets a DB row + a
// socket "new-notification" event. This section adds a real OS-level Expo
// push on top of that, using the same notificationData every call site
// already builds — no changes needed anywhere else, since notifyUser /
// notifyRole / notifyGuardiansOnVehicle / notifyMultipleUsers are the single
// choke point everything (SOS, delays, arrivals, trip start/end, alerts,
// guardian requests, messages, etc.) already funnels through.

// Maps entityType -> the Android notification channel configured client-side
// in utils/notifications.js (default, announcements, messages, alerts,
// tracking, requests). Falls back to "default" for anything unmapped.
const PUSH_CHANNEL_MAP = {
  vehicle_sos: "alerts",
  vehicle_delay: "alerts",
  vehicle_speeding: "alerts",
  vehicle_route_deviation: "alerts",
  vehicle_geofence_exit: "alerts",
  vehicle_maintenance_due: "alerts",
  vehicle_arrival: "tracking",
  vehicle_stop_arrival: "tracking",
  vehicle_departure: "tracking",
  trip_start: "tracking",
  trip_end: "tracking",
  announcement: "announcements",
  guardian_request: "requests",
  request_accepted: "requests",
  request_rejected: "requests",
  // ── Message types (added) ──────────────────────────────────────────────
  message: "messages",
  message_reply: "messages",
  mention: "messages",
  message_reaction: "messages",
  message_edit: "messages",
  file_share: "messages",
  urgent_message: "alerts", // or "messages" – up to you
  group_add: "announcements",
  message_summary: "messages",
  message_digest: "messages",
  broadcast: "announcements",
};

// entityTypes that fire far too often (every ~2s GPS ping, every ETA tick)
// to ever be worth an OS push — they'd spam the user and burn through
// Expo's rate limits for no benefit. These still get the DB row + socket
// event, just not a push.
const PUSH_EXCLUDED_ENTITY_TYPES = new Set(["vehicle_location", "vehicle_eta"]);

// Builds the `data` payload sent alongside the push. The client's
// notification handler (utils/notifications.js) reads data.type/data.priority
// to decide Android priority (MAX for type "alert"/"sos"/"message" or
// priority "urgent", HIGH for priority "high"), so we set those here based
// on notifType/entityType rather than duplicating that logic client-side.
const buildPushData = (notificationData) => {
  const { entityType, entityId, notifType, metadata } = notificationData;
  const channelId = PUSH_CHANNEL_MAP[entityType] || "default";

  const data = {
    entityType,
    entityId,
    channelId,
    ...metadata,
  };

  if (notifType === "emergency" || entityType === "vehicle_sos") {
    data.type = "sos";
  } else if (notifType === "warning") {
    data.type = "alert";
    data.priority = "high";
  }

  return data;
};

// Lets any call site opt a specific notification out of push (e.g. a future
// caller that wants an in-app-only notice) by passing `sendPush: false` in
// notificationData, on top of the blanket frequency-based exclusion above.
const shouldSendPush = (notificationData) =>
  notificationData?.sendPush !== false &&
  !PUSH_EXCLUDED_ENTITY_TYPES.has(notificationData?.entityType);

const createNotification = async (notificationData) => {
  return await Notification.create(notificationData);
};

// Notify a single, specific user — creates the persisted notification and,
// if a socket.io instance is available, emits it in real time to their
// personal room. Used for one-off events tied to a specific actor (e.g.
// a guardian request being sent/approved/rejected/cancelled) rather than
// broadcast-style notifications (notifyRole, notifyGuardiansOnVehicle).
const notifyUser = async (userId, notificationData, io) => {
  if (!userId) return null;

  const notification = await createNotification({
    userId,
    ...notificationData,
  });

  if (io) {
    io.to(`user-${userId}`).emit("new-notification", notification);
  }

  if (shouldSendPush(notificationData)) {
    await sendPushNotificationToUser(
      userId,
      notificationData.title,
      notificationData.message,
      { notificationId: notification.id, ...buildPushData(notificationData) },
    );
  }

  return notification;
};

// ── NEW: Notify multiple specific users at once ─────────────────────────────
const notifyMultipleUsers = async (userIds, notificationData, io) => {
  if (!userIds || userIds.length === 0) return [];

  // Deduplicate user IDs
  const uniqueUserIds = [...new Set(userIds)];

  const notifications = [];
  for (const userId of uniqueUserIds) {
    const notification = await createNotification({
      userId,
      ...notificationData,
    });
    notifications.push(notification);
    if (io) {
      io.to(`user-${userId}`).emit("new-notification", notification);
    }
  }

  if (shouldSendPush(notificationData)) {
    await sendPushNotificationToMultipleUsers(
      uniqueUserIds,
      notificationData.title,
      notificationData.message,
      buildPushData(notificationData),
    );
  }

  return notifications;
};

const notifyRole = async (roleName, notificationData, io) => {
  try {
    const staffUsers = await User.findAll({
      include: [
        {
          model: Role,
          as: "role",
          required: true,
          where: { name: roleName },
        },
      ],
    });

    const notifications = [];

    for (const user of staffUsers) {
      const notification = await createNotification({
        userId: user.id,
        ...notificationData,
      });

      notifications.push(notification);
      if (io) {
        io.to(`user-${user.id}`).emit("new-notification", notification);
      }
    }

    // One batched Expo call for every user in the role, rather than one
    // push call per user — same title/body/data for all of them, so this
    // is both fewer API calls and correctly chunked by sendPushNotificationToMultipleUsers.
    if (shouldSendPush(notificationData) && staffUsers.length) {
      await sendPushNotificationToMultipleUsers(
        staffUsers.map((u) => u.id),
        notificationData.title,
        notificationData.message,
        buildPushData(notificationData),
      );
    }

    return notifications;
  } catch (error) {
    console.error(`Error notifying ${roleName}:`, error);
    throw error;
  }
};

// FIXED: Correctly query guardians for students on a vehicle
const notifyGuardiansOnVehicle = async (vehicleId, notificationData, io) => {
  try {
    // Find the vehicle along with its active routes (Vehicle.hasMany
    // vehicleroutes, as: "routes"). Students are linked to a route directly
    // via Student.vehicleRouteId, so the vehicle's routes give us every
    // route this vehicle drives without touching a junction table.
    const vehicle = await Vehicle.findByPk(vehicleId, {
      include: [
        {
          model: VehicleRoute,
          as: "routes",
          where: { isActive: true },
          required: false,
          attributes: ["id"],
        },
      ],
    });

    if (!vehicle || !vehicle.routes?.length) {
      return [];
    }

    const routeIds = vehicle.routes.map((r) => r.id);

    // Find the students on those routes along with their guardians (via
    // Student's "guardians" belongsToMany alias, and Guardian's "user"
    // belongsTo alias)
    const students = await Student.findAll({
      where: {
        vehicleRouteId: { [Op.in]: routeIds },
        isActive: true,
      },
      include: [
        {
          model: Guardian,
          as: "guardians",
          required: true,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email", "phone"],
            },
          ],
        },
      ],
    });

    // Collect unique guardian user IDs
    const guardianUserIds = new Set();
    for (const student of students) {
      for (const guardian of student.guardians || []) {
        if (guardian.user?.id) {
          guardianUserIds.add(guardian.user.id);
        }
      }
    }

    const notifications = [];
    for (const guardianUserId of guardianUserIds) {
      const notification = await createNotification({
        userId: guardianUserId,
        ...notificationData,
        metadata: {
          ...notificationData.metadata,
          vehicleId,
        },
      });
      notifications.push(notification);

      if (io) {
        io.to(`user-${guardianUserId}`).emit("new-notification", notification);

        // Also emit vehicle-specific events
        if (notificationData.entityType === "vehicle_arrival") {
          io.to(`user-${guardianUserId}`).emit("vehicle-arrival", {
            type: "vehicle_arrival",
            data: notificationData.metadata,
          });
        } else if (notificationData.entityType === "vehicle_departure") {
          io.to(`user-${guardianUserId}`).emit("vehicle-departure", {
            type: "vehicle_departure",
            data: notificationData.metadata,
          });
        } else if (notificationData.entityType === "vehicle_delay") {
          io.to(`user-${guardianUserId}`).emit("vehicle-delayed", {
            type: "vehicle_delay",
            data: notificationData.metadata,
          });
        } else if (notificationData.entityType === "vehicle_sos") {
          io.to(`user-${guardianUserId}`).emit("driver-sos", {
            type: "sos",
            data: notificationData.metadata,
          });
        } else if (notificationData.entityType === "vehicle_location") {
          io.to(`user-${guardianUserId}`).emit("vehicle-location-update", {
            type: "location_update",
            data: notificationData.metadata,
          });
        } else if (notificationData.entityType === "vehicle_eta") {
          io.to(`user-${guardianUserId}`).emit("vehicle-eta-update", {
            type: "eta_update",
            data: notificationData.metadata,
          });
        }
      }
    }

    if (shouldSendPush(notificationData) && guardianUserIds.size) {
      await sendPushNotificationToMultipleUsers(
        [...guardianUserIds],
        notificationData.title,
        notificationData.message,
        buildPushData({
          ...notificationData,
          metadata: { ...notificationData.metadata, vehicleId },
        }),
      );
    }

    console.log(
      `Notified ${guardianUserIds.size} guardians for vehicle ${vehicleId}`,
    );
    return notifications;
  } catch (error) {
    console.error("Error notifying guardians on vehicle:", error);
    throw error;
  }
};

const notifyMultipleRoles = async (roleNames, notificationData, io) => {
  try {
    const staffUsers = await User.findAll({
      include: [
        {
          model: Role,
          as: "role",
          required: true,
          where: { name: roleNames },
        },
      ],
    });

    const notifications = [];

    for (const user of staffUsers) {
      const notification = await createNotification({
        userId: user.id,
        ...notificationData,
      });

      notifications.push(notification);
      if (io) {
        io.to(`user-${user.id}`).emit("new-notification", notification);
      }
    }

    if (shouldSendPush(notificationData) && staffUsers.length) {
      await sendPushNotificationToMultipleUsers(
        staffUsers.map((u) => u.id),
        notificationData.title,
        notificationData.message,
        buildPushData(notificationData),
      );
    }

    return notifications;
  } catch (error) {
    console.error(`Error notifying roles ${roleNames}:`, error);
    throw error;
  }
};

const getUserNotifications = async (
  userId,
  page = 1,
  limit = 50,
  filter = "all",
) => {
  try {
    const offset = (page - 1) * limit;

    const whereClause = { userId };
    if (filter === "unread") {
      whereClause.isRead = false;
    } else if (filter === "read") {
      whereClause.isRead = true;
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const unreadCount = await Notification.count({
      where: { userId, isRead: false },
    });

    return {
      success: true,
      notifications: notifications.map((notif) => ({
        ...notif.toJSON(),
        type: notif.notifType,
      })),
      unreadCount,
      total: count,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: limit,
      },
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
};

const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    await notification.update({
      isRead: true,
      readAt: new Date(),
    });

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

const markAllAsRead = async (userId) => {
  const transaction = await db.sequelize.transaction();
  try {
    await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId,
          isRead: false,
        },
        transaction,
      },
    );

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new Error("Notification not found");
    }
    await notification.destroy();
    return true;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

module.exports = {
  markAllAsRead,
  markAsRead,
  createNotification,
  notifyUser,
  notifyMultipleUsers, // <-- NEW export
  notifyMultipleRoles,
  getUserNotifications,
  notifyRole,
  notifyGuardiansOnVehicle,
  deleteNotification,
};
