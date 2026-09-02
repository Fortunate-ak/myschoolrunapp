// routes/notifications.js
const express = require("express");
const { passport } = require("../config/passport");
const {
  getNotificationsByUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");
const router = express.Router();

router.get(
  "/my-notifications",
  passport.authenticate("jwt", { session: false }),
  getNotificationsByUser,
);

router.patch(
  "/:id/read",
  passport.authenticate("jwt", { session: false }),
  markNotificationAsRead,
);

router.patch(
  "/mark-all-read",
  passport.authenticate("jwt", { session: false }),
  markAllNotificationsAsRead,
);

module.exports = router;
