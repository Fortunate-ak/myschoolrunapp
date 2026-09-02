const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  assignBusToDriver,
  updateDriverToBusAssignment,
  getAllDriverToBusAssignments,
  getBusDriverAssignedBuses,
} = require("../controllers/vehicleToDriverAssignmentController");

router.post(
  "/assign-driver",
  passport.authenticate("jwt", { session: false }),
  requireRole("admin"),
  assignBusToDriver,
);

router.patch(
  "/update-driver-assignment/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole("admin"),
  updateDriverToBusAssignment,
);

router.get(
  "/all-driver-assignments",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin", "driver"]),
  getAllDriverToBusAssignments,
);

router.get(
  "/my-buses",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  getBusDriverAssignedBuses,
);

module.exports = router;
