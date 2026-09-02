const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
} = require("../controllers/driverServiceController");

router.use(passport.authenticate("jwt", { session: false }));
router.use(requireRole("driver"));

router.post("/", createService);
router.get("/", getServices);
router.get("/:id", getService);
router.patch("/:id", updateService);
router.delete("/:id", deleteService);

module.exports = router;
