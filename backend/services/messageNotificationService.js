// services/messageNotificationService.js
const db = require("../models/index");
const {
  createNotification,
  notifyUser, // <-- added
  notifyMultipleUsers, // <-- added
  notifyRole,
  notifyMultipleRoles,
} = require("./notificationService");
const { messageNotificationMessages } = require("./notificationMessages");
const { Op } = require("sequelize");

const Conversation = db.conversations;
const Message = db.messages;
const User = db.users;
const ConversationParticipant = db.conversationparticipants;
const MessageAttachment = db.messageattachments;

/**
 * Send notification when a new message is received
 */
const sendNewMessageNotification = async (
  message,
  conversation,
  sender,
  io,
) => {
  try {
    // Get all participants except the sender
    const participants = await ConversationParticipant.findAll({
      where: {
        conversationId: conversation.id,
        userId: { [Op.ne]: sender.id },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email"],
        },
      ],
    });

    if (participants.length === 0) {
      return [];
    }

    // Determine message preview
    let messagePreview = message.message;
    let attachmentInfo = null;

    if (message.messageType === "image") {
      messagePreview = "📷 Photo";
      const attachments = await MessageAttachment.findAll({
        where: { messageId: message.id },
      });
      attachmentInfo = {
        count: attachments.length,
        type: "image",
      };
    } else if (message.messageType === "file") {
      messagePreview = "📎 File";
      const attachments = await MessageAttachment.findAll({
        where: { messageId: message.id },
      });
      attachmentInfo = {
        count: attachments.length,
        fileName: attachments[0]?.fileName,
        fileSize: attachments[0]?.fileSize,
      };
    }

    const conversationName =
      conversation.type === "private"
        ? sender.fullname
        : conversation.name || "Group Conversation";

    const messageConfig = messageNotificationMessages.new_message(
      sender,
      messagePreview,
      conversationName,
      conversation.type,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: messageConfig.notifType,
      entityType: "message",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        conversationType: conversation.type,
        conversationName: conversationName,
        senderId: sender.id,
        senderName: sender.fullname,
        messageId: message.id,
        messageType: message.messageType,
        messagePreview: messagePreview?.substring(0, 100),
        hasAttachments: attachmentInfo !== null,
        attachmentInfo: attachmentInfo,
        createdAt: message.createdAt,
        isReply: !!message.replyToId,
      },
    };

    // Collect user IDs of participants
    const userIds = participants.map((p) => p.user?.id).filter(Boolean);

    // Send to all participants using the batched helper (DB + socket + push)
    const notifications = await notifyMultipleUsers(
      userIds,
      notificationData,
      io,
    );

    return notifications;
  } catch (error) {
    console.error("Error sending new message notification:", error);
    throw error;
  }
};

/**
 * Send notification when a message is replied to
 */
const sendMessageReplyNotification = async (
  originalMessage,
  replyMessage,
  sender,
  io,
) => {
  try {
    const originalSender = await User.findByPk(originalMessage.senderId, {
      attributes: ["id", "fullname"],
    });

    if (!originalSender || originalSender.id === sender.id) {
      return []; // Don't notify if replying to own message
    }

    const conversation = await Conversation.findByPk(
      originalMessage.conversationId,
    );

    const messageConfig = messageNotificationMessages.message_reply(
      sender,
      originalSender,
      replyMessage.message?.substring(0, 50),
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "message_reply",
      entityId: replyMessage.id,
      metadata: {
        conversationId: originalMessage.conversationId,
        originalMessageId: originalMessage.id,
        replyMessageId: replyMessage.id,
        senderId: sender.id,
        senderName: sender.fullname,
        originalSenderId: originalSender.id,
        originalSenderName: originalSender.fullname,
        replyPreview: replyMessage.message?.substring(0, 100),
        conversationType: conversation.type,
        conversationName: conversation.name,
      },
    };

    // Notify only the original sender
    const notification = await notifyUser(
      originalSender.id,
      notificationData,
      io,
    );

    return notification ? [notification] : [];
  } catch (error) {
    console.error("Error sending message reply notification:", error);
    throw error;
  }
};

/**
 * Send notification when someone is added to a group conversation
 */
const sendAddedToGroupNotification = async (
  conversation,
  addedBy,
  newParticipantIds,
  io,
) => {
  try {
    const notifications = [];
    const userIds = [];

    for (const newUserId of newParticipantIds) {
      const newUser = await User.findByPk(newUserId, {
        attributes: ["id", "fullname"],
      });

      if (!newUser) continue;

      const messageConfig = messageNotificationMessages.added_to_group(
        addedBy,
        conversation.name || "Group",
      );

      const notificationData = {
        title: messageConfig.title,
        message: messageConfig.message,
        notifType: "info",
        entityType: "group_add",
        entityId: conversation.id,
        metadata: {
          conversationId: conversation.id,
          conversationName: conversation.name,
          addedById: addedBy.id,
          addedByName: addedBy.fullname,
          addedAt: new Date(),
        },
      };

      // Collect user IDs for batch sending
      userIds.push(newUserId);
    }

    if (userIds.length === 0) return [];

    // Send one notification (same data) to all new participants
    const notificationData = {
      title: messageNotificationMessages.added_to_group(
        addedBy,
        conversation.name || "Group",
      ).title,
      message: messageNotificationMessages.added_to_group(
        addedBy,
        conversation.name || "Group",
      ).message,
      notifType: "info",
      entityType: "group_add",
      entityId: conversation.id,
      metadata: {
        conversationId: conversation.id,
        conversationName: conversation.name,
        addedById: addedBy.id,
        addedByName: addedBy.fullname,
        addedAt: new Date(),
      },
    };

    const createdNotifications = await notifyMultipleUsers(
      userIds,
      notificationData,
      io,
    );

    return createdNotifications;
  } catch (error) {
    console.error("Error sending added to group notification:", error);
    throw error;
  }
};

/**
 * Send notification when someone is mentioned in a message
 */
const sendMentionNotification = async (
  message,
  mentionedUsers,
  sender,
  conversation,
  io,
) => {
  try {
    const userIds = [];
    const messagePreview = message.message?.substring(0, 100);

    // Filter out self-mentions
    const targetUsers = mentionedUsers.filter((u) => u.id !== sender.id);

    if (targetUsers.length === 0) return [];

    const notificationData = {
      title: messageNotificationMessages.mentioned_in_message(
        sender,
        messagePreview,
        conversation.name || "a conversation",
      ).title,
      message: messageNotificationMessages.mentioned_in_message(
        sender,
        messagePreview,
        conversation.name || "a conversation",
      ).message,
      notifType: "mention",
      entityType: "mention",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        conversationName: conversation.name,
        messageId: message.id,
        senderId: sender.id,
        senderName: sender.fullname,
        messagePreview: messagePreview,
        mentionedBy: sender.fullname,
      },
    };

    const targetUserIds = targetUsers.map((u) => u.id);
    const notifications = await notifyMultipleUsers(
      targetUserIds,
      notificationData,
      io,
    );

    return notifications;
  } catch (error) {
    console.error("Error sending mention notification:", error);
    throw error;
  }
};

/**
 * Send notification when a message is edited
 */
const sendMessageEditedNotification = async (message, editor, io) => {
  try {
    // Only notify if editor is not the original sender
    if (message.senderId === editor.id) {
      return [];
    }

    const conversation = await Conversation.findByPk(message.conversationId);
    const originalSender = await User.findByPk(message.senderId, {
      attributes: ["id", "fullname"],
    });

    if (!originalSender) return [];

    const messageConfig = messageNotificationMessages.message_edited(
      editor,
      originalSender,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "warning",
      entityType: "message_edit",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        messageId: message.id,
        editorId: editor.id,
        editorName: editor.fullname,
        originalSenderId: originalSender.id,
        originalSenderName: originalSender.fullname,
        editedAt: new Date(),
      },
    };

    const notification = await notifyUser(
      originalSender.id,
      notificationData,
      io,
    );

    return notification ? [notification] : [];
  } catch (error) {
    console.error("Error sending message edited notification:", error);
    throw error;
  }
};

/**
 * Send notification for unread message summary (daily/weekly)
 */
const sendUnreadMessagesSummary = async (userId, io) => {
  try {
    const user = await User.findByPk(userId, {
      attributes: ["id", "fullname"],
    });

    if (!user) return [];

    // Get all conversations user is part of
    const participations = await ConversationParticipant.findAll({
      where: { userId: user.id },
      attributes: ["conversationId", "lastReadMessageId"],
    });

    if (participations.length === 0) return [];

    const conversationIds = participations.map((p) => p.conversationId);
    const lastReadMap = participations.reduce((map, p) => {
      map[p.conversationId] = p.lastReadMessageId;
      return map;
    }, {});

    // Count unread messages per conversation
    const unreadCounts = await Promise.all(
      conversationIds.map(async (convId) => {
        const lastReadId = lastReadMap[convId];
        const whereClause = {
          conversationId: convId,
          senderId: { [Op.ne]: userId },
          isDeleted: false,
        };

        if (lastReadId) {
          whereClause.id = { [Op.gt]: lastReadId };
        }

        const count = await Message.count({ where: whereClause });
        return { conversationId: convId, count };
      }),
    );

    const totalUnread = unreadCounts.reduce((sum, item) => sum + item.count, 0);

    if (totalUnread === 0) return [];

    // Get top conversations with most unread
    const topConversations = await Promise.all(
      unreadCounts
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(async (item) => {
          const conv = await Conversation.findByPk(item.conversationId, {
            attributes: ["id", "name", "type"],
          });
          return {
            name:
              conv.name ||
              (conv.type === "private" ? "Private conversation" : "Group"),
            unreadCount: item.count,
          };
        }),
    );

    const messageConfig = messageNotificationMessages.unread_messages_summary(
      totalUnread,
      topConversations,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "message_summary",
      metadata: {
        userId: user.id,
        totalUnread,
        topConversations,
        summaryDate: new Date(),
      },
    };

    const notification = await notifyUser(userId, notificationData, io);

    return notification ? [notification] : [];
  } catch (error) {
    console.error("Error sending unread messages summary:", error);
    throw error;
  }
};

/**
 * Send notification for urgent/important messages
 */
const sendUrgentMessageNotification = async (
  message,
  sender,
  conversation,
  io,
) => {
  try {
    const participants = await ConversationParticipant.findAll({
      where: {
        conversationId: conversation.id,
        userId: { [Op.ne]: sender.id },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id"],
        },
      ],
    });

    const userIds = participants.map((p) => p.user?.id).filter(Boolean);

    if (userIds.length === 0) return [];

    const messageConfig = messageNotificationMessages.urgent_message(
      sender,
      message.message?.substring(0, 100),
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "alert",
      entityType: "urgent_message",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        messageId: message.id,
        senderId: sender.id,
        senderName: sender.fullname,
        messagePreview: message.message?.substring(0, 200),
        urgent: true,
      },
    };

    const notifications = await notifyMultipleUsers(
      userIds,
      notificationData,
      io,
    );

    return notifications;
  } catch (error) {
    console.error("Error sending urgent message notification:", error);
    throw error;
  }
};

/**
 * Send notification when a file is shared
 */
const sendFileSharedNotification = async (
  message,
  attachments,
  sender,
  conversation,
  io,
) => {
  try {
    const participants = await ConversationParticipant.findAll({
      where: {
        conversationId: conversation.id,
        userId: { [Op.ne]: sender.id },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id"],
        },
      ],
    });

    const userIds = participants.map((p) => p.user?.id).filter(Boolean);

    if (userIds.length === 0) return [];

    const isImage = attachments.some((a) => a.mimeType?.startsWith("image/"));
    const fileTypes = attachments
      .map((a) => a.mimeType?.split("/")[1] || "file")
      .join(", ");

    const messageConfig = messageNotificationMessages.file_shared(
      sender,
      attachments.length,
      isImage ? "image" : "file",
      conversation.name,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "file_share",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        messageId: message.id,
        senderId: sender.id,
        senderName: sender.fullname,
        fileCount: attachments.length,
        fileTypes: fileTypes,
        hasImages: isImage,
        attachments: attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
      },
    };

    const notifications = await notifyMultipleUsers(
      userIds,
      notificationData,
      io,
    );

    return notifications;
  } catch (error) {
    console.error("Error sending file shared notification:", error);
    throw error;
  }
};

/**
 * Send notification for message reactions
 */
const sendMessageReactionNotification = async (
  message,
  reactor,
  reaction,
  io,
) => {
  try {
    if (message.senderId === reactor.id) return []; // Don't notify self-reactions

    const originalSender = await User.findByPk(message.senderId, {
      attributes: ["id", "fullname"],
    });

    if (!originalSender) return [];

    const messageConfig = messageNotificationMessages.message_reaction(
      reactor,
      reaction,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "message_reaction",
      entityId: message.id,
      metadata: {
        messageId: message.id,
        reactorId: reactor.id,
        reactorName: reactor.fullname,
        reaction: reaction,
        conversationId: message.conversationId,
      },
    };

    const notification = await notifyUser(
      originalSender.id,
      notificationData,
      io,
    );

    return notification ? [notification] : [];
  } catch (error) {
    console.error("Error sending message reaction notification:", error);
    throw error;
  }
};

/**
 * Send daily/weekly message digest
 */
const sendMessageDigest = async (userId, period = "daily", io) => {
  try {
    const user = await User.findByPk(userId, {
      attributes: ["id", "fullname"],
    });

    if (!user) return [];

    const now = new Date();
    let startDate;

    if (period === "daily") {
      startDate = new Date(now.setDate(now.getDate() - 1));
    } else if (period === "weekly") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else {
      return [];
    }

    // Get conversations user participated in
    const participations = await ConversationParticipant.findAll({
      where: { userId: user.id },
      attributes: ["conversationId"],
    });

    const conversationIds = participations.map((p) => p.conversationId);

    // Get message stats for the period
    const messageStats = await Message.findAll({
      where: {
        conversationId: { [Op.in]: conversationIds },
        createdAt: { [Op.gte]: startDate },
        isDeleted: false,
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "fullname"],
        },
        {
          model: Conversation,
          as: "conversation",
          attributes: ["id", "name", "type"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (messageStats.length === 0) return [];

    // Group by conversation
    const conversationMap = {};
    messageStats.forEach((msg) => {
      const convId = msg.conversationId;
      if (!conversationMap[convId]) {
        conversationMap[convId] = {
          name:
            msg.conversation.name ||
            (msg.conversation.type === "private"
              ? msg.sender.fullname
              : "Group"),
          messageCount: 0,
          participants: new Set(),
        };
      }
      conversationMap[convId].messageCount++;
      conversationMap[convId].participants.add(msg.senderId);
    });

    const conversations = Object.values(conversationMap).map((c) => ({
      name: c.name,
      messageCount: c.messageCount,
      participantCount: c.participants.size,
    }));

    const totalMessages = messageStats.length;
    const uniqueSenders = new Set(messageStats.map((m) => m.senderId)).size;

    const messageConfig = messageNotificationMessages.message_digest(
      totalMessages,
      uniqueSenders,
      conversations.length,
      period,
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "message_digest",
      metadata: {
        userId: user.id,
        period: period,
        totalMessages,
        uniqueSenders,
        totalConversations: conversations.length,
        conversations: conversations,
        startDate: startDate,
        endDate: new Date(),
      },
    };

    const notification = await notifyUser(userId, notificationData, io);

    return notification ? [notification] : [];
  } catch (error) {
    console.error("Error sending message digest:", error);
    throw error;
  }
};

/**
 * Broadcast message to all users (for announcements)
 */
const broadcastMessageNotification = async (message, sender, io) => {
  try {
    const allUsers = await User.findAll({
      where: { isActive: true },
      attributes: ["id"],
    });

    const userIds = allUsers.map((u) => u.id);

    if (userIds.length === 0) return [];

    const messageConfig = messageNotificationMessages.broadcast_message(
      sender,
      message.message?.substring(0, 100),
    );

    const notificationData = {
      title: messageConfig.title,
      message: messageConfig.message,
      notifType: "info",
      entityType: "broadcast",
      entityId: message.id,
      metadata: {
        messageId: message.id,
        senderId: sender.id,
        senderName: sender.fullname,
        messagePreview: message.message?.substring(0, 200),
        isBroadcast: true,
      },
    };

    const notifications = await notifyMultipleUsers(
      userIds,
      notificationData,
      io,
    );

    return notifications;
  } catch (error) {
    console.error("Error sending broadcast message notification:", error);
    throw error;
  }
};

module.exports = {
  sendNewMessageNotification,
  sendMessageReplyNotification,
  sendAddedToGroupNotification,
  sendMentionNotification,
  sendMessageEditedNotification,
  sendUnreadMessagesSummary,
  sendUrgentMessageNotification,
  sendFileSharedNotification,
  sendMessageReactionNotification,
  sendMessageDigest,
  broadcastMessageNotification,
};
