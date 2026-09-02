// controllers/busAlertController.js
const db = require("../models/index");
const BusAlert = db.busalerts;
const Bus = db.buses;
const BusRoute = db.busroutes;
const User = db.users;
const BusDriver = db.busdrivers;
const { Op } = require("sequelize");

/**
 * Helper function to get stop by ID from route's stops JSON
 */
const getStopFromRoute = (route, stopId) => {
  if (!route || !route.stops || !Array.isArray(route.stops)) return null;
  return route.stops.find((stop) => stop.id === stopId);
};

/**
 * Create a new bus alert (internal use by monitoring service)
 */
const createBusAlert = async (alertData, transaction = null) => {
  try {
    const alert = await BusAlert.create(alertData, { transaction });
    return alert;
  } catch (error) {
    console.error("Error creating bus alert:", error);
    throw error;
  }
};

/**
 * Create SOS alert specifically
 */
const createSOSAlert = async (
  busId,
  routeId,
  location,
  driverName,
  driverPhone,
  transaction,
) => {
  const bus = await Bus.findByPk(busId);

  return await BusAlert.create(
    {
      busId,
      routeId,
      alertType: "sos",
      severity: "critical",
      title: "🚨 SOS EMERGENCY",
      message: `SOS activated by driver ${driverName || bus?.busNumber} at ${new Date().toLocaleTimeString()}. Immediate assistance required.`,
      location,
      status: "active",
      driverName,
      driverPhone,
    },
    { transaction },
  );
};

/**
 * Create a delay alert for a bus
 */
const createDelayAlert = async (
  busId,
  routeId,
  stopId,
  delayMinutes,
  location,
  transaction,
) => {
  const bus = await Bus.findByPk(busId);
  const route = await BusRoute.findByPk(routeId);
  const stop = getStopFromRoute(route, stopId);

  const severity = delayMinutes > 20 ? "high" : "medium";

  return await BusAlert.create(
    {
      busId,
      routeId,
      stopId,
      alertType: "delay",
      severity,
      title: "Bus Delayed",
      message: `Bus ${bus?.busNumber} is running ${delayMinutes} minutes late${stop ? ` to ${stop.stopName}` : ""}`,
      location,
      delayMinutes,
      status: "active",
    },
    { transaction },
  );
};

/**
 * Create an arrival notification alert
 */
const createArrivalNotification = async (
  busId,
  routeId,
  stopId,
  etaMinutes,
  location,
  transaction,
) => {
  const bus = await Bus.findByPk(busId);
  const route = await BusRoute.findByPk(routeId);
  const stop = getStopFromRoute(route, stopId);

  return await BusAlert.create(
    {
      busId,
      routeId,
      stopId,
      alertType: "arrival",
      severity: "low",
      title: "Bus Approaching Stop",
      message: `Bus ${bus?.busNumber} is approaching ${stop?.stopName} in approximately ${etaMinutes} minutes`,
      location,
      etaMinutes,
      status: "active",
    },
    { transaction },
  );
};

/**
 * Get all bus alerts with filters - Auto-filters by user role
 * Includes read status for the current user
 */
const getAllBusAlerts = async (req, res) => {
  try {
    const {
      status,
      alertType,
      busId,
      severity,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (alertType) whereClause.alertType = alertType;
    if (severity) whereClause.severity = severity;
    if (busId) whereClause.busId = busId;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });
      if (driver) {
        whereClause.busId = driver.busId;
      } else {
        return res.status(200).json({ success: true, count: 0, alerts: [] });
      }
    }

    const { count, rows: alerts } = await BusAlert.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Bus,
          as: "bus",
          attributes: ["id", "busNumber", "registrationNumber"],
        },
        {
          model: BusRoute,
          as: "route",
          attributes: ["id", "routeNumber", "routeName", "stops"],
        },
      ],
      order: [
        ["severity", "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const transformedAlerts = alerts.map((alert) => {
      const alertJson = alert.toJSON();
      const readBy = alertJson.readBy || [];
      alertJson.isRead = readBy.includes(userId);
      return alertJson;
    });

    return res.status(200).json({
      success: true,
      count,
      alerts: transformedAlerts,
    });
  } catch (error) {
    console.error("Error fetching bus alerts:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get unread alerts count for current user
 */
const getUnreadAlertsCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    let whereClause = { status: "active" };

    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });
      if (driver) whereClause.busId = driver.busId;
    }

    const alerts = await BusAlert.findAll({ where: whereClause });
    const unreadCount = alerts.filter((alert) => {
      const readBy = alert.readBy || [];
      return !readBy.includes(userId);
    }).length;

    return res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error("Error fetching unread alerts count:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Mark a single alert as read
 */
const markAlertAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alert = await BusAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    let readBy = alert.readBy || [];

    // Check if user already read this alert
    const currentReadBy = alert.readBy || [];
    if (!currentReadBy.includes(userId)) {
      const newReadBy = [...currentReadBy, userId]; // ← new array reference

      await alert.update({ readBy: newReadBy });

      // Verify the update worked
      const updatedAlert = await BusAlert.findByPk(id);
      console.log(`Alert ${id} readBy after update:`, updatedAlert.readBy);
    }

    return res.status(200).json({
      success: true,
      message: "Alert marked as read",
      readBy: readBy,
      isRead: true,
    });
  } catch (error) {
    console.error("Error marking alert as read:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to mark alert as read",
    });
  }
};

/**
 * Mark all alerts as read for current user
 */
const markAllAlertsAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    let whereClause = { status: "active" };

    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });
      if (driver) whereClause.busId = driver.busId;
    }

    const alerts = await BusAlert.findAll({ where: whereClause });

    let updatedCount = 0;
    for (const alert of alerts) {
      const currentReadBy = alert.readBy || [];
      if (!currentReadBy.includes(userId)) {
        await alert.update({ readBy: [...currentReadBy, userId] });
        updatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `${updatedCount} alerts marked as read`,
      updatedCount,
    });
  } catch (error) {
    console.error("Error marking all alerts as read:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to mark all alerts as read",
    });
  }
};

/**
 * Get active bus alerts only (for dashboard)
 */
const getActiveBusAlerts = async (req, res) => {
  try {
    const { busId } = req.query;
    const userId = req.user?.id;

    const whereClause = { status: "active" };

    const userRole = req.user?.role;

    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });

      if (driver) {
        whereClause.busId = driver.busId;
      } else {
        return res.status(200).json({ success: true, count: 0, alerts: [] });
      }
    } else if (busId) {
      whereClause.busId = busId;
    }

    const alerts = await BusAlert.findAll({
      where: whereClause,
      include: [
        {
          model: Bus,
          as: "bus",
          attributes: ["id", "busNumber", "registrationNumber"],
        },
        {
          model: BusRoute,
          as: "route",
          attributes: ["id", "routeNumber", "routeName", "stops"],
        },
      ],
      order: [
        ["severity", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const transformedAlerts = alerts.map((alert) => {
      const alertJson = alert.toJSON();
      if (alertJson.route && alertJson.stopId) {
        const stop = getStopFromRoute(alertJson.route, alertJson.stopId);
        if (stop) {
          alertJson.stop = {
            id: stop.id,
            stopName: stop.stopName,
            location: stop.location,
          };
        }
      }
      const readBy = alertJson.readBy || [];
      alertJson.isRead = readBy.includes(userId);
      return alertJson;
    });

    return res.status(200).json({
      success: true,
      count: transformedAlerts.length,
      alerts: transformedAlerts,
    });
  } catch (error) {
    console.error("Error fetching active bus alerts:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch active bus alerts",
      error: error.message,
    });
  }
};

/**
 * Get single bus alert by ID
 */
const getBusAlertById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alert = await BusAlert.findByPk(id, {
      include: [
        {
          model: Bus,
          as: "bus",
          attributes: ["id", "busNumber", "registrationNumber"],
        },
        {
          model: BusRoute,
          as: "route",
          attributes: ["id", "routeNumber", "routeName", "stops"],
        },
      ],
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Bus alert not found",
      });
    }

    const userRole = req.user?.role;
    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });

      if (!driver || driver.busId !== alert.busId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this alert",
        });
      }
    }

    const alertJson = alert.toJSON();
    if (alertJson.route && alertJson.stopId) {
      const stop = getStopFromRoute(alertJson.route, alertJson.stopId);
      if (stop) {
        alertJson.stop = {
          id: stop.id,
          stopName: stop.stopName,
          location: stop.location,
        };
      }
    }

    const readBy = alertJson.readBy || [];
    alertJson.isRead = readBy.includes(userId);

    return res.status(200).json({
      success: true,
      alert: alertJson,
    });
  } catch (error) {
    console.error("Error fetching bus alert:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch bus alert",
      error: error.message,
    });
  }
};

/**
 * Resolve bus alert
 */
const resolveBusAlert = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const resolvedBy = req.user.id;

    const alert = await BusAlert.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!alert) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Bus alert not found",
      });
    }

    const userRole = req.user?.role;
    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
        transaction,
      });

      if (!driver || driver.busId !== alert.busId) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "You are not authorized to resolve this alert",
        });
      }
    }

    if (alert.status !== "active") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Alert is already resolved or dismissed",
      });
    }

    await alert.update(
      {
        status: "resolved",
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || "Resolved by driver",
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Bus alert resolved successfully",
      alert,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error resolving bus alert:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to resolve bus alert",
      error: error.message,
    });
  }
};

/**
 * Dismiss bus alert
 */
const dismissBusAlert = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const resolvedBy = req.user.id;

    const alert = await BusAlert.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!alert) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Bus alert not found",
      });
    }

    const userRole = req.user?.role;
    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
        transaction,
      });

      if (!driver || driver.busId !== alert.busId) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "You are not authorized to dismiss this alert",
        });
      }
    }

    await alert.update(
      {
        status: "dismissed",
        resolvedBy,
        resolvedAt: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Bus alert dismissed successfully",
      alert,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error dismissing bus alert:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to dismiss bus alert",
      error: error.message,
    });
  }
};

/**
 * Get alert statistics
 */
const getAlertStatistics = async (req, res) => {
  try {
    const { startDate, endDate, busId } = req.query;

    const whereClause = {};

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const userRole = req.user?.role;
    if (userRole === "driver") {
      const driver = await BusDriver.findOne({
        where: { userId: req.user.id },
      });

      if (driver) {
        whereClause.busId = driver.busId;
      } else {
        return res.status(200).json({
          totalAlerts: 0,
          activeAlerts: 0,
          byType: [],
          bySeverity: [],
        });
      }
    } else if (busId) {
      whereClause.busId = busId;
    }

    const totalAlerts = await BusAlert.count({ where: whereClause });

    const activeAlerts = await BusAlert.count({
      where: { ...whereClause, status: "active" },
    });

    const alertsByType = await BusAlert.findAll({
      where: whereClause,
      attributes: [
        "alertType",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
      ],
      group: ["alertType"],
    });

    const alertsBySeverity = await BusAlert.findAll({
      where: whereClause,
      attributes: [
        "severity",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
      ],
      group: ["severity"],
    });

    return res.status(200).json({
      success: true,
      totalAlerts,
      activeAlerts,
      byType: alertsByType,
      bySeverity: alertsBySeverity,
    });
  } catch (error) {
    console.error("Error fetching alert statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch alert statistics",
      error: error.message,
    });
  }
};

module.exports = {
  createBusAlert,
  createSOSAlert,
  createDelayAlert,
  createArrivalNotification,
  getAllBusAlerts,
  getUnreadAlertsCount,
  markAlertAsRead,
  markAllAlertsAsRead,
  getActiveBusAlerts,
  getBusAlertById,
  resolveBusAlert,
  dismissBusAlert,
  getAlertStatistics,
};
