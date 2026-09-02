const db = require("../models/index");
const { getDriverEligibility } = require("./driverEligibilityService");

const Driver = db.drivers;
const Vehicle = db.vehicles;
const DriverService = db.driverservices;

const isValidCoordinate = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

const validateServiceInput = (input, { requireActive = false } = {}) => {
  const errors = {};
  const requiredText = ["origin", "destination", "serviceType"];
  requiredText.forEach((field) => {
    if (typeof input[field] !== "string" || !input[field].trim()) errors[field] = "is required";
  });

  [
    ["originLatitude", -90, 90],
    ["destinationLatitude", -90, 90],
    ["originLongitude", -180, 180],
    ["destinationLongitude", -180, 180],
  ].forEach(([field, min, max]) => {
    if (!isValidCoordinate(input[field], min, max)) errors[field] = "must be a valid coordinate";
  });

  if (!Object.values(["FIXED", "PER_KM", "NEGOTIABLE"]).includes(input.pricingType)) {
    errors.pricingType = "must be FIXED, PER_KM, or NEGOTIABLE";
  }
  if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0) {
    errors.price = "must be a non-negative number";
  }
  if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) {
    errors.currency = "must be a 3-letter uppercase currency code";
  }
  if (!Array.isArray(input.availableDays)) errors.availableDays = "must be an array";
  if (!input.availableHours || typeof input.availableHours !== "object" || Array.isArray(input.availableHours)) {
    errors.availableHours = "must be an object";
  }
  if (requireActive && input.isActive !== true) errors.isActive = "must be true to activate a service";
  return errors;
};

const ensureDriverCanActivate = async (driverId, vehicleId) => {
  const driver = await Driver.findByPk(driverId);
  if (!driver) throw Object.assign(new Error("Driver not found"), { status: 404 });
  if (!driver.isActive) throw Object.assign(new Error("Driver account is inactive"), { status: 403 });

  const vehicle = await Vehicle.findOne({ where: { id: vehicleId, driverId } });
  if (!vehicle) throw Object.assign(new Error("Vehicle does not belong to driver"), { status: 403 });

  const eligibility = await getDriverEligibility(driverId);
  if (!eligibility?.eligible) {
    throw Object.assign(new Error("Driver is not approved for emergency services"), {
      status: 403,
      requirements: eligibility?.requirements,
    });
  }
  return { driver, vehicle };
};

const serviceIncludes = [
  { model: Driver, as: "driver", attributes: ["id", "userId"] },
  { model: Vehicle, as: "vehicle" },
];

module.exports = {
  DriverService,
  serviceIncludes,
  validateServiceInput,
  ensureDriverCanActivate,
};
