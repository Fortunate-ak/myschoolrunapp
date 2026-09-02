// routes/studentTrackingRoutes.js
const express = require("express");
const router = express.Router();
const { passport } = require("../config/passport");
const {
  getStudentLocation,
  getMyStudentsLocations,
  getRouteStudents,
  streamStudentLocation,
  assignStudentToRoute,
  getStudentStopDetails,
} = require("../controllers/studentTrackingController");

router.use(passport.authenticate("jwt", { session: false }));

// Guardian routes
router.get("/my-students", getMyStudentsLocations);
router.get("/student/:studentId/location", getStudentLocation);
router.get("/student/:studentId/stream", streamStudentLocation);
router.get("/student/:studentId/stop-details", getStudentStopDetails);

router.get("/route/:routeId/students", getRouteStudents);

module.exports = router;
