// controllers/messagesController.js
const db = require("../models/index");
const Conversation = db.conversations;
const ConversationParticipant = db.conversationparticipants;
const Message = db.messages;
const MessageAttachment = db.messageattachments;
const Driver = db.drivers;
const User = db.users;
const Vehicle = db.vehicles;
const VehicleRoute = db.vehicleroutes;
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const messageNotificationService = require("../services/messageNotificationService");
const logAudit = require("../utils/logAudit");
const cleanupFiles = require("../utils/fileCleanupHelper");
const { ALLOWED_TYPES } = require("../config/multer");

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const syncGuardianToRouteChannel = async (
  routeId,
  guardianId,
  transaction = null,
) => {
  try {
    // Find existing route channel
    const routeChannel = await Conversation.findOne({
      where: { type: "route", routeId },
      transaction,
    });

    if (!routeChannel) {
      return false;
    }

    // Check if guardian is already a participant
    const existingParticipant = await ConversationParticipant.findOne({
      where: {
        conversationId: routeChannel.id,
        userId: guardianId,
      },
      transaction,
    });

    if (!existingParticipant) {
      // Add guardian to channel
      await ConversationParticipant.create(
        {
          conversationId: routeChannel.id,
          userId: guardianId,
          role: "member",
        },
        { transaction },
      );

      return true;
    }

    return false;
  } catch (error) {
    console.error("Error syncing guardian to route channel:", error);
    return false;
  }
};

// ─── Helper function to validate ID format ───────────────────────────────────
const isValidId = (id) => {
  if (!id) return false;
  // Check if it's a valid UUID format
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  // Check if it's a valid numeric ID
  const isNumeric = /^\d+$/.test(id);
  return isUUID || isNumeric;
};

// ─── Validate file uploads ───────────────────────────────────────────────
const validateFiles = (files) => {
  if (!files || files.length === 0) return { valid: true, files: [] };

  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

  for (const file of fileArray) {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File ${file.originalname} exceeds maximum size of 10MB`,
      };
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not allowed for ${file.originalname}`,
      };
    }
  }

  return { valid: true, files: fileArray };
};

// ─── Get all conversations for the current user ───────────────────────────────
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const myParticipations = await ConversationParticipant.findAll({
      where: { userId, isActive: true },
      attributes: ["conversationId"],
    });

    const conversationIds = myParticipations.map((p) => p.conversationId);

    if (conversationIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const conversations = await Conversation.findAll({
      where: { id: { [Op.in]: conversationIds } },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          required: false,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname"],
            },
          ],
        },
        {
          model: Message,
          as: "messages",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "fullname"],
            },
            {
              model: MessageAttachment,
              as: "attachments",
              attributes: [
                "id",
                "fileName",
                "filePath",
                "mimeType",
                "fileSize",
              ],
            },
          ],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "fullname"],
        },
        {
          model: db.vehicleroutes,
          as: "route",
          required: false,
          attributes: ["id", "routeNumber", "routeName", "routeType"],
          include: [
            {
              model: db.vehicles,
              as: "vehicle",
              attributes: ["id", "registrationNumber"],
            },
          ],
        },
      ],
      order: [["lastMessageAt", "DESC"]],
    });

    // Get unread counts in a single query for better performance
    const unreadCounts = await Message.findAll({
      attributes: [
        "conversationId",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "unreadCount"],
      ],
      where: {
        conversationId: { [Op.in]: conversationIds },
        senderId: { [Op.ne]: userId },
        isDeleted: false,
      },
      group: ["conversationId"],
      raw: true,
    });

    const unreadCountMap = {};
    unreadCounts.forEach((item) => {
      unreadCountMap[item.conversationId] = parseInt(item.unreadCount);
    });

    // Build conversations with details
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const myRecord = conv.participants.find((p) => p.userId === userId);
        const lastReadId = myRecord?.lastReadMessageId ?? null;

        // Filter unread count based on last read message
        let unreadCount = unreadCountMap[conv.id] || 0;
        if (lastReadId && unreadCount > 0) {
          const unreadMessages = await Message.count({
            where: {
              conversationId: conv.id,
              senderId: { [Op.ne]: userId },
              isDeleted: false,
              id: { [Op.gt]: lastReadId },
            },
          });
          unreadCount = unreadMessages;
        }

        let otherParticipant = null;
        if (conv.type === "private") {
          const other = conv.participants.find((p) => p.userId !== userId);
          otherParticipant = other?.user ?? null;

          if (!otherParticipant && other?.userId) {
            const u = await User.findByPk(other.userId, {
              attributes: ["id", "fullname"],
            });
            otherParticipant = u ? u.toJSON() : null;
          }
        }

        const convJson = conv.toJSON();
        return {
          ...convJson,
          unreadCount,
          otherParticipant,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: conversationsWithDetails,
    });
  } catch (error) {
    console.error("Error in getConversations:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch conversations",
    });
  }
};

const getAvailableRoutesForChannels = async (req, res) => {
  try {
    // Get all active routes that have at least one student assigned
    const routes = await db.vehicleroutes.findAll({
      where: { isActive: true },
      attributes: ["id", "routeNumber", "routeName", "routeType"],
      include: [
        {
          model: db.vehicles,
          as: "vehicle",
          attributes: ["id", "registrationNumber"],
        },
        {
          model: db.students,
          as: "students",
          attributes: ["id"],
          required: false,
        },
      ],
    });

    // Filter routes that have existing channels
    const routesWithChannels = await Conversation.findAll({
      where: { type: "route" },
      attributes: ["routeId"],
    });

    const channelRouteIds = new Set(routesWithChannels.map((r) => r.routeId));

    const formattedRoutes = routes.map((route) => ({
      id: route.id,
      routeNumber: route.routeNumber,
      routeName: route.routeName,
      routeType: route.routeType,
      vehicle: route.vehicle,
      studentCount: route.students?.length || 0,
      hasChannel: channelRouteIds.has(route.id),
    }));

    return res.status(200).json({
      success: true,
      data: formattedRoutes,
    });
  } catch (error) {
    console.error("Error in getAvailableRoutesForChannels:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch routes",
    });
  }
};

// ─── Get or create a private conversation ────────────────────────────────────
const getOrCreatePrivateConversation = async (req, res) => {
  const transaction = await db.sequelize.transaction({
    // Reduce isolation level to prevent deadlocks
    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;

    // Validate input
    if (!otherUserId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    if (currentUserId.toString() === otherUserId.toString()) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Cannot create conversation with yourself",
      });
    }

    const otherUser = await User.findByPk(otherUserId);
    if (!otherUser) {
      await transaction.rollback();
      return res.status(404).json({
        message: "User not found",
      });
    }

    const myConvIds = (
      await ConversationParticipant.findAll({
        where: { userId: currentUserId },
        attributes: ["conversationId"],
        transaction,
      })
    ).map((p) => p.conversationId);

    const otherConvIds = (
      await ConversationParticipant.findAll({
        where: { userId: otherUserId },
        attributes: ["conversationId"],
        transaction,
      })
    ).map((p) => p.conversationId);

    const sharedIds = myConvIds.filter((id) => otherConvIds.includes(id));

    let conversation = null;
    if (sharedIds.length > 0) {
      conversation = await Conversation.findOne({
        where: { id: { [Op.in]: sharedIds }, type: "private" },
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              { model: User, as: "user", attributes: ["id", "fullname"] },
            ],
          },
        ],
        transaction,
      });
    }

    if (!conversation) {
      const newConv = await Conversation.create(
        {
          type: "private",
          createdBy: currentUserId,
          lastMessageAt: new Date(),
        },
        { transaction },
      );

      await ConversationParticipant.bulkCreate(
        [
          { conversationId: newConv.id, userId: currentUserId, role: "member" },
          { conversationId: newConv.id, userId: otherUserId, role: "member" },
        ],
        { transaction },
      );

      conversation = await Conversation.findByPk(newConv.id, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              { model: User, as: "user", attributes: ["id", "fullname"] },
            ],
          },
        ],
        transaction,
      });
    }

    await transaction.commit();

    await logAudit({
      userId: user.id,
      action: "start_private_message",
      entity: "Private Message",
      entityId: conversation.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    const convJson = conversation.toJSON();
    const otherParticipant =
      convJson.participants.find((p) => p.userId !== currentUserId)?.user ??
      null;

    return res.status(200).json({
      success: true,
      data: { ...convJson, otherParticipant },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in getOrCreatePrivateConversation:", error);
    return res.status(500).json({
      message: "Server Error: Failed to get/create conversation",
    });
  }
};

// ─── Create class channel ─────────────────────────────────────────────────────
const createRouteChannel = async (req, res) => {
  const transaction = await db.sequelize.transaction({
    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { routeId, name } = req.body;
    const createdBy = req.user.id;

    // Validate input
    if (!routeId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Route ID is required",
      });
    }

    if (name && name.length > 100) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Channel name cannot exceed 100 characters",
      });
    }

    // Get the vehicle route
    const vehicleRoute = await db.vehicleroutes.findByPk(routeId, {
      include: [
        {
          model: db.vehicles,
          as: "vehicle",
          attributes: ["id", "registrationNumber"],
        },
      ],
      transaction,
    });

    if (!vehicleRoute) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Vehicle route not found",
      });
    }

    // Check if route channel already exists
    const existingChannel = await Conversation.findOne({
      where: { type: "route", routeId },
      transaction,
    });

    if (existingChannel) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Route channel already exists",
      });
    }

    // Create the conversation
    const conversation = await Conversation.create(
      {
        type: "route",
        name: name || `${vehicleRoute.routeName} Channel`,
        createdBy,
        routeId,
        lastMessageAt: new Date(),
      },
      { transaction },
    );

    // Get all students assigned to this route
    const students = await db.students.findAll({
      where: {
        vehicleRouteId: routeId,
        isActive: true,
      },
      include: [
        {
          model: db.guardians,
          as: "guardians",
          through: {
            model: db.guardianstudents,
            attributes: [],
          },
          required: true,
        },
      ],
      transaction,
    });

    // Collect all unique guardian user IDs
    const guardianUserIds = new Set();

    // Add the creator (likely admin or transport manager)
    guardianUserIds.add(createdBy);

    // Add all guardians
    for (const student of students) {
      if (student.guardians && student.guardians.length > 0) {
        for (const guardian of student.guardians) {
          if (guardian.userId) {
            guardianUserIds.add(guardian.userId);
          }
        }
      }
    }

    // Also add the vehicle driver if assigned
    if (vehicleRoute.vehicleId) {
      const vehicle = await db.vehicles.findAll({
        where: { id: vehicleRoute.vehicleId, isActive: true },
        attributes: ["driverId"],
        transaction,
      });

      for (const assignment of vehicle) {
        const driver = await db.drivers.findByPk(assignment.driverId, {
          attributes: ["userId"],
          transaction,
        });
        if (driver?.userId) {
          guardianUserIds.add(driver.userId);
        }
      }
    }

    // Validate all users exist
    const allUserIds = Array.from(guardianUserIds).filter(Boolean);
    const validUsers = await db.users.findAll({
      where: { id: { [Op.in]: allUserIds }, isActive: true },
      attributes: ["id"],
      transaction,
    });
    const validIds = new Set(validUsers.map((u) => u.id));

    // Create participants
    const participants = allUserIds
      .filter((uid) => validIds.has(uid))
      .map((uid) => ({
        conversationId: conversation.id,
        userId: uid,
        role: uid === createdBy ? "admin" : "member",
      }));

    if (participants.length > 0) {
      await ConversationParticipant.bulkCreate(participants, {
        ignoreDuplicates: true,
        transaction,
      });
    }

    await logAudit({
      userId: user.id,
      action: "create_route_channel",
      entity: "Route Channel",
      entityId: conversation.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
        routeId,
        participantCount: participants.length,
      },
    });

    await transaction.commit();

    // Fetch the complete conversation with route info
    const completeConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: db.vehicleroutes,
          as: "route",
          attributes: ["id", "routeNumber", "routeName", "routeType"],
          include: [
            {
              model: db.vehicles,
              as: "vehicle",
              attributes: ["id", "registrationNumber"],
            },
          ],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "fullname"],
        },
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Route channel created successfully",
      data: completeConversation,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in createRouteChannel:", error);
    return res.status(500).json({
      message: "Server Error: Failed to create route channel",
    });
  }
};

// ─── Get messages for a conversation ─────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Validate input using the helper function
    if (!isValidId(conversationId)) {
      return res.status(400).json({
        message: "Valid conversation ID is required",
      });
    }

    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({
        message: "You are not a participant in this conversation",
      });
    }

    const messages = await Message.findAndCountAll({
      where: {
        conversationId,
        [Op.or]: [
          { isDeleted: false },
          { isDeleted: true, deletedFor: { [Op.notLike]: `%"${userId}"%` } },
        ],
      },
      include: [
        { model: User, as: "sender", attributes: ["id", "fullname"] },
        {
          model: MessageAttachment,
          as: "attachments",
          attributes: ["id", "fileName", "filePath", "mimeType", "fileSize"],
        },
      ],
      order: [["createdAt", "ASC"]],
      limit,
      offset,
    });

    // Mark as delivered (no transaction needed for this)
    const undeliveredMessages = await Message.findAll({
      where: {
        conversationId,
        senderId: { [Op.ne]: userId },
        [Op.or]: [
          { deliveredTo: null },
          { deliveredTo: { [Op.notLike]: `%"${userId}"%` } },
        ],
      },
    });

    for (const msg of undeliveredMessages) {
      const deliveredTo = msg.deliveredTo || [];
      if (!deliveredTo.includes(userId)) {
        deliveredTo.push(userId);
        await msg.update({ deliveredTo });
      }
    }

    // Update last read (no transaction needed for this)
    if (messages.rows.length > 0) {
      await participant.update({
        lastReadMessageId: messages.rows[messages.rows.length - 1].id,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        items: messages.rows,
        total: messages.count,
        page,
        totalPages: Math.ceil(messages.count / limit),
      },
    });
  } catch (error) {
    console.error("Error in getMessages:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch messages",
    });
  }
};

// ─── Send message with improved transaction handling ─────────────────────────
const sendMessage = async (req, res) => {
  // Use a shorter timeout for transaction to prevent long locks
  const transaction = await db.sequelize.transaction({
    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    // Set a shorter lock timeout (5 seconds)
    lock: false,
  });

  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { conversationId } = req.params;
    const { message, messageType = "text" } = req.body;
    const senderId = req.user.id;
    const files = req.files || [];

    // Validate input
    if (!isValidId(conversationId)) {
      await transaction.rollback();
      cleanupFiles(files);
      return res.status(400).json({
        message: "Valid conversation ID is required",
      });
    }

    if (!message && files.length === 0) {
      await transaction.rollback();
      cleanupFiles(files);
      return res.status(400).json({
        message: "Message or attachment is required",
      });
    }

    // Validate files
    const fileValidation = validateFiles(files);
    if (!fileValidation.valid) {
      await transaction.rollback();
      cleanupFiles(files);
      return res.status(400).json({
        message: fileValidation.error,
      });
    }

    // Check if participant exists (use a simple query outside transaction for faster check)
    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId: senderId },
    });

    if (!participant) {
      await transaction.rollback();
      cleanupFiles(files);
      return res.status(403).json({
        message: "You are not a participant in this conversation",
      });
    }

    // Get conversation to verify it exists
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      await transaction.rollback();
      cleanupFiles(files);
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    let finalMessageType = messageType;
    if (files.length > 0) {
      finalMessageType = files.some((f) => f.mimetype.startsWith("image/"))
        ? "image"
        : "file";
    }

    // Create message
    const newMessage = await Message.create(
      {
        conversationId,
        senderId,
        message: message || null,
        messageType: finalMessageType,
        deliveredTo: [senderId],
        readBy: [senderId],
      },
      { transaction },
    );

    // Save attachments
    if (files.length > 0) {
      for (const file of files) {
        await MessageAttachment.create(
          {
            messageId: newMessage.id,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
          },
          { transaction },
        );
      }
    }

    // Update conversation - Use a separate query without transaction to avoid lock
    // First commit the current transaction
    await transaction.commit();

    // Then update the conversation separately (outside transaction)
    try {
      await Conversation.update(
        { lastMessageAt: new Date() },
        {
          where: { id: conversationId },
          // Add a small timeout to prevent lock issues
          timeout: 5000,
        },
      );
    } catch (updateError) {
      console.error("Error updating conversation (non-critical):", updateError);
      // Don't fail the message send if conversation update fails
      // This is a non-critical operation
    }

    // Fetch complete message
    const createdMessage = await Message.findByPk(newMessage.id, {
      include: [
        { model: User, as: "sender", attributes: ["id", "fullname"] },
        {
          model: MessageAttachment,
          as: "attachments",
          attributes: ["id", "fileName", "filePath", "mimeType", "fileSize"],
        },
      ],
    });

    const io = req.app.get("io");

    io.to(`conversation-${conversationId}`).emit("new-message", {
      conversationId,
      message: createdMessage, // the full message object with sender, attachments etc.
    });

    // Send notifications (non-blocking, don't await)
    try {
      const io = req.app.get("io");
      const sender = await User.findByPk(senderId, {
        attributes: ["id", "fullname", "email"],
      });

      // Don't await - send notifications in background
      messageNotificationService
        .sendNewMessageNotification(createdMessage, conversation, sender, io)
        .catch((err) => console.error("Notification error:", err));
    } catch (notificationError) {
      console.error("Error sending message notifications:", notificationError);
      // Don't fail the request if notifications fail
    }

    // Log audit asynchronously
    await logAudit({
      userId: user.id,
      action: "message_sent",
      entity: "Message",
      entityId: createdMessage.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: createdMessage,
    });
  } catch (error) {
    await transaction.rollback();
    cleanupFiles(req.files);
    console.error("Detailed error in sendMessage:", error);
    console.error("Error stack:", error.stack);

    return res.status(500).json({
      message: `Server Error: ${error.message || "Failed to send message"}`,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── Mark messages as read ────────────────────────────────────────────────────
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Validate input
    if (!isValidId(conversationId)) {
      return res.status(400).json({
        message: "Valid conversation ID is required",
      });
    }

    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({
        message: "You are not a participant in this conversation",
      });
    }

    const latestMessage = await Message.findOne({
      where: { conversationId },
      order: [["createdAt", "DESC"]],
    });

    if (latestMessage) {
      await participant.update({
        lastReadMessageId: latestMessage.id,
      });

      // Update read status for messages (do in batches to avoid locks)
      const unreadMessages = await Message.findAll({
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          [Op.or]: [
            { readBy: null },
            { readBy: { [Op.notLike]: `%"${userId}"%` } },
          ],
        },
        limit: 100, // Limit to prevent locking too many rows
      });

      for (const msg of unreadMessages) {
        const readBy = msg.readBy || [];
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          await msg.update({ readBy });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Error in markAsRead:", error);
    return res.status(500).json({
      message: "Server Error: Failed to mark messages as read",
    });
  }
};

// ─── Delete message ───────────────────────────────────────────────────────────
const deleteMessage = async (req, res) => {
  const transaction = await db.sequelize.transaction({
    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!messageId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Message ID is required",
      });
    }

    const message = await Message.findByPk(messageId, {
      include: [{ model: MessageAttachment, as: "attachments" }],
      transaction,
    });

    if (!message) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const participant = await ConversationParticipant.findOne({
      where: { conversationId: message.conversationId, userId },
      transaction,
    });

    if (!participant && message.senderId !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        message: "You don't have permission to delete this message",
      });
    }

    if (message.senderId === userId) {
      await message.update(
        { isDeleted: true, deletedFor: null },
        { transaction },
      );
    } else {
      const deletedFor = message.deletedFor || [];
      if (!deletedFor.includes(userId)) {
        deletedFor.push(userId);
        await message.update({ deletedFor }, { transaction });
      }
    }

    await logAudit({
      userId: user.id,
      action: "delete_message",
      entity: "Message",
      entityId: message.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in deleteMessage:", error);
    return res.status(500).json({
      message: "Server Error: Failed to delete message",
    });
  }
};

// ─── Get message attachments ──────────────────────────────────────────────────
const getMessageAttachments = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        message: "Message ID is required",
      });
    }

    const attachments = await MessageAttachment.findAll({
      where: { messageId, isActive: true },
      attributes: [
        "id",
        "fileName",
        "filePath",
        "mimeType",
        "fileSize",
        "createdAt",
      ],
    });

    return res.status(200).json({
      success: true,
      data: attachments,
    });
  } catch (error) {
    console.error("Error in getMessageAttachments:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch attachments",
    });
  }
};

// ─── Download attachment ──────────────────────────────────────────────────────
const downloadAttachment = async (req, res) => {
  const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { attachmentId } = req.params;

    if (!attachmentId) {
      return res.status(400).json({
        message: "Attachment ID is required",
      });
    }

    const attachment = await MessageAttachment.findByPk(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        message: "Attachment not found",
      });
    }

    const filePath = path.resolve(attachment.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "File not found on server",
      });
    }

    res.download(filePath, attachment.fileName);

    await logAudit({
      userId: user.id,
      action: "download_message_attachment",
      entity: "Message Files",
      entityId: attachment.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in downloadAttachment:", error);
    return res.status(500).json({
      message: "Server Error: Failed to download attachment",
    });
  }
};

// Add this function to messagesController.js
const getGuardianRouteChannels = async (req, res) => {
  try {
    const userId = req.user.id;

    // First, get all route channels the user is part of
    const userParticipations = await ConversationParticipant.findAll({
      where: { userId, isActive: true },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { type: "route" },
          include: [
            {
              model: db.vehicleroutes,
              as: "route",
              attributes: ["id", "routeNumber", "routeName", "routeType"],
              include: [
                {
                  model: db.vehicles,
                  as: "vehicle",
                  attributes: ["id", "registrationNumber"],
                },
              ],
            },
            {
              model: User,
              as: "creator",
              attributes: ["id", "fullname"],
            },
            {
              model: Message,
              as: "messages",
              separate: true,
              limit: 1,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: User,
                  as: "sender",
                  attributes: ["id", "fullname"],
                },
                {
                  model: MessageAttachment,
                  as: "attachments",
                  attributes: [
                    "id",
                    "fileName",
                    "filePath",
                    "mimeType",
                    "fileSize",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // Get unread counts
    const conversationIds = userParticipations.map((p) => p.conversationId);
    const unreadCounts = await Message.findAll({
      attributes: [
        "conversationId",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "unreadCount"],
      ],
      where: {
        conversationId: { [Op.in]: conversationIds },
        senderId: { [Op.ne]: userId },
        isDeleted: false,
      },
      group: ["conversationId"],
      raw: true,
    });

    const unreadCountMap = {};
    unreadCounts.forEach((item) => {
      unreadCountMap[item.conversationId] = parseInt(item.unreadCount);
    });

    const conversationsWithDetails = await Promise.all(
      userParticipations.map(async (participation) => {
        const conversation = participation.conversation;
        if (!conversation) return null;

        const convJson = conversation.toJSON();
        const lastReadId = participation.lastReadMessageId ?? null;

        let unreadCount = unreadCountMap[convJson.id] || 0;
        if (lastReadId && unreadCount > 0) {
          const unreadMessages = await Message.count({
            where: {
              conversationId: convJson.id,
              senderId: { [Op.ne]: userId },
              isDeleted: false,
              id: { [Op.gt]: lastReadId },
            },
          });
          unreadCount = unreadMessages;
        }

        return {
          ...convJson,
          unreadCount,
        };
      }),
    );

    const validConversations = conversationsWithDetails.filter(
      (c) => c !== null,
    );

    return res.status(200).json({
      success: true,
      data: validConversations,
    });
  } catch (error) {
    console.error("Error in getGuardianRouteChannels:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch route channels",
    });
  }
};

const getDriverRoutes = async (req, res) => {
  const { id } = req.user;

  try {
    const driver = await Driver.findOne({ where: { userId: id } });
    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    // Get ALL vehicles for this driver
    const vehicles = await Vehicle.findAll({ where: { driverId: driver.id } });

    if (vehicles.length === 0) {
      return res.status(200).json([]);
    }

    const vehicleIds = vehicles.map((v) => v.id);

    // Fetch all routes for any of those vehicles
    const routes = await VehicleRoute.findAll({
      where: { isActive: true, vehicleId: { [Op.in]: vehicleIds } },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: Driver,
              as: "driver",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
      ],
      order: [["routeNumber", "ASC"]],
    });

    const routeIds = routes.map((r) => r.id);
    const existingChannels = await Conversation.findAll({
      where: { type: "route", routeId: { [Op.in]: routeIds } },
      attributes: ["routeId", "id"],
    });

    const channelMap = {};
    existingChannels.forEach((channel) => {
      channelMap[channel.routeId] = channel.id;
    });

    const formattedRoutes = routes.map((route) => ({
      routeId: route.id,
      routeNumber: route.routeNumber,
      routeName: route.routeName,
      routeType: route.routeType,
      vehicleId: route.vehicleId,
      registrationNumber: route.vehicle?.registrationNumber || "N/A",
      hasChannel: !!channelMap[route.id],
      conversationId: channelMap[route.id] || null,
    }));

    return res.status(200).json(formattedRoutes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getRouteGuardians = async (req, res) => {
  try {
    const { id } = req.user;
    const { routeId } = req.params;

    const driver = await Driver.findOne({
      where: { userId: id, isActive: true },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const vehicle = await Vehicle.findOne({
      where: { driverId: driver.id, isActive: true },
    });

    if (!vehicle) {
      return res.status(404).json({ message: "No vehicle found" });
    }

    const route = await VehicleRoute.findOne({
      where: {
        id: routeId,
        vehicleId: vehicle.id,
        isActive: true,
      },
    });

    if (!route) {
      return res.status(403).json({
        message: "You are not assigned to this route",
      });
    }

    const students = await db.students.findAll({
      where: {
        vehicleRouteId: routeId,
        isActive: true,
      },
      include: [
        {
          model: db.guardians,
          as: "guardians",
          through: {
            model: db.guardianstudents,
          },
          include: [
            {
              model: db.users,
              as: "user",
              attributes: ["id", "fullname", "email"],
            },
          ],
        },
      ],
    });

    const guardiansData = [];
    const processedGuardians = new Set();

    for (const student of students) {
      for (const guardian of student.guardians || []) {
        if (guardian.userId && !processedGuardians.has(guardian.userId)) {
          processedGuardians.add(guardian.userId);

          // Check if a private conversation exists between driver and guardian
          const myConvIds = await ConversationParticipant.findAll({
            where: { userId: id },
            attributes: ["conversationId"],
          });

          const otherConvIds = await ConversationParticipant.findAll({
            where: { userId: guardian.userId },
            attributes: ["conversationId"],
          });

          const myIds = myConvIds.map((p) => p.conversationId);
          const otherIds = otherConvIds.map((p) => p.conversationId);
          const sharedIds = myIds.filter((id) => otherIds.includes(id));

          let existingConversation = null;
          if (sharedIds.length > 0) {
            existingConversation = await Conversation.findOne({
              where: {
                id: { [Op.in]: sharedIds },
                type: "private",
              },
              attributes: ["id"],
            });
          }

          guardiansData.push({
            guardianId: guardian.id,
            userId: guardian.userId,
            name: guardian.user?.fullname || "Unknown Guardian",
            email: guardian.user?.email,
            relationship: guardian.relationship || "Guardian",
            studentName: `${student.fullname}`,
            existingConversationId: existingConversation?.id || null,
          });
        }
      }
    }

    return res.status(200).json(guardiansData);
  } catch (error) {
    console.error("Error in getRouteGuardians:", error);
    return res.status(500).json({
      message: "Server Error: Failed to fetch guardians",
    });
  }
};

// ─── Leave/Delete conversation for user ──────────────────────────────────────
const leaveConversation = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({
        message: "You are not a participant in this conversation",
      });
    }

    // Mark as inactive (soft delete for this user)
    await participant.update({ isActive: false });

    // Optionally, if it's a private conversation and both participants are inactive, we could delete the conversation,
    // but we'll keep it simple.

    return res.status(200).json({
      success: true,
      message: "Left conversation successfully",
    });
  } catch (error) {
    console.error("Error in leaveConversation:", error);
    return res.status(500).json({
      message: "Server Error: Failed to leave conversation",
    });
  }
};

module.exports = {
  getConversations,
  getOrCreatePrivateConversation,
  createRouteChannel,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  getMessageAttachments,
  downloadAttachment,
  getAvailableRoutesForChannels,
  syncGuardianToRouteChannel,
  getGuardianRouteChannels,
  leaveConversation,
  getDriverRoutes,
  getRouteGuardians,
};
