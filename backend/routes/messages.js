// routes/messages.js

const express = require("express");
const router = express.Router();
const {
  getConversations,
  getOrCreatePrivateConversation,
  createRouteChannel,
  getMessages,
  leaveConversation,
  sendMessage,
  getGuardianRouteChannels,
  markAsRead,
  deleteMessage,
  getMessageAttachments,
  downloadAttachment,
  getAvailableRoutesForChannels,
  getDriverRoutes,
  getRouteGuardians, // New endpoint
} = require("../controllers/messagesController");
const { passport } = require("../config/passport");
const { uploadMessageAttachments } = require("../config/multer");

const authenticate = passport.authenticate("jwt", { session: false });

// Conversation routes
router.get("/conversations", authenticate, getConversations);
router.post(
  "/conversations/private/:userId",
  authenticate,
  getOrCreatePrivateConversation,
);
router.post("/conversations/route", authenticate, createRouteChannel);
router.get(
  "/conversations/available-routes",
  authenticate,
  getAvailableRoutesForChannels,
); // New endpoint

// Message routes
router.get(
  "/conversations/:conversationId/messages",
  authenticate,
  getMessages,
);
router.post(
  "/conversations/:conversationId/messages",
  authenticate,
  uploadMessageAttachments,
  sendMessage,
);
router.put("/conversations/:conversationId/read", authenticate, markAsRead);
router.delete("/messages/:messageId", authenticate, deleteMessage);
router.delete(
  "/conversations/:conversationId/leave",
  authenticate,
  leaveConversation,
);
// Attachment routes
router.get(
  "/messages/:messageId/attachments",
  authenticate,
  getMessageAttachments,
);
router.get(
  "/attachments/:attachmentId/download",
  authenticate,
  downloadAttachment,
);

router.get(
  "/conversations/route-channels",
  authenticate,
  getGuardianRouteChannels,
);

router.get("/driver/routes", authenticate, getDriverRoutes);
router.get(
  "/driver/routes/:routeId/guardians",
  authenticate,
  getRouteGuardians,
);

module.exports = router;
