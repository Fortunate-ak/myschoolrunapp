const { Op } = require("sequelize");
const db = require("../models/index");
const cleanupFiles = require("../utils/fileCleanupHelper");
const Vehicle = db.vehicles;
const Driver = db.drivers;
const User = db.users;
const VehicleRoute = db.vehicleroutes;
const logAudit = require("../utils/logAudit");
const requestIp = require("request-ip");

const generateVehicleNumber = () => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BUS-${random}`;
};

/**
 * Create a new vehicle
 */
const createVehicle = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const driver = await Driver.findOne({ where: { userId: user.id } });
    const {
      carModel,
      carMake,
      registrationNumber,
      capacity,
      lastServiceDate,
      nextServiceDate,
      insuranceExpiry,
    } = req.body;

    // Validate required fields
    if (!registrationNumber || !capacity || !carModel) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Registration number, car make capacity are required",
      });
    }

    if (capacity <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Capacity must be greater than zero",
      });
    }

    // Check for duplicate registration
    const existingVehicle = await Vehicle.findOne({
      where: { registrationNumber },
      transaction,
    });

    if (existingVehicle) {
      await transaction.rollback();
      return res.status(409).json({
        message: "A vehicle with this registration number already exists",
        existingVehicle,
      });
    }

    // Generate vehicle number
    const vehicleNumber = generateVehicleNumber();

    // Create vehicle
    const vehicle = await Vehicle.create(
      {
        driverId: driver.id,
        image: req.file?.path.replace(/\\/g, "/"),
        carModel,
        carMake,
        registrationNumber,
        capacity,
        lastServiceDate,
        nextServiceDate,
        insuranceExpiry,
        isActive: true,
      },
      { transaction },
    );

    await transaction.commit();

    await logAudit({
      userId: user.id,
      action: "create_vehicle",
      entity: "Vehicles",
      entityId: vehicle.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(201).json(vehicle);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Server error: Failed to create vehicle",
    });
  }
};

/**
 * Get all vehicles with filters
 */
const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      where: { isActive: true, capacity: { [Op.gte]: 1 } },
      include: [
        {
          model: Driver,
          as: "driver",
          where: { isActive: true },
          attributes: ["id", "profileImage", "licenseNumber"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "phone"],
            },
          ],
        },
        {
          model: VehicleRoute,
          as: "routes",
          where: { isActive: true },
          required: false,
          // route.stops comes from the model's JSON-column getter, already
          // parsed — no separate vehiclestops include needed here (see
          // vehicleRouteController.js getAllVehicleRoutes for reference).
        },
      ],
    });

    return res.status(200).json(vehicles);
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Failed to fetch vehicles",
    });
  }
};

/**
 * Get single vehicle with details
 */
const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByPk(id, {
      include: [
        {
          model: Driver,
          as: "driver",
          where: { isActive: true },
          required: false,
          include: [
            {
              model: User,
              as: "user",
            },
          ],
        },
        {
          model: VehicleRoute,
          as: "routes",
          include: [
            {
              model: db.vehiclestops,
              as: "stops",
            },
          ],
        },
      ],
    });

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    return res.status(200).json(vehicle);
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch vehicle",
      error: error.message,
    });
  }
};

/**
 * Update vehicle details
 */
const updateVehicle = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { id } = req.params;
    const {
      capacity,
      status,
      lastServiceDate,
      nextServiceDate,
      insuranceExpiry,
    } = req.body;

    const vehicle = await Vehicle.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!vehicle) {
      cleanupFiles(req.files);
      await transaction.rollback();
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    if (capacity) vehicle.capacity = capacity;

    if (status) vehicle.status = status;
    if (lastServiceDate) vehicle.lastServiceDate = lastServiceDate;
    if (nextServiceDate) vehicle.nextServiceDate = nextServiceDate;
    if (insuranceExpiry) vehicle.insuranceExpiry = insuranceExpiry;

    if (req.file) {
      cleanupFiles(req.files);
      vehicle.image = req.file.path.replace(/\\/g, "/");
    } else if (vehicle.image === null || vehicle.image === undefined) {
      vehicle.image = vehicle.image;
    }

    await vehicle.save({ transaction });

    await transaction.commit();

    await logAudit({
      userId: user.id,
      action: "Update Vehicle",
      entity: "Vehicles",
      entityId: vehicle.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Vehicle updated successfully",
    });
  } catch (error) {
    cleanupFiles(req.files);
    await transaction.rollback();
    return res.status(500).json({
      message: "Server error: Failed to update vehicle",
    });
  }
};

/**
 * Update vehicle location (from GPS device)
 */
const updateVehicleLocation = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const vehicle = await Vehicle.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!vehicle) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    // Update current location
    vehicle.currentLocation = {
      latitude,
      longitude,
      timestamp: new Date(),
    };

    await vehicle.save({ transaction });

    await transaction.commit();

    return res.status(200).json({
      message: "Vehicle location updated",
      location: vehicle.currentLocation,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating vehicle location:", error);
    return res.status(500).json({
      message: "Server error: Failed to update vehicle location",
      error: error.message,
    });
  }
};

/**
 * Get vehicles available for assignment
 */
const getAvailableVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      where: {
        status: "active",
        isActive: true,
      },
    });

    // Calculate available capacity
    const vehiclesWithCapacity = vehicles.map((vehicle) => ({
      ...vehicle.toJSON(),
      availableSeats: vehicle.capacity - vehicle.currentOccupancy,
    }));

    return res.status(200).json({
      count: vehiclesWithCapacity.length,
      vehicles: vehiclesWithCapacity,
    });
  } catch (error) {
    console.error("Error fetching available vehicles:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch available vehicles",
      error: error.message,
    });
  }
};

/**
 * Get vehicle statistics
 */
const getVehicleStatistics = async (req, res) => {
  try {
    const totalVehicles = await Vehicle.count();

    const activeVehicles = await Vehicle.count({
      where: { status: "active" },
    });

    const inMaintenance = await Vehicle.count({
      where: { status: "maintenance" },
    });

    const outOfService = await Vehicle.count({
      where: { status: "out_of_service" },
    });

    const totalCapacity = await Vehicle.sum("capacity", {
      where: { status: "active" },
    });

    return res.status(200).json({
      totalVehicles,
      activeVehicles,
      inMaintenance,
      outOfService,
      totalCapacity: totalCapacity || 0,
    });
  } catch (error) {
    console.error("Error fetching vehicle statistics:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch vehicle statistics",
      error: error.message,
    });
  }
};

const getDriverVehicles = async (req, res) => {
  const { id } = req.user;

  try {
    const driver = await Driver.findOne({ where: { userId: id } });
    const driverId = driver.id;
    const vehicle = await Vehicle.findAll({ where: { driverId } });

    if (!vehicle) {
      return res.status(404).json({ message: "No vehicles" });
    }

    return res.status(200).json(vehicle);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  updateVehicleLocation,
  getAvailableVehicles,
  getVehicleStatistics,
  getDriverVehicles,
};
