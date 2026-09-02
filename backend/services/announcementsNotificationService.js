const db = require("../models/index");
const { createNotification } = require("./notificationService");
const { announcementMessages } = require("./notificationMessages");

const Announcement = db.announcements;
const User = db.users;
const Role = db.role;
const Student = db.students;
const Class = db.classes;
const Notification = db.notifications;

/**
 * Instead of resolving individual userIds at creation time, we store the
 * roleId (or null for "all") on the notification record. On the socket side,
 * users join a room named `role-<roleId>` when they connect, so we can emit
 * to an entire role in one call without knowing who is online.
 *
 * For specific_class / specific_grade we still need to resolve to users since
 * there is no "class room" concept — but we bulk-insert those instead of
 * looping with individual createNotification calls.
 */
const createAnnouncementNotification = async (
  announcement,
  audienceType,
  audienceIds,
  io,
) => {
  try {
    if (!announcement) {
      throw new Error("Announcement not found");
    }

    const messageConfig = announcementMessages.new_announcement(announcement);

    const baseNotificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: messageConfig.notifType,
      entityType: "announcement",
      entityId: announcement.id,
      metadata: {
        announcementId: announcement.id,
        audienceType,
        authorName: announcement.author.fullname,
        message:
          announcement.message.substring(0, 100) +
          (announcement.message.length > 100 ? "..." : ""),
      },
    };

    switch (audienceType) {
      case "all": {
        /**
         * Store a single notification row with roleId = null, meaning it
         * targets everyone. Emit to the "role-all" room — all connected
         * users should join this room on socket connect regardless of role.
         */
        const notification = await createNotification({
          ...baseNotificationData,
          userId: null,
          roleId: null,
          isGlobal: true, // flag so the frontend/query knows this targets everyone
        });

        io.emit("new-notification", notification);
        return [notification];
      }

      case "student":
      case "teacher":
      case "guardian": {
        /**
         * Look up the role row so we have its UUID, then store one
         * notification record per role (not per user). Emit to the
         * `role-<roleId>` socket room.
         */
        const role = await Role.findOne({
          where: { name: audienceType },
          attributes: ["id"],
        });

        if (!role) {
          console.warn(`Role not found for audienceType: ${audienceType}`);
          return [];
        }

        const notification = await createNotification({
          ...baseNotificationData,
          userId: null,
          roleId: role.id,
        });

        // Users join room `role-<roleId>` on socket connect (see socket setup)
        io.to(`role-${role.id}`).emit("new-notification", notification);
        return [notification];
      }

      case "specific_class": {
        if (!audienceIds || audienceIds.length === 0) {
          console.warn("specific_class chosen but no audienceIds provided");
          return [];
        }

        /**
         * For specific classes we still need real userIds because there is
         * no generic "class role". We resolve them once, then bulk-insert
         * instead of looping.
         */
        const classes = await Class.findAll({
          where: { id: audienceIds },
          include: [
            {
              model: Student,
              as: "students",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname"],
                  where: { isActive: true },
                },
              ],
            },
          ],
        });

        const studentIds = [
          ...new Set(classes.flatMap((cls) => cls.students.map((s) => s.id))),
        ];

        if (studentIds.length === 0) return [];

        const records = studentIds.map((userId) => ({
          ...baseNotificationData,
          userId,
          roleId: null,
          metadata: {
            ...baseNotificationData.metadata,
            classIds: audienceIds,
          },
        }));

        const notifications = await bulkCreateNotifications(records);

        // Emit individually since each student has their own socket room
        notifications.forEach((notification) => {
          io.to(`user-${notification.userId}`).emit(
            "new-notification",
            notification,
          );
        });

        return notifications;
      }

      case "multiple_roles": {
        if (!audienceIds || audienceIds.length === 0) {
          console.warn("multiple_roles chosen but no audienceIds provided");
          return [];
        }

        // audienceIds contains role IDs
        const roles = await Role.findAll({
          where: { id: audienceIds },
          attributes: ["id", "name"],
        });

        const notifications = [];

        for (const role of roles) {
          const notification = await createNotification({
            ...baseNotificationData,
            userId: null,
            roleId: role.id,
            metadata: {
              ...baseNotificationData.metadata,
              roleIds: audienceIds,
            },
          });
          notifications.push(notification);
          io.to(`role-${role.id}`).emit("new-notification", notification);
        }

        return notifications;
      }

      case "specific_grade": {
        if (!audienceIds || audienceIds.length === 0) {
          console.warn("specific_grade chosen but no audienceIds provided");
          return [];
        }

        const classes = await Class.findAll({
          where: { gradeId: audienceIds },
          include: [
            {
              model: Student,
              as: "students",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname"],
                  where: { isActive: true },
                },
              ],
            },
          ],
        });

        const studentIds = [
          ...new Set(classes.flatMap((cls) => cls.students.map((s) => s.id))),
        ];

        if (studentIds.length === 0) return [];

        const records = studentIds.map((userId) => ({
          ...baseNotificationData,
          userId,
          roleId: null,
          metadata: {
            ...baseNotificationData.metadata,
            gradeIds: audienceIds,
          },
        }));

        const notifications = await bulkCreateNotifications(records);

        notifications.forEach((notification) => {
          io.to(`user-${notification.userId}`).emit(
            "new-notification",
            notification,
          );
        });

        return notifications;
      }

      default:
        console.warn(`Unknown audienceType: ${audienceType}`);
        return [];
    }
  } catch (error) {
    console.error("Error creating announcement notifications:", error);
    throw error;
  }
};

/**
 * Bulk-inserts notification records and returns them.
 * Falls back to individual inserts if your ORM setup doesn't support bulkCreate
 * with returning — adjust as needed.
 */
const bulkCreateNotifications = async (records) => {
  const Notification = db.notifications;
  return Notification.bulkCreate(records, { returning: true });
};

/**
 * Fetch all notification records for a given announcement + user.
 * Because role-based notifications have userId = null, we also pull those
 * where the user's roleId matches.
 */
const getAnnouncementNotifications = async (userId, announcementId) => {
  try {
    const user = await User.findByPk(userId, { attributes: ["roleId"] });

    const notifications = await Notification.findAll({
      where: {
        entityType: "announcement",
        entityId: announcementId,
        [db.Sequelize.Op.or]: [
          { userId }, // targeted directly (specific_class / grade)
          { roleId: user.roleId }, // targeted by role
          { isGlobal: true }, // broadcast to all
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    return notifications;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createAnnouncementNotification,
  getAnnouncementNotifications,
};
