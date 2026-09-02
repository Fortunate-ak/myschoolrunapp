const db = require("../models/index");
const VehicleRoute = db.vehicleroutes;
const VehicleStop = db.vehiclestops;
const Vehicle = db.vehicles;
const Driver = db.drivers;
const VehicleToDriverAssignment = db.vehicletodriverassignments;
const User = db.users;
const logAudit = require("../utils/logAudit");
const requestIp = require("request-ip");
const { Op } = require("sequelize");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateRouteNumber = () => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ROUTE-${random}`;
};

/** Haversine distance in km */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Average vehicle speed km/h used for arrival time estimation */
const AVG_BUS_SPEED_KMH = 30;

/** Add minutes to a HH:MM:SS or HH:MM time string */
const addMinutesToTime = (timeStr, minutes) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
};

/**
 * Recalculate scheduled arrival times for all stops based on coordinates.
 * Uses Haversine distance + average speed for travel time, plus dwell time.
 */
const recalculateStopTimes = (stops, startTime, routeType = "both") => {
  if (!startTime || !stops || stops.length === 0) return stops;

  let cumulativeMinutes = 0;
  return stops.map((stop, idx) => {
    if (idx > 0) {
      const prev = stops[idx - 1];
      const prevLat = prev.location?.latitude;
      const prevLon = prev.location?.longitude;
      const curLat = stop.location?.latitude;
      const curLon = stop.location?.longitude;

      if (
        prevLat != null &&
        prevLon != null &&
        curLat != null &&
        curLon != null
      ) {
        const distKm = haversineDistance(prevLat, prevLon, curLat, curLon);
        const travelMin = (distKm / AVG_BUS_SPEED_KMH) * 60;
        const dwellMin = prev.estimatedWaitTime || 2;
        cumulativeMinutes += travelMin + dwellMin;
      } else {
        cumulativeMinutes += 5 + (stop.estimatedWaitTime || 2);
      }
    }

    const arrivalTime = addMinutesToTime(startTime, cumulativeMinutes);
    return {
      ...stop,
      scheduledPickupTime:
        routeType !== "dropoff" ? arrivalTime : stop.scheduledPickupTime,
      scheduledDropoffTime:
        routeType !== "pickup" ? arrivalTime : stop.scheduledDropoffTime,
    };
  });
};

/**
 * Calculate total distance (km) and estimated duration (minutes) from stops.
 */
const calculateRouteStats = (stops) => {
  if (!stops || stops.length < 2)
    return { totalDistance: 0, estimatedDuration: 0 };

  let totalKm = 0;
  for (let i = 1; i < stops.length; i++) {
    const { latitude: lat1, longitude: lon1 } = stops[i - 1].location || {};
    const { latitude: lat2, longitude: lon2 } = stops[i].location || {};
    if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
      totalKm += haversineDistance(lat1, lon1, lat2, lon2);
    }
  }

  const travelMinutes = (totalKm / AVG_BUS_SPEED_KMH) * 60;
  const dwellMinutes = stops.reduce(
    (acc, s) => acc + (s.estimatedWaitTime || 2),
    0,
  );

  return {
    totalDistance: Math.round(totalKm * 100) / 100,
    estimatedDuration: Math.round(travelMinutes + dwellMinutes),
  };
};

/** Validate and process stops payload */
const processStops = (rawStops, startTime, routeType) => {
  if (!rawStops || rawStops.length === 0) return [];

  const withOrder = rawStops.map((stop, idx) => ({
    ...stop,
    stopOrder: stop.stopOrder || idx + 1,
  }));

  for (const stop of withOrder) {
    if (!stop.stopName) {
      throw new Error(`Stop at order ${stop.stopOrder} is missing a name`);
    }
    if (stop.location?.latitude == null || stop.location?.longitude == null) {
      throw new Error(
        `Stop "${stop.stopName}" is missing coordinates. Please place it on the map.`,
      );
    }
    const lat = parseFloat(stop.location.latitude);
    const lon = parseFloat(stop.location.longitude);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Stop "${stop.stopName}" has invalid coordinates.`);
    }
  }

  const withTimes = recalculateStopTimes(withOrder, startTime, routeType);

  return withTimes.map((stop, idx) => ({
    id:
      stop.id && !stop.id.startsWith("temp_")
        ? stop.id
        : `stop_${Date.now()}_${idx}`,
    // Defaults to "school" — when a driver first creates a route, they're
    // entering the schools they serve. Home stops get added later, one per
    // guardian request, via guardianRequestController.approveRequest.
    stopType: stop.stopType === "home" ? "home" : "school",
    stopName: stop.stopName,
    stopOrder: stop.stopOrder || idx + 1,
    location: {
      latitude: parseFloat(stop.location.latitude),
      longitude: parseFloat(stop.location.longitude),
      address: stop.location.address || null,
    },
    scheduledPickupTime: stop.scheduledPickupTime || null,
    scheduledDropoffTime: stop.scheduledDropoffTime || null,
    estimatedWaitTime: stop.estimatedWaitTime || 2,
    landmark: stop.landmark || null,
    notes: stop.notes || null,
    isActive: stop.isActive !== undefined ? stop.isActive : true,
    createdAt: stop.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

/**
 * Ensure activeDays is always a parsed array.
 * Handles cases where it may come back as a JSON string from the DB.
 */
const parseActiveDays = (activeDays) => {
  if (Array.isArray(activeDays)) return activeDays;
  if (typeof activeDays === "string") {
    try {
      return JSON.parse(activeDays);
    } catch {
      // fall through to default
    }
  }
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
};

// ─── Create Vehicle Route ─────────────────────────────────────────────────────────

const createVehicleRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const {
      routeNumber,
      routeName,
      vehicleId,
      routeType = "both",
      startTime,
      estimatedEndTime,
      activeDays,
      totalDistance,
      estimatedDuration,
      stops,
    } = req.body;

    if (!routeName || !vehicleId || !startTime || !estimatedEndTime) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Route name, vehicle, start time, and end time are required",
      });
    }

    // Validate vehicle
    const vehicle = await Vehicle.findByPk(vehicleId, { transaction });
    if (!vehicle) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid or inactive vehicle" });
    }

    // Check duplicate route number
    if (routeNumber) {
      const existing = await VehicleRoute.findOne({
        where: { routeNumber },
        transaction,
      });
      if (existing) {
        await transaction.rollback();
        return res
          .status(409)
          .json({ message: "A route with this number already exists" });
      }
    }

    // Process and validate stops
    let processedStops = [];
    let finalTotalDistance = totalDistance;
    let finalEstimatedDuration = estimatedDuration;

    if (stops && stops.length > 0) {
      try {
        processedStops = processStops(stops, startTime, routeType);
      } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ message: err.message });
      }

      if (!finalTotalDistance || !finalEstimatedDuration) {
        const stats = calculateRouteStats(processedStops);
        finalTotalDistance = finalTotalDistance ?? stats.totalDistance;
        finalEstimatedDuration =
          finalEstimatedDuration ?? stats.estimatedDuration;
      }
    }

    // Create route — stops JSON column handled by model setter/getter
    const route = await VehicleRoute.create(
      {
        routeNumber: routeNumber || generateRouteNumber(),
        routeName,
        vehicleId,
        routeType,
        startTime,
        estimatedEndTime,
        activeDays: activeDays || [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        totalDistance: finalTotalDistance,
        estimatedDuration: finalEstimatedDuration,
        status: "active",
        isActive: true,
        stops: processedStops,
      },
      { transaction, hooks: true },
    );

    await transaction.commit();

    // Fetch complete route — no vehicleStops include, stops come from JSON column
    const completeRoute = await VehicleRoute.findByPk(route.id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: Driver,
              as: "driver",
              attributes: ["id", "licenseNumber"],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
      ],
    });

    const routeJson = completeRoute.toJSON();
    routeJson.activeDays = parseActiveDays(routeJson.activeDays);
    // route.stops already comes from the JSON getter — properly parsed objects

    await logAudit({
      userId: user.id,
      action: "create_vehivle_route",
      entity: "Vehicle Route",
      entityId: route.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent,
        timestamp: new Date().toISOString(),
        stopCount: processedStops.length,
        totalDistance: finalTotalDistance,
      },
    });

    return res.status(201).json({
      message: "Vehicle route created successfully",
      route: routeJson,
    });
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return res
      .status(500)
      .json({ message: "Server error: Failed to create vehicle route" });
  }
};

// ─── Get All Vehicle Routes ───────────────────────────────────────────────────────

const getAllVehicleRoutes = async (req, res) => {
  try {
    const { status, vehicleId, isActive } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (vehicleId) whereClause.vehicleId = vehicleId;
    if (isActive !== undefined) whereClause.isActive = isActive === "true";

    // No vehicleStops include — stops come from the JSON column getter
    const routes = await VehicleRoute.findAll({
      where: whereClause,
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: Driver,
              as: "driver",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
      ],
    });

    const parsedRoutes = routes.map((route) => {
      const routeJson = route.toJSON();
      routeJson.activeDays = parseActiveDays(routeJson.activeDays);
      // routeJson.stops comes from the model getter — already a parsed array
      // of objects with proper { latitude, longitude, address } shapes
      return routeJson;
    });

    return res.status(200).json({
      count: parsedRoutes.length,
      routes: parsedRoutes,
    });
  } catch (error) {
    console.error("Error fetching vehicle routes:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch vehicle routes" });
  }
};

// ─── Get Vehicle Routes Assigned to Driver ───────────────────────────────────────

const getVehicleRouteAssignedToDriver = async (req, res) => {
  const { id } = req.user;

  try {
    const driver = await Driver.findOne({ where: { userId: id } });
    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const vehicles = await Vehicle.findAll({ where: { driverId: driver.id } });

    if (vehicles.length === 0) {
      return res
        .status(404)
        .json({ message: "No vehicle assigned to this driver" });
    }

    const vehicleIds = vehicles.map((v) => v.id);

    // No vehicleStops include — stops come from the JSON column getter
    const routes = await VehicleRoute.findAll({
      where: { isActive: true, vehicleId: { [Op.in]: vehicleIds } },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: Driver,
              as: "driver",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
      ],
      order: [["routeNumber", "ASC"]],
    });

    const parsedRoutes = routes.map((route) => {
      const routeJson = route.toJSON();
      routeJson.activeDays = parseActiveDays(routeJson.activeDays);

      // stops comes from JSON getter — already parsed objects
      const validStops = (routeJson.stops || []).filter(
        (s) => s.location?.latitude != null && s.location?.longitude != null,
      );
      routeJson.totalStops = (routeJson.stops || []).length;
      routeJson.validStopsCount = validStops.length;
      routeJson.hasValidStops = validStops.length > 0;

      return routeJson;
    });

    return res.status(200).json({
      routes: parsedRoutes,
      vehicles,
      // Kept for backward compatibility with any existing consumers that
      // only expect a single vehicle — prefer `vehicles` for anything new,
      // since a driver can have more than one.
      vehicle: vehicles[0] || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Get Vehicle Route by ID ──────────────────────────────────────────────────────

const getVehicleRouteById = async (req, res) => {
  try {
    const { id } = req.params;

    // No vehicleStops include — stops come from the JSON column getter
    const route = await VehicleRoute.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: Driver,
              as: "driver",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
        {
          model: db.vehicleassignments,
          as: "studentAssignments",
          where: { status: "active" },
          required: false,
          include: [{ model: db.students, as: "student" }],
        },
      ],
    });

    if (!route) {
      return res.status(404).json({ message: "Vehicle route not found" });
    }

    const routeJson = route.toJSON();
    routeJson.activeDays = parseActiveDays(routeJson.activeDays);
    // routeJson.stops already comes from the JSON getter — no mapping needed

    return res.status(200).json(routeJson);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch vehicle route" });
  }
};

// ─── Update Vehicle Route ─────────────────────────────────────────────────────────

const updateVehicleRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const user = req.user;

  try {
    const { id } = req.params;
    const {
      routeName,
      vehicleId,
      routeType,
      startTime,
      estimatedEndTime,
      activeDays,
      totalDistance,
      estimatedDuration,
      status,
      isActive,
      stops,
    } = req.body;

    const route = await VehicleRoute.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Vehicle route not found" });
    }

    // Validate vehicle if changed
    if (vehicleId && vehicleId !== route.vehicleId) {
      const vehicle = await Vehicle.findByPk(vehicleId, { transaction });
      if (!vehicle || vehicle.status !== "active") {
        await transaction.rollback();
        return res.status(400).json({ message: "Invalid or inactive vehicle" });
      }
    }

    const effectiveStartTime = startTime || route.startTime;
    const effectiveRouteType = routeType || route.routeType;

    // Process stops with recalculated times
    let processedStops = route.stops;
    let finalTotalDistance = totalDistance ?? route.totalDistance;
    let finalEstimatedDuration = estimatedDuration ?? route.estimatedDuration;

    if (stops !== undefined) {
      if (stops && stops.length > 0) {
        try {
          processedStops = processStops(
            stops,
            effectiveStartTime,
            effectiveRouteType,
          );
        } catch (err) {
          await transaction.rollback();
          return res.status(400).json({ message: err.message });
        }

        const stats = calculateRouteStats(processedStops);
        if (!totalDistance) finalTotalDistance = stats.totalDistance;
        if (!estimatedDuration)
          finalEstimatedDuration = stats.estimatedDuration;
      } else {
        processedStops = [];
      }
    } else if (startTime && route.stops && route.stops.length > 0) {
      processedStops = recalculateStopTimes(
        route.stops,
        startTime,
        effectiveRouteType,
      );
    }

    await route.update(
      {
        routeName: routeName || route.routeName,
        vehicleId: vehicleId || route.vehicleId,
        routeType: routeType || route.routeType,
        startTime: startTime || route.startTime,
        estimatedEndTime: estimatedEndTime || route.estimatedEndTime,
        activeDays: activeDays || route.activeDays,
        totalDistance: finalTotalDistance,
        estimatedDuration: finalEstimatedDuration,
        status: status || route.status,
        isActive: isActive !== undefined ? isActive : route.isActive,
        stops: processedStops,
      },
      { transaction, hooks: true },
    );

    await transaction.commit();

    // Fetch updated route — no vehicleStops include
    const updatedRoute = await VehicleRoute.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "registrationNumber", "capacity"],
          include: [
            {
              model: Driver,
              as: "driver",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
      ],
    });

    const routeJson = updatedRoute.toJSON();
    routeJson.activeDays = parseActiveDays(routeJson.activeDays);

    await logAudit({
      userId: user.id,
      action: "update_vehicle_route",
      entity: "Vehicle Route",
      entityId: route.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Vehicle route updated successfully",
      route: routeJson,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error updating vehicle route:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to update vehicle route" });
  }
};

// ─── Add Stop to Route ────────────────────────────────────────────────────────

const addStopToRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const user = req.user;

  try {
    const { routeId } = req.params;
    const stopData = req.body;

    if (!stopData.stopName) {
      await transaction.rollback();
      return res.status(400).json({ message: "Stop name is required" });
    }

    if (
      stopData.location?.latitude == null ||
      stopData.location?.longitude == null
    ) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Stop coordinates (latitude & longitude) are required",
      });
    }

    const route = await VehicleRoute.findByPk(routeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Vehicle route not found" });
    }

    // Add stop to JSON
    const newStop = route.addStop({
      ...stopData,
      stopType: stopData.stopType === "home" ? "home" : "school",
    });

    // Recalculate times and stats
    const updatedStops = recalculateStopTimes(
      route.stops,
      route.startTime,
      route.routeType,
    );
    route.stops = updatedStops;

    const stats = calculateRouteStats(updatedStops);
    route.totalDistance = stats.totalDistance;
    route.estimatedDuration = stats.estimatedDuration;

    await route.save({ transaction, hooks: true });

    await transaction.commit();

    return res.status(200).json({
      message: "Stop added successfully",
      stop: newStop,
      route: {
        id: route.id,
        routeName: route.routeName,
        stops: route.stops,
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adding stop:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to add stop" });
  }
};

// ─── Update Vehicle Stop ──────────────────────────────────────────────────────────

const updateVehicleStop = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { stopId } = req.params;
    const updates = req.body;

    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "No update data provided",
      });
    }

    // Find route containing this stop using JSON containment
    const targetRoute = await VehicleRoute.findOne({
      where: {
        stops: {
          [Op.contains]: [{ id: stopId }],
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!targetRoute) {
      await transaction.rollback();
      return res.status(404).json({ message: "Stop not found" });
    }

    // Find the stop index
    const stopIndex = (targetRoute.stops || []).findIndex(
      (s) => s.id === stopId,
    );

    if (stopIndex === -1) {
      await transaction.rollback();
      return res.status(404).json({ message: "Stop not found in route" });
    }

    // Update stop in JSON
    targetRoute.updateStop(stopId, updates);

    // Recalculate times and stats
    const updatedStops = recalculateStopTimes(
      targetRoute.stops,
      targetRoute.startTime,
      targetRoute.routeType,
    );
    targetRoute.stops = updatedStops;

    const stats = calculateRouteStats(updatedStops);
    targetRoute.totalDistance = stats.totalDistance;
    targetRoute.estimatedDuration = stats.estimatedDuration;

    await targetRoute.save({ transaction, hooks: true });

    await transaction.commit();

    return res.status(200).json({
      message: "Vehicle stop updated successfully",
      stop: targetRoute.stops[stopIndex],
      route: {
        id: targetRoute.id,
        routeName: targetRoute.routeName,
        stops: targetRoute.stops,
        totalDistance: targetRoute.totalDistance,
        estimatedDuration: targetRoute.estimatedDuration,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res
      .status(500)
      .json({ message: "Server error: Failed to update vehicle stop" });
  }
};

// ─── Update Bulk Vehicle Stop ──────────────────────────────────────────────────────────
const bulkUpdateStops = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { routeId } = req.params;
    const { stops } = req.body;

    if (!stops || !Array.isArray(stops)) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Stops array required",
      });
    }

    const route = await VehicleRoute.findByPk(routeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Route not found" });
    }

    // Update all stops in one go
    for (const stopUpdate of stops) {
      if (!stopUpdate.id) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Stop ID required for each update",
        });
      }
      route.updateStop(stopUpdate.id, stopUpdate);
    }

    // Recalculate everything once
    const updatedStops = recalculateStopTimes(
      route.stops,
      route.startTime,
      route.routeType,
    );
    route.stops = updatedStops;

    const stats = calculateRouteStats(updatedStops);
    route.totalDistance = stats.totalDistance;
    route.estimatedDuration = stats.estimatedDuration;

    await route.save({ transaction, hooks: true });
    await transaction.commit();

    return res.status(200).json({
      message: "Stops updated successfully",
      route: {
        id: route.id,
        stops: route.stops,
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Server error: Failed to update stops",
    });
  }
};
// ─── Delete Stop from Route ───────────────────────────────────────────────────

const deleteStopFromRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const user = req.user;

  try {
    const { stopId } = req.params;

    // Check if students are assigned to this stop
    const studentCount = await db.students.count({
      where: { vehicleStopId: stopId },
      transaction,
    });

    if (studentCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Cannot delete stop. ${studentCount} student(s) are assigned to this stop.`,
      });
    }

    // Find route containing this stop
    const routes = await VehicleRoute.findAll({ transaction });
    let targetRoute = null;

    for (const route of routes) {
      if ((route.stops || []).some((s) => s.id === stopId)) {
        targetRoute = route;
        break;
      }
    }

    if (!targetRoute) {
      await transaction.rollback();
      return res.status(404).json({ message: "Stop not found" });
    }

    // Remove stop from JSON
    targetRoute.removeStop(stopId);

    // Recalculate times and stats
    const updatedStops = recalculateStopTimes(
      targetRoute.stops,
      targetRoute.startTime,
      targetRoute.routeType,
    );
    targetRoute.stops = updatedStops;

    const stats = calculateRouteStats(updatedStops);
    targetRoute.totalDistance = stats.totalDistance;
    targetRoute.estimatedDuration = stats.estimatedDuration;

    await targetRoute.save({ transaction, hooks: true });

    await transaction.commit();

    await logAudit({
      userId: user.id,
      action: "delete_stop_from_route",
      entity: "Vehicle Route",
      entityId: stopId,
      metadata: {
        routeId: targetRoute.id,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Vehicle stop deleted successfully",
      route: {
        id: targetRoute.id,
        routeName: targetRoute.routeName,
        stops: targetRoute.stops,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting vehicle stop:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to delete vehicle stop" });
  }
};

// ─── Reorder Route Stops ──────────────────────────────────────────────────────

const reorderRouteStops = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const user = req.user;

  try {
    const { routeId } = req.params;
    const { stopOrder } = req.body;

    const route = await VehicleRoute.findByPk(routeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Vehicle route not found" });
    }

    if (!stopOrder || !Array.isArray(stopOrder)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "stopOrder must be an array of stop IDs" });
    }

    // Reorder stops
    route.reorderStops(stopOrder);

    // Recalculate times and stats
    const updatedStops = recalculateStopTimes(
      route.stops,
      route.startTime,
      route.routeType,
    );
    route.stops = updatedStops;

    const stats = calculateRouteStats(updatedStops);
    route.totalDistance = stats.totalDistance;
    route.estimatedDuration = stats.estimatedDuration;

    await route.save({ transaction, hooks: true });

    await transaction.commit();

    await logAudit({
      userId: user.id,
      action: "reorder_route_stops",
      entity: "Vehicle Route",
      entityId: route.id,
      metadata: { action: "reorder", timestamp: new Date().toISOString() },
    });

    return res.status(200).json({
      message: "Stops reordered successfully",
      stops: route.stops,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error reordering stops:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to reorder stops" });
  }
};

// ─── Get Route Schedule for Today ────────────────────────────────────────────

const getRouteScheduleForToday = async (req, res) => {
  try {
    const { routeId } = req.params;

    // No vehicleStops include — stops come from the JSON column getter
    const route = await VehicleRoute.findByPk(routeId, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "registrationNumber", "capacity"],
          include: [
            {
              model: VehicleToDriverAssignment,
              as: "driverAssignments",
              include: [
                {
                  model: Driver,
                  as: "driver",
                  attributes: [
                    "id",
                    "licenseNumber",
                    "medicalCertificateExpiry",
                  ],
                  include: [
                    {
                      model: User,
                      as: "user",
                      attributes: ["id", "fullname", "phone"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!route) {
      return res.status(404).json({ message: "Vehicle route not found" });
    }

    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

    // route.stops comes from JSON getter — already parsed with proper coordinates
    const stopsSchedule = recalculateStopTimes(
      route.stops || [],
      route.startTime,
      route.routeType,
    );

    const routeJson = route.toJSON();
    routeJson.activeDays = parseActiveDays(routeJson.activeDays);

    const response = {
      route: { ...routeJson, stops: stopsSchedule },
      isActiveToday: (routeJson.activeDays || []).includes(today),
      today,
    };

    if (!response.isActiveToday) {
      response.message = `Route is not active on ${today}`;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching route schedule:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch route schedule" });
  }
};

const deleteRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const { id } = req.params;

  try {
    const route = await VehicleRoute.findByPk(id, {
      transaction,
    });

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Route not found" });
    }

    await route.destroy({ transaction });

    await transaction.commit();

    console.log("route deleted", route.routeName);

    await logAudit({
      userId: req.user.id,
      action: "delete_route",
      entity: "Vehicle Route",
      entityId: route.id,
      metadata: {
        email: req.user?.email,
        role: req.user?.role?.name,
        routeId: route.id,
        routeName: route.routeName,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({ message: "Route deleted successfully" });
  } catch (error) {
    console.error(error);
    if (!transaction.finished) {
      await transaction.rollback();
    }
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createVehicleRoute,
  getAllVehicleRoutes,
  getVehicleRouteById,
  updateVehicleRoute,
  addStopToRoute,
  updateVehicleStop,
  deleteStopFromRoute,
  reorderRouteStops,
  getRouteScheduleForToday,
  getVehicleRouteAssignedToDriver,
  deleteRoute,
  bulkUpdateStops,
};
