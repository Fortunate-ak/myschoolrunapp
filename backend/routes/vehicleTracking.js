const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  recordLocationUpdate,
  getCurrentVehicleLocation,
  getVehicleTrackingHistory,
  getAllActiveVehicleLocations,
  getETAToStop,
  checkVehicleDelay,
} = require("../controllers/vehicleTrackingController");

// Public/Device endpoints (no authentication required for GPS device updates)
router.post("/record-location", recordLocationUpdate);

// Protected endpoints - require authentication
router.get(
  "/current-location/:vehicleId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "guardian", "driver"]),
  getCurrentVehicleLocation,
);

router.get(
  "/tracking-history/:vehicleId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "senior-teacher", "sports-director"]),
  getVehicleTrackingHistory,
);

router.get(
  "/active-vehicles",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "senior-teacher", "sports-director", "driver"]),
  getAllActiveVehicleLocations,
);

router.get(
  "/eta/:vehicleId/:stopId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "senior-teacher", "sports-director", "driver"]),
  getETAToStop,
);

router.get(
  "/check-delay/:vehicleId/:routeId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "senior-teacher", "sports-director"]),
  checkVehicleDelay,
);

// Driver-specific tracking endpoints
router.get(
  "/driver/current-vehicle",
  passport.authenticate("jwt", { session: false }),
  requireRole(["driver"]),
  getCurrentVehicleLocation,
);

// Public endpoint for parents/students to track vehicle (optional - can be secured differently)
router.get(
  "/public/track/:vehicleId",
  getCurrentVehicleLocation, // No authentication required for public tracking
);

module.exports = router;
