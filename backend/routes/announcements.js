const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  createAnnouncement,
  updateAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  deleteAnnouncement,
} = require("../controllers/announcementsController");

router.post(
  "/create-announcement",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin"]),
  createAnnouncement,
);

router.patch(
  "/update-announcement/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin"]),
  updateAnnouncement,
);

router.get(
  "/get-all-announcements",
  passport.authenticate("jwt", { session: false }),
  getAllAnnouncements,
);

router.get(
  "/get-announcement/:id",
  passport.authenticate("jwt", { session: false }),
  getAnnouncementById,
);

router.delete(
  "/delete-announcement/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole(["admin"]),
  deleteAnnouncement,
);

module.exports = router;
