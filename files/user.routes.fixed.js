const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  getAllUsers,
  getAllGuardians,
  updateUserStatus,
  getAllDrivers,
  getAllRoles,
  getAllStudents,
  getStudentById,
  getGuardianById,
  getGuardianStudents,
  updateUser,
  getProfile,
  updateStudentEnrollmentDetails,
  createUser,
  bulkDeactivateUsers,
  bulkActivateUsers,
  deactivateUser,
  activateUser,
  setDriverProfile,
  updateDriver,
  setGuardianProfile,
  addStudentToGuardian,
  subscribeGuardian,
} = require("../controllers/userController");
const { uploadDriverProfileFiles } = require("../config/multer");

router.use(passport.authenticate("jwt", { session: false }));

router.get("/all-users", getAllUsers);

router.get("/all-students", requireRole(["admin", "driver"]), getAllStudents);

router.get("/student/:id", requireRole(["admin", "guardian"]), getStudentById);

router.get("/all-roles", getAllRoles);

router.get("/all-guardians", requireRole(["admin", "driver"]), getAllGuardians);

router.get(
  "/guardian/:id",
  requireRole(["admin", "guardian"]),
  getGuardianById,
);

router.get(
  "/all-drivers",
  requireRole(["admin", "driver", "guardian"]),
  getAllDrivers,
);

router.patch("/update-status/:id", requireRole(["admin"]), updateUserStatus);

router.patch("/update-user/:id", requireRole(["admin"]), updateUser);

router.patch("/bulk-deactivate", requireRole(["admin"]), bulkDeactivateUsers);

router.patch("/bulk-activate", requireRole(["admin"]), bulkActivateUsers);

// Single user deactivation/activation routes
router.patch("/deactivate-user/:id", requireRole(["admin"]), deactivateUser);
router.patch("/activate-user/:id", requireRole(["admin"]), activateUser);

router.get("/my-profile", getProfile);

router.get(
  "/guardian-students",
  requireRole(["guardian", "driver"]),
  getGuardianStudents,
);

router.patch("/update-driver/:id", requireRole("driver"), updateDriver);

router.get("/all-drivers", getAllDrivers);

router.post("/create-user", requireRole("admin"), createUser);

router.post("/add-student", addStudentToGuardian);

router.post(
  "/create-driver-profile",
  requireRole("driver"),
  uploadDriverProfileFiles,
  setDriverProfile,
);

router.post("/create-guardian-profile", setGuardianProfile);

// Note: router.use(passport.authenticate("jwt", ...)) already runs for
// every route in this file (see top of file), so /subscribe doesn't need
// its own passport.authenticate call — it's redundant but harmless if kept.
router.post("/subscribe", subscribeGuardian);

module.exports = router;