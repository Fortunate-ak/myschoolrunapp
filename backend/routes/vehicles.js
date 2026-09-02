const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  createVehicle,
  updateVehicle,
  getVehicleById,
  getAllVehicles,
  getAvailableVehicles,
  getVehicleStatistics,
  getDriverVehicles,
} = require("../controllers/vehicleController");
const { uploadSingleImage } = require("../config/multer");

router.post(
  "/add-vehicle",
  passport.authenticate("jwt", { session: false }),
  uploadSingleImage,
  requireRole("driver"),
  createVehicle,
);

router.patch(
  "/update-vehicle/:id",
  passport.authenticate("jwt", { session: false }),
  uploadSingleImage,
  requireRole("driver"),
  updateVehicle,
);

router.get(
  "/vehicle/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole("driver"),
  getVehicleById,
);

router.get(
  "/driver-vehicles",
  passport.authenticate("jwt", { session: false }),
  getDriverVehicles,
);

router.get(
  "/all-vehicles",
  passport.authenticate("jwt", { session: false }),
  getAllVehicles,
);

router.get(
  "/all-available-vehicles",
  passport.authenticate("jwt", { session: false }),
  getAvailableVehicles,
);

router.get(
  "/vehicle-statistics",
  passport.authenticate("jwt", { session: false }),
  requireRole("admin"),
  getVehicleStatistics,
);

module.exports = router;
