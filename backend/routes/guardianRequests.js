const express = require("express");
const { passport, requireRole } = require("../config/passport");
const {
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getAllRequestsForDriver,
  getAllGuardianRequests,
} = require("../controllers/guardianRequestController");

const router = express.Router();

router.use(passport.authenticate("jwt", { session: false }));

router.post("/create-request", requireRole("guardian"), createRequest);
router.patch(
  "/approve-request/:requestId",
  requireRole("driver"),
  approveRequest,
);
router.patch(
  "/reject-request/:requestId",
  requireRole("driver"),
  rejectRequest,
);
router.patch(
  "/cancel-request/:requestId",
  requireRole("guardian"),
  cancelRequest,
);

router.get(
  "/all-driver-requests",
  requireRole("driver"),
  getAllRequestsForDriver,
);

router.get(
  "/all-guardian-requests",
  requireRole("guardian"),
  getAllGuardianRequests,
);

module.exports = router;
