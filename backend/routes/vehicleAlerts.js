// routes/busAlerts.js - Ensure correct route order

const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  getAllBusAlerts,
  getActiveBusAlerts,
  getBusAlertById,
  resolveBusAlert,
  dismissBusAlert,
  getAlertStatistics,
  getUnreadAlertsCount,
  markAlertAsRead,
  markAllAlertsAsRead,
} = require("../controllers/vehicleAlertController");

// IMPORTANT: Specific routes MUST come before generic routes with params
// Order matters: /unread/count before /:id

// Get unread alerts count (specific path first)
router.get(
  "/unread/count",
  passport.authenticate("jwt", { session: false }),
  requireRole([
    "admin",
    "senior-teacher",
    "sports-director",
    "driver",
    "guardian",
  ]),
  getUnreadAlertsCount,
);

// Mark all alerts as read
router.post(
  "/mark-all-read",
  passport.authenticate("jwt", { session: false }),
  requireRole([
    "admin",
    "senior-teacher",
    "sports-director",
    "driver",
    "guardian",
  ]),
  markAllAlertsAsRead,
);

// Get active alerts only
router.get(
  "/active",
  passport.authenticate("jwt", { session: false }),
  requireRole([
    "admin",
    "senior-teacher",
    "sports-director",
    "driver",
    "guardian",
  ]),
  getActiveBusAlerts,
);

// Get alert statistics
router.get(
  "/statistics",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "senior-teacher", "sports-director"]),
  getAlertStatistics,
);

// Get all alerts with filters (comes before /:id but after specific paths)
router.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "driver", "guardian"]),
  getAllBusAlerts,
);

// Mark single alert as read (specific path with param)
router.patch(
  "/:id/read",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "driver", "guardian"]),
  markAlertAsRead,
);

// Get single alert by ID (generic param route - should be LAST)
router.get(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole([
    "admin",
    "senior-teacher",
    "sports-director",
    "driver",
    "guardian",
  ]),
  getBusAlertById,
);

// Resolve an alert
router.patch(
  "/:id/resolve",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "driver"]),
  resolveBusAlert,
);

// Dismiss an alert
router.patch(
  "/:id/dismiss",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "driver"]),
  dismissBusAlert,
);

module.exports = router;
