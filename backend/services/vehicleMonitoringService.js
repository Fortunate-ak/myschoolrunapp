// services/vehicleMonitoringService.js
const db = require("../models/index");
const { Op } = require("sequelize");
const VehicleTracking = db.vehicletracking;
const VehicleAlert = db.vehiclealerts;
const Vehicle = db.vehicles;
const VehicleAssignment = db.vehicleassignments;
const {
  sendVehicleAlertNotification,
} = require("./vehicleNotificationService");

class VehicleMonitoringService {
  /**
   * Process a location update and check all alert conditions
   */
  async processLocationUpdate(trackingData, transaction) {
    const {
      vehicleId,
      routeId,
      latitude,
      longitude,
      speed,
      heading,
      timestamp,
    } = trackingData;

    const checks = await Promise.allSettled([
      this.checkSpeeding(
        vehicleId,
        speed,
        { latitude, longitude },
        transaction,
      ),
      this.checkRouteDeviation(
        vehicleId,
        routeId,
        latitude,
        longitude,
        transaction,
      ),
      this.checkDelay(vehicleId, routeId, timestamp, transaction),
      this.checkGeofence(vehicleId, latitude, longitude, transaction),
      this.checkStopApproach(
        vehicleId,
        routeId,
        latitude,
        longitude,
        speed,
        transaction,
      ),
    ]);

    return checks;
  }

  /**
   * Check for speeding violations
   */
  async checkSpeeding(vehicleId, speed, location, transaction) {
    if (!speed) return null;

    const speedLimit = 80; // Configure this per route/vehicle type
    if (speed > speedLimit) {
      const vehicle = await Vehicle.findByPk(vehicleId);

      // Check if there's already an active speeding alert
      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId,
          alertType: "speeding",
          status: "active",
          createdAt: { [Op.gte]: new Date(Date.now() - 30 * 60000) }, // Within last 30 minutes
        },
        transaction,
      });

      if (!existingAlert) {
        const alert = await VehicleAlert.create(
          {
            vehicleId,
            alertType: "speeding",
            severity: speed > 100 ? "critical" : "high",
            title: "Speeding Detected",
            message: `Vehicle ${vehicle.registrationNumber} is traveling at ${speed} km/h`,
            location,
            status: "active",
          },
          { transaction },
        );

        await sendVehicleAlertNotification(alert);
        return alert;
      }
    }
    return null;
  }

  /**
   * Check if vehicle has deviated from its route
   */
  async checkRouteDeviation(
    vehicleId,
    routeId,
    latitude,
    longitude,
    transaction,
  ) {
    if (!routeId) return null;

    // Get route boundaries or allowed corridor
    const route = await db.vehicleroutes.findByPk(routeId, {
      include: [
        {
          model: db.vehiclestops,
          as: "stops",
          attributes: ["location"],
        },
      ],
      transaction,
    });

    if (!route || !route.stops || route.stops.length < 2) return null;

    // Check if vehicle is within reasonable distance of route
    const isOnRoute = this.calculateDistanceToRoute(
      { latitude, longitude },
      route.stops.map((s) => s.location),
    );

    if (!isOnRoute) {
      const vehicle = await Vehicle.findByPk(vehicleId);

      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId,
          alertType: "route_deviation",
          status: "active",
          createdAt: { [Op.gte]: new Date(Date.now() - 15 * 60000) },
        },
        transaction,
      });

      if (!existingAlert) {
        const alert = await VehicleAlert.create(
          {
            vehicleId,
            routeId,
            alertType: "route_deviation",
            severity: "high",
            title: "Route Deviation Detected",
            message: `Vehicle ${vehicle.registrationNumber} has deviated from route ${route.routeName}`,
            location: { latitude, longitude },
            status: "active",
          },
          { transaction },
        );

        await sendVehicleAlertNotification(alert);
        return alert;
      }
    }
    return null;
  }

  /**
   * Check if vehicle is delayed
   */
  async checkDelay(vehicleId, routeId, currentTime, transaction) {
    if (!routeId) return null;

    const nextStop = await this.getNextStop(vehicleId, routeId, transaction);
    if (!nextStop) return null;

    const scheduledTime = new Date(currentTime);
    const [hours, minutes] = nextStop.scheduledPickupTime.split(":");
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0);

    const delayMinutes = Math.round(
      (currentTime - scheduledTime) / (1000 * 60),
    );

    if (delayMinutes > 10) {
      // More than 10 minutes late
      const vehicle = await Vehicle.findByPk(vehicleId);

      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId,
          routeId,
          alertType: "delay",
          status: "active",
          createdAt: { [Op.gte]: new Date(Date.now() - 60 * 60000) },
        },
        transaction,
      });

      if (!existingAlert) {
        // Get affected students
        const assignments = await VehicleAssignment.findAll({
          where: {
            routeId,
            status: "active",
          },
          attributes: ["studentId"],
          transaction,
        });
        const affectedStudents = assignments.map((a) => a.studentId);

        const alert = await VehicleAlert.create(
          {
            vehicleId,
            routeId,
            stopId: nextStop.id,
            alertType: "delay",
            severity: delayMinutes > 20 ? "high" : "medium",
            title: "Vehicle Delay Detected",
            message: `Vehicle ${vehicle.registrationNumber} is running ${delayMinutes} minutes late`,
            delayMinutes,
            affectedStudents,
            location: { latitude: null, longitude: null }, // Will be updated with current location
            status: "active",
          },
          { transaction },
        );

        await sendVehicleAlertNotification(alert);
        return alert;
      }
    }
    return null;
  }

  /**
   * Check geofence boundaries
   */
  async checkGeofence(vehicleId, latitude, longitude, transaction) {
    // Get school boundary or allowed zones
    const school = await db.schools.findOne({
      where: { isActive: true },
      transaction,
    });

    if (!school || !school.boundaries) return null;

    const isWithinGeofence = this.pointInPolygon(
      { latitude, longitude },
      school.boundaries,
    );

    if (!isWithinGeofence) {
      const vehicle = await Vehicle.findByPk(vehicleId);

      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId,
          alertType: "geofence_exit",
          status: "active",
          createdAt: { [Op.gte]: new Date(Date.now() - 30 * 60000) },
        },
        transaction,
      });

      if (!existingAlert) {
        const alert = await VehicleAlert.create(
          {
            vehicleId,
            alertType: "geofence_exit",
            severity: "critical",
            title: "Geofence Exit Alert",
            message: `Vehicle ${vehicle.registrationNumber} has exited the designated area`,
            location: { latitude, longitude },
            status: "active",
          },
          { transaction },
        );

        await sendVehicleAlertNotification(alert);
        return alert;
      }
    }
    return null;
  }

  /**
   * Check if approaching a stop and generate arrival notifications
   */
  async checkStopApproach(
    vehicleId,
    routeId,
    latitude,
    longitude,
    speed,
    transaction,
  ) {
    if (!routeId) return null;

    const stops = await db.vehiclestops.findAll({
      where: { routeId, isActive: true },
      order: [["stopOrder", "ASC"]],
      transaction,
    });

    for (const stop of stops) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        stop.location.latitude,
        stop.location.longitude,
      );

      // Check if within 500 meters and not already notified
      if (distance < 500) {
        const existingNotification = await VehicleAlert.findOne({
          where: {
            vehicleId,
            stopId: stop.id,
            alertType: "arrival",
            status: "active",
            createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60000) }, // Last 10 minutes
          },
          transaction,
        });

        if (!existingNotification) {
          const vehicle = await Vehicle.findByPk(vehicleId);

          // Get students for this stop
          const assignments = await VehicleAssignment.findAll({
            where: {
              [Op.or]: [{ pickupStopId: stop.id }, { dropoffStopId: stop.id }],
              status: "active",
            },
            attributes: ["studentId"],
            transaction,
          });
          const affectedStudents = assignments.map((a) => a.studentId);

          const alert = await VehicleAlert.create(
            {
              vehicleId,
              routeId,
              stopId: stop.id,
              alertType: "arrival",
              severity: "low",
              title: "Vehicle Approaching Stop",
              message: `Vehicle ${vehicle.registrationNumber} is approaching ${stop.stopName}`,
              location: { latitude, longitude },
              affectedStudents,
              status: "active",
            },
            { transaction },
          );

          await sendVehicleAlertNotification(alert);
          return alert;
        }
      }
    }
    return null;
  }

  /**
   * Check for maintenance requirements
   */
  async checkMaintenanceDue() {
    const vehicles = await Vehicle.findAll({
      where: {
        status: "active",
        nextServiceDate: {
          [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60000), // Due in next 7 days
        },
      },
    });

    for (const vehicle of vehicles) {
      const existingAlert = await VehicleAlert.findOne({
        where: {
          vehicleId: vehicle.id,
          alertType: "maintenance_due",
          status: "active",
        },
      });

      if (!existingAlert) {
        const daysUntilService = Math.ceil(
          (vehicle.nextServiceDate - new Date()) / (24 * 60 * 60000),
        );

        const alert = await VehicleAlert.create({
          vehicleId: vehicle.id,
          alertType: "maintenance_due",
          severity: daysUntilService <= 2 ? "high" : "medium",
          title: "Maintenance Due",
          message: `Vehicle ${vehicle.registrationNumber} requires service in ${daysUntilService} days`,
          status: "active",
        });

        await sendVehicleAlertNotification(alert);
      }
    }
  }

  /**
   * Helper: Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Helper: Get next stop for a vehicle
   */
  async getNextStop(vehicleId, routeId, transaction) {
    const lastTracking = await VehicleTracking.findOne({
      where: { vehicleId, routeId },
      order: [["timestamp", "DESC"]],
      transaction,
    });

    if (!lastTracking || !lastTracking.currentStopId) return null;

    const stops = await db.vehiclestops.findAll({
      where: { routeId, isActive: true },
      order: [["stopOrder", "ASC"]],
      transaction,
    });

    const currentStopIndex = stops.findIndex(
      (s) => s.id === lastTracking.currentStopId,
    );
    return stops[currentStopIndex + 1] || stops[currentStopIndex];
  }

  /**
   * Helper: Check if point is within route corridor
   */
  calculateDistanceToRoute(point, routePoints) {
    // Simplified: check if point is within 200m of any route point
    for (const routePoint of routePoints) {
      const distance = this.calculateDistance(
        point.latitude,
        point.longitude,
        routePoint.latitude,
        routePoint.longitude,
      );
      if (distance < 200) return true;
    }
    return false;
  }

  /**
   * Helper: Point in polygon check
   */
  pointInPolygon(point, polygon) {
    // Simplified implementation
    return true; // Implement actual point-in-polygon algorithm
  }
}

module.exports = new VehicleMonitoringService();
