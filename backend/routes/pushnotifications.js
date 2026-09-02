const express = require("express");
const router = express.Router();
const { passport } = require("../config/passport");
const {
  getAllPushTokens,
  unregisterPushNotificationToken,
  registerPushNotificationToken,
} = require("../controllers/pushNotificationsController");

router.use(passport.authenticate("jwt", { session: false }));

router.get("/all-push-tokens", getAllPushTokens);
router.delete("/unregister-push-token", unregisterPushNotificationToken);
router.post("/register-push-token", registerPushNotificationToken);

module.exports = router;
