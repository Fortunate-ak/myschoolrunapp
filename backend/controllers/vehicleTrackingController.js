const db = require("../models/index");
const VehicleTracking = db.vehicletracking;
const Vehicle = db.vehicles;
const VehicleRoute = db.vehicleroutes;
const VehicleStop = db.vehiclestops;
const VehicleAlert = db.vehiclealerts;
const {
  sendLocationUpdateNotification,
  sendETANotification,
} = require("../services/vehicleNotificationService");
const VehicleMonitoringService = require("../services/vehicleMonitoringService");
const {
  sendVehicleArrivalNotification,
} = require("../services/vehicleNotificationService");
// FIX: the arrival/departure notifications below were created with
// db.notifications.create() + a raw socket emit, bypassing the shared
// notificationService.js choke point entirely — that's the only place
// that ever calls sendPushNotificationToUser/ToMultipleUsers. That's why
// these showed up in-app (DB row + socket event) but never as a real OS
// push, unlike vehicle-stop-arrival / trip-start / messages, which all go
// through notifyUser/notifyGuardiansOnVehicle in notificationService.js.
const {
  sendPushNotificationToUser,
} = require("../services/pushNotificationService");
const Student = db.students;
const User = db.users;
const Driver = db.drivers;

const getStudentsAtStop = async (stopId, transaction) => {
  return await Student.findAll({
    where: { vehicleStopId: stopId, isActive: true },
    include: [
      {
        model: db.guardians,
        as: "guardians",
        include: [
          {
            model: db.users,
            as: "user",
            attributes: ["id", "fullname", "email", "phone"],
          },
        ],
      },
      {
        model: db.vehicleroutes,
        as: "vehicleRoute",
        attributes: ["id", "routeNumber", "routeName"],
      },
    ],
    transaction,
  });
};

/**
 * Check if vehicle is approaching a stop and send notifications
 */
const checkAndNotifyStopApproach = async (
  vehicle,
  routeId,
  stop,
  distance,
  speed,
  latitude,
  longitude,
  transaction,
  io,
) => {
  // Check if we've already notified for this stop recently
  const recentAlert = await VehicleAlert.findOne({
    where: {
      vehicleId: vehicle.id,
      stopId: stop.id,
      alertType: "arrival",
      status: "active",
      createdAt: {
        [db.Sequelize.Op.gte]: new Date(Date.now() - 15 * 60000),
      },
    },
    transaction,
  });

  if (recentAlert) return null;

  const studentsAtStop = await getStudentsAtStop(stop.id, transaction);
  if (studentsAtStop.length === 0) return null;

  const etaMinutes = Math.round((distance / 1000 / (speed || 30)) * 60);

  // Create arrival alert
  const alert = await VehicleAlert.create(
    {
      vehicleId: vehicle.id,
      routeId,
      stopId: stop.id,
      alertType: "arrival",
      severity: "low",
      title: "Vehicle Approaching Stop",
      message: `Vehicle ${vehicle.registrationNumber} is approaching ${stop.stopName}`,
      location: { latitude, longitude },
      affectedStudents: studentsAtStop.map((s) => s.id),
      status: "active",
    },
    { transaction },
  );

  // Send notifications
  const notifications = [];
  for (const student of studentsAtStop) {
    for (const guardian of student.guardians) {
      if (guardian.user?.id) {
        const notification = await db.notifications.create(
          {
            userId: guardian.user.id,
            title: "School Vehicle Approaching",
            message: `${student.fullname || "Your child"}'s vehicle is arriving at ${stop.stopName} in approximately ${etaMinutes} minutes`,
            notifType: "info",
            entityType: "vehicle_arrival",
            entityId: alert.id,
            metadata: {
              vehicleId: vehicle.id,
              registrationNumber: vehicle.registrationNumber,
              stopId: stop.id,
              stopName: stop.stopName,
              studentId: student.id,
              studentName: student.fullname,
              eta: etaMinutes,
              distance: Math.round(distance),
              location: { latitude, longitude },
            },
          },
          { transaction },
        );
        notifications.push(notification);

        // Emit socket event
        if (io) {
          io.to(`user-${guardian.user.id}`).emit("vehicle-arrival", {
            type: "vehicle_arrival",
            data: {
              vehicleId: vehicle.id,
              registrationNumber: vehicle.registrationNumber,
              stopId: stop.id,
              stopName: stop.stopName,
              studentId: student.id,
              studentName: student.fullname,
              eta: etaMinutes,
              distance: Math.round(distance),
              location: { latitude, longitude },
              timestamp: new Date(),
            },
          });
        }
      }
    }
  }

  return { alert, notifications, studentsCount: studentsAtStop.length };
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // meters
};

// controllers/vehicleTrackingController.js - Update findNearestStop to use JSON stops

const findNearestStop = async (routeId, latitude, longitude) => {
  // Get the route with its JSON stops
  const route = await db.vehicleroutes.findByPk(routeId, {
    attributes: ["id", "stops"],
  });

  if (!route || !route.stops || !Array.isArray(route.stops)) {
    return null;
  }

  let nearestStop = null;
  let minDistance = Infinity;

  for (const stop of route.stops) {
    if (!stop.isActive) continue;

    const distance = calculateDistance(
      latitude,
      longitude,
      stop.location.latitude,
      stop.location.longitude,
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestStop = { stop, distance };
    }
  }

  return nearestStop;
};

/**
 * Record vehicle location update (from GPS device or simulator)
 *
 * Architecture:
 *  1. Fast path  — open a SHORT transaction, write ONE tracking row (+ optional
 *     speeding alert), commit immediately.  This is the only work that holds a
 *     DB lock.  Target duration: < 50 ms.
 *
 *  2. Slow path  — after the transaction is committed, run all expensive queries
 *     (student lookups, departure detection, student-route status, monitoring)
 *     WITHOUT a transaction.  These reads are eventually-consistent and tolerate
 *     being a second behind.
 *
 *  3. Socket broadcast — fired right after the fast-path commit so the guardian
 *     TrackScreen gets real-time updates even if the slow path hasn't finished.
 *
 * This collapses ~12 serialised DB round-trips per update into 1-2, eliminating
 * the "Lock wait timeout" / connection-pool exhaustion that the simulator caused.
 */
const recordLocationUpdate = async (req, res) => {
  // ── Validation ──────────────────────────────────────────────────────────────
  const {
    vehicleId,
    routeId,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    engineStatus,
    fuelLevel,
    deviceId,
    currentStopIndex: clientStopIndex,
    currentStopId: clientCurrentStopId,
    nextStopId: clientNextStopId,
    tripEnded,
  } = req.body;

  if (!vehicleId || latitude == null || longitude == null) {
    return res
      .status(400)
      .json({ message: "Vehicle ID, latitude, and longitude are required" });
  }

  // ── FAST PATH — minimal locked transaction ───────────────────────────────────
  // Isolation level READ COMMITTED: no gap locks, no "FOR UPDATE" on the vehicles
  // row.  We only need to INSERT a new tracking row and optionally INSERT one
  // alert — both are pure inserts that never contend with other writers.
  let tracking;
  let vehicle;
  let status;

  try {
    const t = await db.sequelize.transaction({
      isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Read vehicle WITHOUT locking (we only need registrationNumber for notifications)
      vehicle = await Vehicle.findByPk(vehicleId, {
        attributes: ["id", "registrationNumber", "carMake", "carModel"],
        transaction: t,
        lock: false, // ← key change: no FOR UPDATE
      });

      if (!vehicle) {
        await t.rollback();
        return res.status(404).json({ message: "Vehicle not found" });
      }

      // Determine movement status
      status =
        speed !== undefined ? (speed < 1 ? "stopped" : "moving") : "moving";

      // Speeding alert (still inside transaction so it's atomic with the row)
      if (speed && speed > 80) {
        await VehicleAlert.create(
          {
            vehicleId,
            routeId,
            alertType: "speeding",
            severity: "high",
            title: "Speeding Alert",
            message: `Vehicle ${vehicle.registrationNumber} is traveling at ${speed} km/h`,
            location: { latitude, longitude },
            status: "active",
          },
          { transaction: t },
        );
      }

      // Insert tracking row
      tracking = await VehicleTracking.create(
        {
          vehicleId,
          routeId,
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          currentStopId: clientCurrentStopId || null,
          distanceToNextStop: null, // filled by slow path if needed
          status,
          engineStatus,
          fuelLevel,
          deviceId,
          timestamp: new Date(),
        },
        { transaction: t },
      );

      await t.commit();
    } catch (innerErr) {
      await t.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error("Error recording location update:", err);
    return res.status(500).json({
      message: "Server error: Failed to record location update",
      error: err.message,
    });
  }

  // ── Socket broadcast — immediately after commit ───────────────────────────
  // Guardian TrackScreen receives this within milliseconds.
  const io = req.io;
  if (io) {
    const socketPayload = {
      id: tracking.id,
      vehicleId,
      registrationNumber: vehicle.registrationNumber,
      carMake: vehicle.carMake,
      carModel: vehicle.carModel,
      routeId,
      latitude,
      longitude,
      speed: speed ?? 0,
      heading: heading ?? 0,
      status,
      currentStopIndex: clientStopIndex ?? null,
      currentStopId: clientCurrentStopId ?? null,
      nextStopId: clientNextStopId ?? null,
      engineStatus,
      fuelLevel,
      timestamp: tracking.timestamp,
      isSimulated: req.body.isSimulated || false,
    };

    io.to("vehicle-tracking").emit("vehicle-location-update", socketPayload);
    io.to(`vehicle-${vehicleId}`).emit(
      "vehicle-location-update",
      socketPayload,
    );
  }

  // Respond to driver/simulator immediately — don't wait for slow path
  res.status(201).json({
    message: "Location updated successfully",
    tracking: { id: tracking.id, timestamp: tracking.timestamp },
  });

  // ── SLOW PATH — no transaction, runs after response is sent ─────────────────
  // Errors here are logged but do NOT affect the HTTP response.
  setImmediate(async () => {
    try {
      // Find nearest stop (read-only, no transaction needed)
      let nearestStopResult = null;
      let currentStop = null;

      if (routeId) {
        nearestStopResult = await findNearestStop(routeId, latitude, longitude);
        if (nearestStopResult && nearestStopResult.distance < 100) {
          currentStop = nearestStopResult.stop;
        }
      }

      // ── Stop-approach notifications ─────────────────────────────────────
      if (currentStop && nearestStopResult) {
        // Check for recent alert in last 15 min (read-only)
        const recentAlert = await VehicleAlert.findOne({
          where: {
            vehicleId,
            stopId: currentStop.id,
            alertType: "arrival",
            status: "active",
            createdAt: {
              [db.Sequelize.Op.gte]: new Date(Date.now() - 15 * 60000),
            },
          },
        });

        if (!recentAlert) {
          const studentsAtStop = await getStudentsAtStop(currentStop.id, null);

          if (studentsAtStop.length > 0) {
            const etaMinutes = Math.round(
              (nearestStopResult.distance / 1000 / (speed || 30)) * 60,
            );

            // Create alert + notifications (separate small transaction)
            const t2 = await db.sequelize.transaction({
              isolationLevel:
                db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            });
            try {
              const arrivalAlert = await VehicleAlert.create(
                {
                  vehicleId,
                  routeId,
                  stopId: currentStop.id,
                  alertType: "arrival",
                  severity: "low",
                  title: "Vehicle Approaching Stop",
                  message: `Vehicle ${vehicle.registrationNumber} is approaching ${currentStop.stopName}`,
                  location: { latitude, longitude },
                  affectedStudents: studentsAtStop.map((s) => s.id),
                  status: "active",
                },
                { transaction: t2 },
              );

              for (const student of studentsAtStop) {
                for (const guardian of student.guardians) {
                  if (!guardian.user?.id) continue;
                  await db.notifications.create(
                    {
                      userId: guardian.user.id,
                      title: "School Vehicle Approaching",
                      message: `${student.fullname || "Your child"}'s vehicle is arriving at ${currentStop.stopName} in approximately ${etaMinutes} minutes`,
                      notifType: "info",
                      entityType: "vehicle_arrival",
                      entityId: arrivalAlert.id,
                      metadata: {
                        vehicleId,
                        registrationNumber: vehicle.registrationNumber,
                        stopId: currentStop.id,
                        stopName: currentStop.stopName,
                        studentId: student.id,
                        studentName: student.fullname,
                        eta: etaMinutes,
                        distance: Math.round(nearestStopResult.distance),
                        location: { latitude, longitude },
                      },
                    },
                    { transaction: t2 },
                  );
                }
              }
              await t2.commit();

              // Socket notify guardians
              if (io) {
                for (const student of studentsAtStop) {
                  for (const guardian of student.guardians) {
                    if (!guardian.user?.id) continue;
                    io.to(`user-${guardian.user.id}`).emit("vehicle-arrival", {
                      type: "vehicle_arrival",
                      data: {
                        vehicleId,
                        registrationNumber: vehicle.registrationNumber,
                        stopId: currentStop.id,
                        stopName: currentStop.stopName,
                        studentId: student.id,
                        studentName: student.fullname,
                        eta: etaMinutes,
                        distance: Math.round(nearestStopResult.distance),
                        location: { latitude, longitude },
                        timestamp: new Date(),
                      },
                    });
                  }
                }
              }

              // FIX: this loop only ever did the DB row + socket emit above,
              // so guardians never got an OS push for automatic "approaching
              // stop" detection (unlike the manual driver-confirmed arrival
              // in vehicleNotificationService.js, which goes through
              // notifyGuardiansOnVehicle). Fire the push directly, mirroring
              // buildPushData's channel/priority conventions for
              // "vehicle_arrival" (channelId: "tracking").
              for (const student of studentsAtStop) {
                for (const guardian of student.guardians) {
                  if (!guardian.user?.id) continue;
                  sendPushNotificationToUser(
                    guardian.user.id,
                    "School Vehicle Approaching",
                    `${student.fullname || "Your child"}'s vehicle is arriving at ${currentStop.stopName} in approximately ${etaMinutes} minutes`,
                    {
                      entityType: "vehicle_arrival",
                      entityId: arrivalAlert.id,
                      channelId: "tracking",
                      vehicleId,
                      registrationNumber: vehicle.registrationNumber,
                      stopId: currentStop.id,
                      stopName: currentStop.stopName,
                      studentId: student.id,
                      studentName: student.fullname,
                      eta: etaMinutes,
                    },
                  ).catch((err) =>
                    console.error(
                      "[Tracking] Arrival push notification failed:",
                      err.message,
                    ),
                  );
                }
              }
            } catch (e) {
              await t2.rollback();
              console.error(
                "[Tracking] Stop-approach notification failed:",
                e.message,
              );
            }
          }
        }
      }

      // ── Departure detection ─────────────────────────────────────────────
      // Only run if vehicle is NOT currently at a stop
      if (!currentStop) {
        const previousTracking = await VehicleTracking.findOne({
          where: {
            vehicleId,
            id: { [db.Sequelize.Op.ne]: tracking.id },
          },
          order: [["timestamp", "DESC"]],
          attributes: ["currentStopId"],
        });

        if (previousTracking?.currentStopId) {
          const departedStopId = previousTracking.currentStopId;
          const departingStop = await db.vehiclestops.findByPk(departedStopId);

          if (departingStop) {
            const studentsAtDepartingStop = await db.students.findAll({
              where: { vehicleStopId: departedStopId, isActive: true },
              include: [
                {
                  model: db.guardians,
                  as: "guardians",
                  include: [{ model: db.users, as: "user" }],
                },
              ],
            });

            if (studentsAtDepartingStop.length > 0) {
              const t3 = await db.sequelize.transaction({
                isolationLevel:
                  db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
              });
              try {
                const departureAlert = await VehicleAlert.create(
                  {
                    vehicleId,
                    routeId,
                    stopId: departedStopId,
                    alertType: "departure",
                    severity: "low",
                    title: "Vehicle Departed",
                    message: `Vehicle ${vehicle.registrationNumber} has departed from ${departingStop.stopName}`,
                    location: { latitude, longitude },
                    affectedStudents: studentsAtDepartingStop.map((s) => s.id),
                    status: "active",
                  },
                  { transaction: t3 },
                );

                for (const student of studentsAtDepartingStop) {
                  for (const guardian of student.guardians) {
                    if (!guardian.user?.id) continue;
                    await db.notifications.create(
                      {
                        userId: guardian.user.id,
                        title: "Vehicle Departed",
                        message: `${student.fullname || "Your child"}'s vehicle has departed from ${departingStop.stopName}`,
                        notifType: "info",
                        entityType: "vehicle_departure",
                        entityId: departureAlert.id,
                        metadata: {
                          vehicleId,
                          registrationNumber: vehicle.registrationNumber,
                          stopId: departedStopId,
                          stopName: departingStop.stopName,
                          studentId: student.id,
                          studentName: student.fullname,
                          location: { latitude, longitude },
                        },
                      },
                      { transaction: t3 },
                    );
                  }
                }
                await t3.commit();

                if (io) {
                  for (const student of studentsAtDepartingStop) {
                    for (const guardian of student.guardians) {
                      if (!guardian.user?.id) continue;
                      io.to(`user-${guardian.user.id}`).emit(
                        "vehicle-departure",
                        {
                          type: "vehicle_departure",
                          data: {
                            vehicleId,
                            registrationNumber: vehicle.registrationNumber,
                            stopId: departedStopId,
                            stopName: departingStop.stopName,
                            studentId: student.id,
                            studentName: student.fullname,
                            location: { latitude, longitude },
                            timestamp: new Date(),
                          },
                        },
                      );
                    }
                  }
                }

                // FIX: same gap as the arrival block above — departure was
                // only ever a DB row + socket emit, no push.
                for (const student of studentsAtDepartingStop) {
                  for (const guardian of student.guardians) {
                    if (!guardian.user?.id) continue;
                    sendPushNotificationToUser(
                      guardian.user.id,
                      "Vehicle Departed",
                      `${student.fullname || "Your child"}'s vehicle has departed from ${departingStop.stopName}`,
                      {
                        entityType: "vehicle_departure",
                        entityId: departureAlert.id,
                        channelId: "tracking",
                        vehicleId,
                        registrationNumber: vehicle.registrationNumber,
                        stopId: departedStopId,
                        stopName: departingStop.stopName,
                        studentId: student.id,
                        studentName: student.fullname,
                      },
                    ).catch((err) =>
                      console.error(
                        "[Tracking] Departure push notification failed:",
                        err.message,
                      ),
                    );
                  }
                }
              } catch (e) {
                await t3.rollback();
                console.error(
                  "[Tracking] Departure notification failed:",
                  e.message,
                );
              }
            }
          }
        }
      }

      // ── Vehicle monitoring service (read-only analysis) ─────────────────────
      await VehicleMonitoringService.processLocationUpdate({
        vehicleId,
        routeId,
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date(),
      }).catch((err) =>
        console.error("[Tracking] Monitoring service error:", err.message),
      );

      // ── Fire-and-forget push notifications ─────────────────────────────
      if (speed && speed > 0) {
        sendLocationUpdateNotification(vehicleId, tracking.toJSON(), io).catch(
          (err) =>
            console.error("[Tracking] Push notification failed:", err.message),
        );
      }
    } catch (slowErr) {
      console.error("[Tracking] Slow-path error (non-fatal):", slowErr.message);
    }
  });
};

/**
 * Get current location of a vehicle
 */
const getCurrentVehicleLocation = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const latestTracking = await VehicleTracking.findOne({
      where: { vehicleId },
      order: [["timestamp", "DESC"]],
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["registrationNumber", "carMake", "carModel"],
        },
        {
          model: VehicleRoute,
          as: "route",
          attributes: ["routeNumber", "routeName"],
        },
        { model: VehicleStop, as: "currentStop" },
      ],
    });

    if (!latestTracking) {
      return res
        .status(404)
        .json({ message: "No tracking data available for this vehicle" });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isStale = new Date(latestTracking.timestamp) < fiveMinutesAgo;

    return res.status(200).json({
      tracking: latestTracking,
      isStale,
      lastUpdate: latestTracking.timestamp,
    });
  } catch (error) {
    console.error("Error fetching current vehicle location:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch current vehicle location",
      error: error.message,
    });
  }
};

/**
 * Get tracking history for a vehicle
 */
const getVehicleTrackingHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate, routeId } = req.query;

    const whereClause = { vehicleId };
    if (routeId) whereClause.routeId = routeId;
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate)
        whereClause.timestamp[db.Sequelize.Op.gte] = new Date(startDate);
      if (endDate)
        whereClause.timestamp[db.Sequelize.Op.lte] = new Date(endDate);
    }

    const trackingHistory = await VehicleTracking.findAll({
      where: whereClause,
      include: [
        {
          model: VehicleRoute,
          as: "route",
          attributes: ["routeNumber", "routeName"],
        },
        {
          model: VehicleStop,
          as: "currentStop",
          attributes: ["stopName", "stopOrder"],
        },
      ],
      order: [["timestamp", "DESC"]],
      limit: 1000,
    });

    return res
      .status(200)
      .json({ count: trackingHistory.length, history: trackingHistory });
  } catch (error) {
    console.error("Error fetching tracking history:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch tracking history",
      error: error.message,
    });
  }
};

/**
 * Get live tracking for all active vehicles
 */
const getAllActiveVehicleLocations = async (req, res) => {
  try {
    const activeVehiclees = await Vehicle.findAll({
      where: { status: "active", isActive: true },
      attributes: ["id", "registrationNumber", "carMake", "carModel"],
    });

    const vehicleLocations = await Promise.all(
      activeVehiclees.map(async (vehicle) => {
        const latestTracking = await VehicleTracking.findOne({
          where: { vehicleId: vehicle.id },
          order: [["timestamp", "DESC"]],
          include: [
            {
              model: VehicleRoute,
              as: "route",
              attributes: ["routeNumber", "routeName"],
            },
            { model: VehicleStop, as: "currentStop", attributes: ["stopName"] },
          ],
        });

        return {
          vehicle: {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            carMake: vehicle.carMake,
            carModel: vehicle.carModel,
          },
          latestTracking,
          isOnline: latestTracking
            ? new Date(latestTracking.timestamp) >
              new Date(Date.now() - 5 * 60 * 1000)
            : false,
        };
      }),
    );

    return res
      .status(200)
      .json({ count: vehicleLocations.length, vehicles: vehicleLocations });
  } catch (error) {
    console.error("Error fetching all vehicle locations:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch all vehicle locations",
      error: error.message,
    });
  }
};

/**
 * Get ETA to stop
 */
const getETAToStop = async (req, res) => {
  try {
    const { vehicleId, stopId } = req.params;

    const latestTracking = await VehicleTracking.findOne({
      where: { vehicleId },
      order: [["timestamp", "DESC"]],
    });

    if (!latestTracking)
      return res.status(404).json({ message: "No tracking data available" });

    const stop = await VehicleStop.findByPk(stopId);
    if (!stop) return res.status(404).json({ message: "Stop not found" });

    const distance = calculateDistance(
      latestTracking.latitude,
      latestTracking.longitude,
      stop.location.latitude,
      stop.location.longitude,
    );

    const averageSpeed = latestTracking.speed || 30;
    const etaMinutes = Math.round((distance / 1000 / averageSpeed) * 60);
    const eta = new Date(Date.now() + etaMinutes * 60 * 1000);

    return res.status(200).json({
      distance: Math.round(distance),
      etaMinutes,
      eta,
      currentSpeed: latestTracking.speed,
      stopName: stop.stopName,
    });
  } catch (error) {
    console.error("Error calculating ETA:", error);
    return res.status(500).json({
      message: "Server error: Failed to calculate ETA",
      error: error.message,
    });
  }
};

/**
 * Check if vehicle is delayed
 */
const checkVehicleDelay = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { vehicleId, routeId } = req.params;

    const latestTracking = await VehicleTracking.findOne({
      where: { vehicleId, routeId },
      order: [["timestamp", "DESC"]],
      transaction,
    });

    if (!latestTracking) {
      await transaction.rollback();
      return res.status(404).json({ message: "No tracking data available" });
    }

    const nextStop = await VehicleStop.findOne({
      where: { routeId, id: latestTracking.currentStopId },
      transaction,
    });

    if (!nextStop) {
      await transaction.rollback();
      return res
        .status(200)
        .json({ isDelayed: false, message: "No next stop information" });
    }

    const now = new Date();
    const scheduledTime = new Date(
      `${now.toISOString().split("T")[0]}T${nextStop.scheduledPickupTime}`,
    );
    const delayMinutes = Math.round((now - scheduledTime) / (1000 * 60));
    const isDelayed = delayMinutes > 10;

    if (isDelayed) {
      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId,
          routeId,
          stopId: nextStop.id,
          alertType: "delay",
          status: "active",
        },
        transaction,
      });

      if (!existingAlert) {
        await VehicleAlert.create(
          {
            vehicleId,
            routeId,
            stopId: nextStop.id,
            alertType: "delay",
            severity: delayMinutes > 20 ? "high" : "medium",
            title: "Vehicle Delayed",
            message: `Vehicle is running ${delayMinutes} minutes late`,
            delayMinutes,
            status: "active",
          },
          { transaction },
        );
      }
    }

    await transaction.commit();
    return res.status(200).json({
      isDelayed,
      delayMinutes: isDelayed ? delayMinutes : 0,
      nextStop: nextStop.stopName,
      scheduledTime: nextStop.scheduledPickupTime,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error checking vehicle delay:", error);
    return res.status(500).json({
      message: "Server error: Failed to check vehicle delay",
      error: error.message,
    });
  }
};

module.exports = {
  recordLocationUpdate,
  getCurrentVehicleLocation,
  getVehicleTrackingHistory,
  getAllActiveVehicleLocations,
  getETAToStop,
  checkVehicleDelay,
};
