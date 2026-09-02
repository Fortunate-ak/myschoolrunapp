const express = require("express");
const { passport, requireRole } = require("../config/passport");
const { requireProFeature } = require("../services/subscriptionService");
const {
  requestEmergencyRide,
  cancelEmergencyRide,
  getAvailableDrivers,
  selectDriver,
  acceptEmergencyRide,
  rejectEmergencyRide,
  markDriverArriving,
  markStudentPickedUp,
  startTrip,
  completeTrip,
} = require("../controllers/emergencyRideController");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

// ─── Guardian Operations ───────────────────────────────────────────────────────

router.post(
  "/request",
  authenticate,
  requireRole("guardian"),
  requireProFeature,
  requestEmergencyRide,
);

router.get(
  "/:id/available-drivers",
  authenticate,
  requireRole("guardian"),
  requireProFeature,
  getAvailableDrivers,
);

router.post(
  "/:id/select-driver",
  authenticate,
  requireRole("guardian"),
  requireProFeature,
  selectDriver,
);

// ─── Driver Operations (PHASE 9 & 10) ──────────────────────────────────────────

router.post(
  "/:id/accept",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  acceptEmergencyRide,
);

router.post(
  "/:id/reject",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  rejectEmergencyRide,
);

router.post(
  "/:id/arriving",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  markDriverArriving,
);

router.post(
  "/:id/pickup",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  markStudentPickedUp,
);

router.post(
  "/:id/start",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  startTrip,
);

router.post(
  "/:id/complete",
  authenticate,
  requireRole("driver"),
  requireProFeature,
  completeTrip,
);

// ─── Cancellation (Both Guardian & Driver) ─────────────────────────────────────

router.post(
  "/:id/cancel",
  authenticate,
  requireProFeature,
  cancelEmergencyRide,
);

module.exports = router;
