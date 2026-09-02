const requestIp = require("request-ip");
const db = require("../models/index");
const logAudit = require("../utils/logAudit");
const {
  getDriverEligibility,
  setEmergencyRideEligibility,
} = require("../services/driverEligibilityService");

const Driver = db.drivers;
const Vehicle = db.vehicles;

const getVerificationStatus = async (req, res) => {
  try {
    const eligibility = await getDriverEligibility(req.params.id);

    if (!eligibility) {
      return res.status(404).json({ message: "Driver not found" });
    }

    return res.status(200).json({
      driverId: eligibility.driver.id,
      verification: eligibility.requirements,
      emergencyRideEnabled: eligibility.driver.emergencyRideEnabled,
      eligible: eligibility.eligible,
    });
  } catch (error) {
    console.error("getVerificationStatus error:", error);
    return res.status(500).json({ message: "Failed to fetch driver verification status" });
  }
};

const updateVerificationStatus = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const driver = await Driver.findByPk(req.params.id, { transaction });
    if (!driver) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const allowedDriverFields = ["identityVerified", "licenseVerified"];
    allowedDriverFields.forEach((field) => {
      if (typeof req.body[field] === "boolean") {
        driver[field] = req.body[field];
      }
    });
    await driver.save({ transaction });

    if (req.body.vehicleVerified !== undefined || req.body.insuranceVerified !== undefined) {
      const vehicle = await Vehicle.findOne({
        where: { driverId: driver.id },
        order: [["createdAt", "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!vehicle) {
        await transaction.rollback();
        return res.status(404).json({ message: "Driver vehicle not found" });
      }

      ["vehicleVerified", "insuranceVerified"].forEach((field) => {
        if (typeof req.body[field] === "boolean") {
          vehicle[field] = req.body[field];
        }
      });
      await vehicle.save({ transaction });
    }

    if (
      driver.identityVerified !== true ||
      driver.licenseVerified !== true ||
      req.body.vehicleVerified === false ||
      req.body.insuranceVerified === false
    ) {
      driver.emergencyRideEnabled = false;
      await driver.save({ transaction });
    }

    await transaction.commit();
    const result = await getDriverEligibility(driver.id);
    return res.status(200).json({
      driverId: driver.id,
      verification: result.requirements,
      emergencyRideEnabled: driver.emergencyRideEnabled,
      eligible: result.eligible,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("updateVerificationStatus error:", error);
    return res.status(500).json({ message: "Failed to update driver verification status" });
  }
};

const setEligibility = async (req, res) => {
  try {
    const enabled = req.body.enabled;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    const result = await setEmergencyRideEligibility(req.params.id, enabled);
    if (!result) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await logAudit({
      userId: req.user.id,
      action: enabled ? "enable_emergency_ride_eligibility" : "disable_emergency_ride_eligibility",
      entity: "Driver",
      entityId: req.params.id,
      metadata: {
        ip: requestIp.getClientIp(req),
        userAgent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      driverId: result.driver.id,
      emergencyRideEnabled: result.driver.emergencyRideEnabled,
      verification: result.requirements,
      eligible: result.eligible,
    });
  } catch (error) {
    if (error.code === "DRIVER_NOT_VERIFIED") {
      return res.status(409).json({
        message: error.message,
        verification: error.requirements,
      });
    }

    console.error("setEligibility error:", error);
    return res.status(500).json({ message: "Failed to update emergency ride eligibility" });
  }
};

module.exports = {
  getVerificationStatus,
  updateVerificationStatus,
  setEligibility,
};
