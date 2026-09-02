// services/vehicleNotificationService.js
const db = require("../models/index");
const {
  createNotification,
  notifyRole,
  notifyGuardiansOnVehicle,
} = require("./notificationService");

const VehicleAlert = db.vehiclealerts;

// Send SOS alert to guardians and admins
const sendSOSAlert = async (
  vehicleId,
  routeId,
  location,
  driverName,
  driverPhone,
  io,
) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);

    const notificationData = {
      title: "🚨 SOS EMERGENCY",
      message: `EMERGENCY: ${driverName || vehicle?.registrationNumber} has activated SOS at ${new Date().toLocaleTimeString()}. Immediate assistance required.`,
      notifType: "emergency",
      entityType: "vehicle_sos",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId,
        location,
        driverName,
        driverPhone,
        timestamp: new Date().toISOString(),
      },
    };

    const guardianNotifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    const adminNotifications = await notifyRole("admin", notificationData, io);

    const alert = await VehicleAlert.create({
      vehicleId,
      routeId,
      alertType: "sos",
      severity: "critical",
      title: "🚨 SOS EMERGENCY",
      message: notificationData.message,
      location,
      status: "active",
      driverName,
      driverPhone,
    });

    return {
      notifications: [...guardianNotifications, ...adminNotifications],
      alert,
    };
  } catch (error) {
    console.error("Error sending SOS alert:", error);
    throw error;
  }
};

// Send delay notification
const sendDelayNotification = async (
  vehicleId,
  routeId,
  stopId,
  delayMinutes,
  location,
  io,
) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const route = await db.vehicleroutes.findByPk(routeId);
    const stop = route?.stops?.find((s) => s.id === stopId);

    const notificationData = {
      title: "⏰ Vehicle Delay Alert",
      message: `Vehicle ${vehicle?.registrationNumber} is running ${delayMinutes} minutes late${stop ? ` arriving at ${stop.stopName}` : ""}.`,
      notifType: "warning",
      entityType: "vehicle_delay",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId,
        stopId,
        stopName: stop?.stopName,
        delayMinutes,
        location,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );

    await VehicleAlert.create({
      vehicleId,
      routeId,
      alertType: "delay",
      severity: delayMinutes > 20 ? "high" : "medium",
      title: "Vehicle Delayed",
      message: notificationData.message,
      location,
      delayMinutes,
      status: "active",
    });

    return notifications;
  } catch (error) {
    console.error("Error sending delay notification:", error);
    throw error;
  }
};

// Send arrival notification
const sendArrivalNotification = async (vehicleId, stopId, etaMinutes, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const route = await db.vehicleroutes.findByPk(vehicle?.currentRouteId);
    const stop = route?.stops?.find((s) => s.id === stopId);

    const notificationData = {
      title: "🚌 Vehicle Approaching",
      message: `Vehicle ${vehicle?.registrationNumber} will arrive at ${stop?.stopName} in approximately ${etaMinutes} minutes. Please be ready at the stop.`,
      notifType: "info",
      entityType: "vehicle_arrival",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        stopId,
        stopName: stop?.stopName,
        etaMinutes,
        estimatedArrival: new Date(Date.now() + etaMinutes * 60000),
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending arrival notification:", error);
    throw error;
  }
};

// FIX: driver tapping "Arrived" on a stop emits "vehicle-stop-arrival",
// which socketHandler.js only rebroadcast over the socket — it never called
// into the notification system, so guardians got neither a DB row nor a
// push for it (what looked like an "in-app notification" was actually just
// that raw broadcast rendering on the live tracking screen). This is the
// confirmed-arrival counterpart to sendArrivalNotification (which is the
// ETA-based "approaching" heads-up, a different event from the driver
// actually confirming they're at the stop).
const sendStopArrivedNotification = async (
  vehicleId,
  routeId,
  stopId,
  stopName,
  stopIndex,
  io,
) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);

    const notificationData = {
      title: "🚌 Vehicle Arrived",
      message: `Vehicle ${vehicle?.registrationNumber} has arrived at ${stopName || "the stop"}.`,
      notifType: "info",
      entityType: "vehicle_stop_arrival",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId,
        stopId,
        stopName,
        stopIndex,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending stop arrived notification:", error);
    return [];
  }
};

// Send departure notification
const sendDepartureNotification = async (vehicleId, stopId, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const route = await db.vehicleroutes.findByPk(vehicle?.currentRouteId);
    const stop = route?.stops?.find((s) => s.id === stopId);

    const notificationData = {
      title: "🚌 Vehicle Departed",
      message: `Vehicle ${vehicle?.registrationNumber} has departed from ${stop?.stopName}.`,
      notifType: "info",
      entityType: "vehicle_departure",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        stopId,
        stopName: stop?.stopName,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending departure notification:", error);
    throw error;
  }
};

// Send trip start notification
const sendTripStartNotification = async (vehicleId, routeId, location, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const route = await db.vehicleroutes.findByPk(routeId);

    const notificationData = {
      title: "🏁 Trip Started",
      message: `Vehicle ${vehicle?.registrationNumber} has started its journey on route ${route?.routeName}. Live tracking is now available.`,
      notifType: "success",
      entityType: "trip_start",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId,
        routeName: route?.routeName,
        startLocation: location,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending trip start notification:", error);
    throw error;
  }
};

// Send trip end notification
const sendTripEndNotification = async (
  vehicleId,
  routeId,
  finalLocation,
  completedStops,
  totalStops,
  io,
) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const route = await db.vehicleroutes.findByPk(routeId);

    const notificationData = {
      title: "🏁 Trip Completed",
      message: `Vehicle ${vehicle?.registrationNumber} has completed its journey. ${completedStops}/${totalStops} stops completed.`,
      notifType: "success",
      entityType: "trip_end",
      entityId: vehicleId,
      metadata: {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId,
        routeName: route?.routeName,
        finalLocation,
        completedStops,
        totalStops,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending trip end notification:", error);
    throw error;
  }
};

// FIX: vehicleMonitoringService.js creates a VehicleAlert row (speeding,
// route_deviation, delay, geofence_exit, arrival, maintenance_due) and calls
// sendVehicleAlertNotification(alert) for every single one — but no such
// function was ever exported here, so every alert threw at runtime. This is
// the generic handler for a VehicleAlert row (as opposed to the trip-level
// helpers above, which build their own notificationData from scratch).
const GUARDIAN_FACING_ALERT_TYPES = new Set([
  "speeding",
  "route_deviation",
  "delay",
  "geofence_exit",
  "arrival",
  "departure",
]);

const sendVehicleAlertNotification = async (alert, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(alert.vehicleId);

    const notificationData = {
      title: alert.title,
      message: alert.message,
      notifType:
        alert.severity === "critical"
          ? "emergency"
          : alert.severity === "high"
            ? "warning"
            : "info",
      entityType: `vehicle_${alert.alertType}`,
      entityId: alert.id,
      metadata: {
        vehicleId: alert.vehicleId,
        registrationNumber: vehicle?.registrationNumber,
        routeId: alert.routeId,
        stopId: alert.stopId,
        alertType: alert.alertType,
        severity: alert.severity,
        location: alert.location,
        delayMinutes: alert.delayMinutes,
        affectedStudents: alert.affectedStudents,
      },
    };

    const notifications = [];

    // Guardians only care about alerts that affect their child's ride
    if (GUARDIAN_FACING_ALERT_TYPES.has(alert.alertType)) {
      const guardianNotifications = await notifyGuardiansOnVehicle(
        alert.vehicleId,
        notificationData,
        io,
      );
      notifications.push(...guardianNotifications);
    }

    // Admins/staff get anything serious, plus maintenance which guardians
    // never need to see
    if (
      alert.severity === "critical" ||
      alert.severity === "high" ||
      alert.alertType === "maintenance_due"
    ) {
      const staffNotifications = await notifyRole(
        "admin",
        notificationData,
        io,
      );
      notifications.push(...staffNotifications);
    }

    return notifications;
  } catch (error) {
    console.error("Error sending vehicle alert notification:", error);
    return [];
  }
};

// FIX: Add these missing exports that the controller expects
const sendLocationUpdateNotification = async (vehicleId, trackingData, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    if (!vehicle) return [];

    const notificationData = {
      title: "Vehicle Location Update",
      message: `Vehicle ${vehicle.registrationNumber} is on its way`,
      notifType: "info",
      entityType: "vehicle_location",
      entityId: vehicleId,
      metadata: {
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        latitude: trackingData.latitude,
        longitude: trackingData.longitude,
        speed: trackingData.speed,
        status: trackingData.status,
        timestamp: trackingData.timestamp,
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending location update notification:", error);
    return [];
  }
};

const sendETANotification = async (vehicleId, stopId, etaMinutes, io) => {
  try {
    const vehicle = await db.vehicles.findByPk(vehicleId);
    const stop = await db.vehiclestops.findByPk(stopId);

    if (!vehicle || !stop) return [];

    const notificationData = {
      title: "Vehicle ETA Update",
      message: `Vehicle ${vehicle.registrationNumber} will arrive at ${stop.stopName} in ${etaMinutes} minutes`,
      notifType: "info",
      entityType: "vehicle_eta",
      entityId: vehicleId,
      metadata: {
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        stopId: stop.id,
        stopName: stop.stopName,
        etaMinutes,
        estimatedArrival: new Date(Date.now() + etaMinutes * 60000),
      },
    };

    const notifications = await notifyGuardiansOnVehicle(
      vehicleId,
      notificationData,
      io,
    );
    return notifications;
  } catch (error) {
    console.error("Error sending ETA notification:", error);
    return [];
  }
};

module.exports = {
  sendSOSAlert,
  sendDelayNotification,
  sendArrivalNotification,
  // FIX: vehicleTrackingController.js imports this exact name (currently
  // unused there, but it was pointing at nothing) — alias it to the real
  // implementation so the import isn't silently undefined.
  sendVehicleArrivalNotification: sendArrivalNotification,
  sendStopArrivedNotification, // FIX: was missing — driver's "Arrived" tap had no notification/push at all
  sendDepartureNotification,
  sendTripStartNotification,
  sendTripEndNotification,
  sendLocationUpdateNotification, // FIX: Added export
  sendETANotification, // FIX: Added export
  sendVehicleAlertNotification, // FIX: Added export — vehicleMonitoringService.js was calling an export that didn't exist
};
