const {
  DriverService,
  serviceIncludes,
  validateServiceInput,
  ensureDriverCanActivate,
} = require("../services/driverServiceService");
const db = require("../models/index");

const Driver = db.drivers;
const Vehicle = db.vehicles;

const getAuthenticatedDriver = async (userId) => {
  const driver = await Driver.findOne({ where: { userId } });
  if (!driver) {
    throw Object.assign(new Error("Driver profile not found"), { status: 404 });
  }
  if (!driver.isActive) {
    throw Object.assign(new Error("Driver account is inactive"), { status: 403 });
  }
  return driver;
};

const serviceFields = [
  "vehicleId", "origin", "destination", "originLatitude", "originLongitude",
  "destinationLatitude", "destinationLongitude", "serviceType", "price",
  "currency", "pricingType", "availableDays", "availableHours", "isActive",
];

const pickServiceFields = (body) =>
  Object.fromEntries(serviceFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const handleError = (res, error) => {
  const status = error.status || 500;
  return res.status(status).json({ message: error.message || "Server error" });
};

const createService = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.user.id);
    const input = {
      ...req.body,
      currency: req.body.currency || "USD",
      pricingType: req.body.pricingType || "FIXED",
      isActive: req.body.isActive === true,
    };
    const errors = validateServiceInput(input);
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid driver service", errors });

    const vehicle = await Vehicle.findOne({ where: { id: input.vehicleId, driverId: driver.id } });
    if (!vehicle) return res.status(403).json({ message: "Vehicle does not belong to driver" });
    if (input.isActive) await ensureDriverCanActivate(driver.id, input.vehicleId);

    const service = await DriverService.create({ ...input, driverId: driver.id });
    return res.status(201).json(service);
  } catch (error) {
    return handleError(res, error);
  }
};

const getServices = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.user.id);
    const services = await DriverService.findAll({
      where: { driverId: driver.id },
      include: serviceIncludes,
      order: [["createdAt", "DESC"]],
    });
    return res.status(200).json(services);
  } catch (error) {
    return handleError(res, error);
  }
};

const getService = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.user.id);
    const service = await DriverService.findOne({
      where: { id: req.params.id, driverId: driver.id },
      include: serviceIncludes,
    });
    if (!service) return res.status(404).json({ message: "Driver service not found" });
    return res.status(200).json(service);
  } catch (error) {
    return handleError(res, error);
  }
};

const updateService = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.user.id);
    const service = await DriverService.findOne({ where: { id: req.params.id, driverId: driver.id } });
    if (!service) return res.status(404).json({ message: "Driver service not found" });

    const updates = pickServiceFields(req.body);
    const input = { ...service.toJSON(), ...updates };
    const errors = validateServiceInput(input, { requireActive: input.isActive === true });
    if (Object.keys(errors).length) return res.status(400).json({ message: "Invalid driver service", errors });

    const vehicle = await Vehicle.findOne({ where: { id: input.vehicleId, driverId: driver.id } });
    if (!vehicle) return res.status(403).json({ message: "Vehicle does not belong to driver" });
    if (input.isActive) await ensureDriverCanActivate(driver.id, input.vehicleId);

    await service.update(updates);
    return res.status(200).json(service);
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteService = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req.user.id);
    const service = await DriverService.findOne({ where: { id: req.params.id, driverId: driver.id } });
    if (!service) return res.status(404).json({ message: "Driver service not found" });
    await service.destroy();
    return res.status(204).send();
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { createService, getServices, getService, updateService, deleteService };
