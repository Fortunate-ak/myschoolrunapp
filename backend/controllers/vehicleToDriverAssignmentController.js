const db = require("../models/index");
const Bus = db.buses;
const User = db.users;
const BusDriver = db.busdrivers;
const BusToDriverAssignment = db.bustodriverassignments;
const logAudit = require("../utils/logAudit");
const Role = db.role;
const requestIp = require("request-ip");

const assignBusToDriver = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { driverId, busId } = req.body;

    const driverRole = await db.role.findOne({
      where: { name: "driver" },
      transaction,
    });

    if (driverId) {
      const driver = await User.findOne({
        where: {
          roleId: driverRole.id,
          isActive: true,
        },
        include: [
          {
            model: BusDriver,
            as: "driver",
          },
        ],
        transaction,
      });

      if (!driver) {
        await transaction.rollback();
        return res.status(404).json({ message: "Driver not found" });
      }
    }

    if (busId) {
      const busExists = await Bus.findOne({
        where: { id: busId, isActive: true },
        transaction,
      });

      if (!busExists) {
        await transaction.rollback();
        return res.status(404).json({ message: "Bus not found" });
      }
    }

    const busToDriver = await BusToDriverAssignment.create(
      {
        busId,
        driverId,
      },
      { transaction },
    );

    await transaction.commit();

    await logAudit({
      userId: user.id,
      entity: "Driver Assignment",
      action: "assign_bus_to_driver",
      entityId: busToDriver.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(201).json(busToDriver);
  } catch (error) {
    await transaction.rollback();
    return res
      .status(500)
      .json({ message: "Server error: Failed to assign bus to driver" });
  }
};

const updateDriverToBusAssignment = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.params;
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const driverBus = await BusToDriverAssignment.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!driverBus) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ message: "Driver-to-Bus assignment not found" });
    }

    const updates = req.body;

    const allowedFields = ["driverId", "busId", "isActive"];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        driverBus[field] = updates[field];
      }
    });

    await driverBus.save({ transaction });
    await transaction.commit();

    await logAudit({
      userId: user.id,
      entity: "Driver Assignment",
      action: "update_bus_to_driver_assignment",
      entityId: driverBus.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json(driverBus);
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Server error: Failed to update driver to bus assignment",
    });
  }
};

const getAllDriverToBusAssignments = async (req, res) => {
  try {
    const driverToBuses = await BusToDriverAssignment.findAll({
      include: [
        {
          model: BusDriver,
          as: "driver",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname"],
            },
          ],
        },
        {
          model: Bus,
          as: "bus",
        },
      ],
    });

    return res.status(200).json(driverToBuses);
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Failed to fetch driver to bus assignments",
    });
  }
};

const getBusDriverAssignedBuses = async (req, res) => {
  const { id } = req.user;

  try {
    const driver = await BusDriver.findOne({ where: { userId: id } });

    const busDriverId = driver.id;
    const mybuses = await BusToDriverAssignment.findAll({
      where: { driverId: busDriverId },
      include: [
        {
          model: BusDriver,
          as: "driver",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname"],
            },
          ],
        },
        {
          model: Bus,
          as: "bus",
        },
      ],
    });

    return res.status(200).json(mybuses);
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Failed to fetch driver to bus assignments",
    });
  }
};

module.exports = {
  getAllDriverToBusAssignments,
  assignBusToDriver,
  updateDriverToBusAssignment,
  getBusDriverAssignedBuses,
};
