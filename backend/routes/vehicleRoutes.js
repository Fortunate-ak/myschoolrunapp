const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  createVehicleRoute,
  getAllVehicleRoutes,
  getVehicleRouteById,
  updateVehicleRoute,
  addStopToRoute,
  updateVehicleStop,
  deleteStopFromRoute,
  reorderRouteStops,
  getRouteScheduleForToday,
  getVehicleRouteAssignedToDriver,
  deleteRoute,
} = require("../controllers/vehicleRouteController");

router.post(
  "/create-vehicle-route",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  createVehicleRoute,
);

router.patch(
  "/update-vehicle-route/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  updateVehicleRoute,
);

router.patch(
  "/add-stop-to-route/:routeId",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  addStopToRoute,
);

router.patch(
  "/update-vehicle-stop/:stopId",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  updateVehicleStop,
);

router.get(
  "/vehicle-driver-route",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  getVehicleRouteAssignedToDriver,
);

router.get(
  "/vehicle-route/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole(["driver", "guardian", "driver"]),
  getVehicleRouteById,
);

router.get(
  "/all-vehicle-routes",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  getAllVehicleRoutes,
);

router.get(
  "/route-schedule/:routeId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["driver", "guardian"]),
  getRouteScheduleForToday,
);

router.delete(
  "/delete-vehicle-stop/:stopId",
  passport.authenticate("jwt", { session: false }),
  deleteStopFromRoute,
);

router.delete(
  "/delete-route/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  deleteRoute,
);

router.patch(
  "/reorder-vehicle-stops/:routeId",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  reorderRouteStops,
);

module.exports = router;
