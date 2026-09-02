const express = require("express");
const { passport } = require("../config/passport");
const {
  getPlans,
  getMySubscription,
  subscribePlan,
  cancelSubscription,
} = require("../controllers/subscriptionController");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

router.get("/plans", getPlans);
router.get("/my-subscription", authenticate, getMySubscription);
router.post("/subscribe", authenticate, subscribePlan);
router.post("/cancel", authenticate, cancelSubscription);

module.exports = router;
