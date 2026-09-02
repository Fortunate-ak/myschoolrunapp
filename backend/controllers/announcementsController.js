const db = require("../models/index");
const Announcement = db.announcements;
const User = db.users;
const {
  createAnnouncementNotification,
} = require("../services/announcementsNotificationService");
const logAudit = require("../utils/logAudit");

const createAnnouncement = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const {
      message,
      priority,
      audienceType,
      audienceIds,
      isActive = true,
    } = req.body;
    const authorId = req.user.id;

    const announcement = await Announcement.create(
      { authorId, message, priority, audienceType, audienceIds, isActive },
      { transaction },
    );

    await transaction.commit(); // commit FIRST

    const announcementWithAuthor = await Announcement.findByPk(
      announcement.id,
      {
        include: [
          {
            model: User,
            as: "author",
            attributes: ["id", "fullname", "email"],
          },
        ],
      },
    );

    if (announcement.isActive) {
      // NOW the announcement exists in DB, notification service can find it
      if (req.io) {
        await createAnnouncementNotification(
          announcementWithAuthor,
          audienceType,
          audienceIds,
          req.io,
        );
      } else {
        console.warn("Socket.io not available for announcements");
        // You might want to queue these notifications for later delivery
        // or handle them differently
      }
    }

    await logAudit({
      userId: user.id,
      entity: "Announcements",
      action: "Create Announcement",
      entityId: announcement.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(201).json(announcementWithAuthor);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json("Server error: Failed to create announcement");
  }
};

const updateAnnouncement = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;
  try {
    const announcement = await Announcement.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!announcement) {
      await transaction.rollback();
      return res.status(404).json({ message: "Announcement not found!" });
    }

    if (announcement.authorId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ message: "Forbidden" });
    }

    const updates = req.body;

    const allowedFields = [
      "message",
      "audienceType",
      "audienceIds",
      "priority",
      "isActive",
    ];

    const audienceChanged =
      updates.audienceType &&
      updates.audienceType !== announcement.audienceType;

    const statusChanged =
      updates.isActive !== undefined &&
      updates.isActive !== announcement.isActive;

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        announcement[field] = updates[field];
      }
    });

    await announcement.save({ transaction });

    if ((statusChanged && announcement.isActive) || audienceChanged) {
      await createAnnouncementNotification(
        announcement,
        announcement.audienceType,
        announcement.audienceIds,
        req.io,
      );
    }
    await transaction.commit();

    await logAudit({
      userId: user.id,
      entity: "Announcements",
      action: "Update Announcement",
      entityId: announcement.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json(announcement);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Internal server error: Failed to update announcement",
    });
  }
};

const getAllAnnouncements = async (req, res) => {
  try {
    const { audienceType } = req.query;
    const user = req.user;
    const userRole = user.role?.name || user.role;
    const userId = user.id;

    // Base where clause
    const whereClause = {};

    // If query param has audienceType, add it to filter
    if (audienceType) {
      whereClause.audienceType = audienceType;
    }

    // If user is NOT admin, apply audience filtering
    if (userRole !== "admin" && userRole !== "super_admin") {
      // Build OR conditions for different audience types
      const audienceConditions = [];

      // 1. Everyone announcements
      audienceConditions.push({ audienceType: "all" });

      // 2. Role-based announcements (specific roles like teacher, student, etc.)
      audienceConditions.push({
        audienceType: "multiple_roles",
        // For MySQL, we need to use JSON_SEARCH or JSON_CONTAINS
        [db.Sequelize.Op.and]: db.sequelize.literal(
          `JSON_CONTAINS(audienceIds, '"${user.roleId}"')`,
        ),
      });

      // 3. Legacy role-based announcements (single role)
      audienceConditions.push({ audienceType: userRole });

      // 4. Class-based announcements (for students)
      if (userRole === "student") {
        // Get the student's class ID
        const student = await db.students.findOne({
          where: { userId: userId },
          attributes: ["classId"],
        });

        if (student && student.classId) {
          audienceConditions.push({
            audienceType: "specific_class",
            [db.Sequelize.Op.and]: db.sequelize.literal(
              `JSON_CONTAINS(audienceIds, '"${student.classId}"')`,
            ),
          });
        }
      }

      // 5. Grade-based announcements (for students)
      if (userRole === "student") {
        const student = await db.students.findOne({
          where: { userId: userId },
          include: [
            {
              model: db.classes,
              as: "class",
              attributes: ["gradeId"],
            },
          ],
        });

        if (student?.class?.gradeId) {
          audienceConditions.push({
            audienceType: "specific_grade",
            [db.Sequelize.Op.and]: db.sequelize.literal(
              `JSON_CONTAINS(audienceIds, '"${student.class.gradeId}"')`,
            ),
          });
        }
      }

      // 6. Teacher-specific announcements
      if (userRole === "teacher") {
        const teacherClasses = await db.classes.findAll({
          where: { classTeacherId: userId },
          attributes: ["id"],
        });

        if (teacherClasses.length > 0) {
          const classIds = teacherClasses.map((c) => c.id);
          // For multiple IDs, we need to check if any ID exists in the JSON array
          const classConditions = classIds.map((classId) =>
            db.sequelize.literal(`JSON_CONTAINS(audienceIds, '"${classId}"')`),
          );

          audienceConditions.push({
            audienceType: "specific_class",
            [db.Sequelize.Op.or]: classConditions,
          });
        }
      }

      // 7. Guardian-specific announcements
      if (userRole === "guardian") {
        // Get students linked to this guardian
        const guardian = await db.guardians.findOne({
          where: { userId: userId },
          include: [
            {
              model: db.students,
              as: "students",
              attributes: ["id", "classId"],
              through: { attributes: [] },
            },
          ],
        });

        if (guardian && guardian.students && guardian.students.length > 0) {
          const studentIds = guardian.students.map((s) => s.id);
          const classIds = guardian.students
            .filter((s) => s.classId)
            .map((s) => s.classId);

          // Announcements for specific classes of the guardian's children
          if (classIds.length > 0) {
            const classConditions = classIds.map((classId) =>
              db.sequelize.literal(
                `JSON_CONTAINS(audienceIds, '"${classId}"')`,
              ),
            );

            audienceConditions.push({
              audienceType: "specific_class",
              [db.Sequelize.Op.or]: classConditions,
            });
          }

          // Also show announcements that are specifically for guardians
          audienceConditions.push({ audienceType: "guardian" });
        }
      }

      // Apply OR conditions - but need to handle the literal conditions specially
      if (audienceConditions.length > 0) {
        // Separate regular conditions from literal conditions
        const regularConditions = [];
        const literalConditions = [];

        audienceConditions.forEach((condition) => {
          // Check if this condition has a literal value
          if (
            condition[db.Sequelize.Op.and] &&
            typeof condition[db.Sequelize.Op.and] === "object"
          ) {
            literalConditions.push(condition);
          } else {
            regularConditions.push(condition);
          }
        });

        if (regularConditions.length > 0 && literalConditions.length > 0) {
          whereClause[db.Sequelize.Op.or] = [
            ...regularConditions,
            ...literalConditions,
          ];
        } else if (regularConditions.length > 0) {
          whereClause[db.Sequelize.Op.or] = regularConditions;
        } else if (literalConditions.length > 0) {
          whereClause[db.Sequelize.Op.or] = literalConditions;
        }
      } else {
        // If no conditions, return empty array
        return res.status(200).json([]);
      }
    }

    const announcements = await Announcement.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ["id", "fullname", "email"],
          as: "author",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({
      message: "Internal server error: Failed to fetch announcements",
    });
  }
};

const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "fullname", "email"],
        },
      ],
    });

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found!" });
    }

    return res.status(200).json(announcement);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error: Failed to fetch announcement",
    });
  }
};

const deleteAnnouncement = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const announcement = await Announcement.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!announcement) {
      await transaction.rollback();
      return res.status(404).json({ message: "Announcement not found!" });
    }

    if (announcement.authorId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ message: "Forbidden" });
    }

    await announcement.destroy({ transaction });
    await transaction.commit();

    await logAudit({
      userId: user.id,
      entity: "Announcements",
      action: "Delete Announcement",
      entityId: announcement.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res
      .status(200)
      .json({ message: "Announcement deleted successfully!" });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Internal server error: Failed to delete announcement",
    });
  }
};

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  deleteAnnouncement,
};
