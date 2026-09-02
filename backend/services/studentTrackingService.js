// services/studentTrackingService.js - Fixed to use JSON stops from vehicleRoutes

const db = require("../models/index");
const { Op } = require("sequelize");

class StudentTrackingService {
  /**
   * Helper to get stop from route's JSON stops
   */
  getStopFromRoute(route, stopId) {
    if (!route || !route.stops || !Array.isArray(route.stops)) return null;
    return route.stops.find((stop) => stop.id === stopId);
  }

  /**
   * Get current location of a student based on their assigned route and vehicle
   * Now accepts either guardianId OR userId for better flexibility
   */
  async getStudentCurrentLocation(studentId, guardianId = null, userId = null) {
    try {
      // Verify guardian has access to this student
      // Try both guardianId and userId approaches
      let hasAccess = false;

      // Method 1: Check by guardianId directly
      if (guardianId) {
        const guardianStudent = await db.guardianstudents.findOne({
          where: { studentId, guardianId },
        });
        if (guardianStudent) {
          hasAccess = true;
        }
      }

      // Method 2: If not found by guardianId, try by userId
      if (!hasAccess && userId) {
        // Find guardian record for this user
        const guardian = await db.guardians.findOne({
          where: { userId, isActive: true },
        });
        if (guardian) {
          const guardianStudent = await db.guardianstudents.findOne({
            where: { studentId, guardianId: guardian.id },
          });
          if (guardianStudent) {
            hasAccess = true;
          }
        }
      }

      // Method 3: If still no access, check if student has any guardians
      // and allow access if the requesting user is associated via any relationship
      if (!hasAccess && userId) {
        // Check direct user access through guardianstudents join
        const studentWithGuardians = await db.students.findByPk(studentId, {
          include: [
            {
              model: db.guardians,
              as: "guardians",
              include: [
                {
                  model: db.users,
                  as: "user",
                  where: { id: userId },
                  required: false,
                },
              ],
            },
          ],
        });

        if (
          studentWithGuardians?.guardians?.some((g) => g.user?.id === userId)
        ) {
          hasAccess = true;
        }
      }

      // For testing/debugging - log the access check
      console.log(`Access check for student ${studentId}:`, {
        hasAccess,
        guardianId,
        userId,
      });

      // If still no access and we have a guardianId or userId, throw error
      // But if no identifiers were provided, skip the check (internal call)
      if ((guardianId || userId) && !hasAccess) {
        throw new Error("Unauthorized: You don't have access to this student");
      }

      // Get student with their assigned route
      const student = await db.students.findByPk(studentId, {
        include: [
          {
            model: db.users,
            as: "user",
            attributes: ["id", "fullname", "email", "phone"],
          },
          {
            model: db.vehicleroutes,
            as: "vehicleRoute",
            include: [
              {
                model: db.vehicles,
                as: "vehicle",
                attributes: ["id", "registrationNumber", "status"],
              },
            ],
          },
        ],
      });

      if (!student) {
        throw new Error("Student not found");
      }

      // Check if student has vehicleRoute
      if (!student.vehicleRoute) {
        return {
          student: {
            id: student.id,
            name: student.user?.fullname,
            studentIdNumber: student.studentIdNumber,
          },
          currentLocation: student.location || null,
          status: {
            isOnVehicle: false,
            message: "No route assigned to this student",
          },
          vehicleLocation: null,
          lastUpdated: new Date(),
        };
      }

      const route = student.vehicleRoute;
      const vehicle = route.vehicle;

      // Get the assigned stop from the route's JSON stops
      const assignedStop = this.getStopFromRoute(route, student.vehicleStopId);

      if (!vehicle) {
        return {
          student: {
            id: student.id,
            name: student.user?.fullname,
            studentIdNumber: student.studentIdNumber,
          },
          currentLocation: student.location || null,
          status: {
            isOnVehicle: false,
            message: "No vehicle assigned to this route",
          },
          vehicleLocation: null,
          route: {
            id: route.id,
            routeNumber: route.routeNumber,
            routeName: route.routeName,
          },
          vehicleStop: assignedStop
            ? {
                id: assignedStop.id,
                stopName: assignedStop.stopName,
                stopOrder: assignedStop.stopOrder,
                scheduledPickupTime: assignedStop.scheduledPickupTime,
                scheduledDropoffTime: assignedStop.scheduledDropoffTime,
                location: assignedStop.location,
              }
            : null,
          lastUpdated: new Date(),
        };
      }

      // Get current vehicle location from tracking
      const latestTracking = await db.vehicletracking.findOne({
        where: { vehicleId: vehicle.id },
        order: [["timestamp", "DESC"]],
      });

      let vehicleLocation = null;
      let studentStatus = {
        isOnVehicle: false,
        hasReachedPickupStop: false,
        hasReachedDropoffStop: false,
        currentStopStatus: null,
      };

      if (latestTracking) {
        vehicleLocation = {
          latitude: parseFloat(latestTracking.latitude),
          longitude: parseFloat(latestTracking.longitude),
          speed: latestTracking.speed ? parseFloat(latestTracking.speed) : 0,
          status: latestTracking.status,
          lastUpdate: latestTracking.timestamp,
          currentStopId: latestTracking.currentStopId,
          isStale:
            new Date(latestTracking.timestamp) <
            new Date(Date.now() - 5 * 60 * 1000),
        };

        // Determine if student is on vehicle based on route and vehicle status
        if (assignedStop) {
          const routeStops = route.stops || [];
          const studentStopOrder = assignedStop.stopOrder;

          // Find current stop from tracking
          const currentStop = routeStops.find(
            (s) => s.id === latestTracking.currentStopId,
          );
          const currentStopOrder = currentStop?.stopOrder;

          if (
            currentStopOrder !== undefined &&
            studentStopOrder !== undefined
          ) {
            studentStatus.hasReachedPickupStop =
              currentStopOrder >= studentStopOrder;
            studentStatus.hasReachedDropoffStop =
              currentStopOrder >= studentStopOrder + 1;
            studentStatus.isOnVehicle =
              studentStatus.hasReachedPickupStop &&
              !studentStatus.hasReachedDropoffStop;

            if (currentStopOrder === studentStopOrder) {
              studentStatus.currentStopStatus = "at_pickup_stop";
            } else if (currentStopOrder === studentStopOrder + 1) {
              studentStatus.currentStopStatus = "at_dropoff_stop";
            } else if (currentStopOrder > studentStopOrder + 1) {
              studentStatus.currentStopStatus = "past_dropoff";
            } else {
              studentStatus.currentStopStatus = "approaching";
            }
          }
        }
      }

      // Determine the location to show to parent
      let displayLocation = null;

      if (studentStatus.isOnVehicle && vehicleLocation) {
        // Student is on vehicle - show vehicle location
        displayLocation = {
          latitude: vehicleLocation.latitude,
          longitude: vehicleLocation.longitude,
          source: "vehicle_tracking",
          timestamp: vehicleLocation.lastUpdate,
          speed: vehicleLocation.speed,
        };
      } else if (assignedStop?.location) {
        // Student not on vehicle - show their designated vehicle stop location
        displayLocation = {
          latitude: assignedStop.location.latitude,
          longitude: assignedStop.location.longitude,
          address: assignedStop.location.address || null,
          source: "vehicle_stop",
          timestamp: assignedStop.updatedAt || new Date().toISOString(),
        };
      } else if (student.location) {
        // Fallback to student's registered home location
        displayLocation = {
          latitude: student.location.latitude,
          longitude: student.location.longitude,
          address: student.location.address || null,
          source: "registered_location",
          timestamp: student.updatedAt,
        };
      }

      // Calculate ETA to student's stop
      let etaToStop = null;
      if (
        vehicleLocation &&
        assignedStop?.location &&
        !studentStatus.hasReachedPickupStop
      ) {
        etaToStop = await this.calculateETA(
          vehicleLocation.latitude,
          vehicleLocation.longitude,
          assignedStop.location,
        );
      }

      return {
        student: {
          id: student.id,
          name: student.user?.fullname,
          studentIdNumber: student.studentIdNumber,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
        },
        route: {
          id: route.id,
          routeNumber: route.routeNumber,
          routeName: route.routeName,
          routeType: route.routeType,
        },
        vehicle: {
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          status: vehicle.status,
        },
        vehicleStop: assignedStop
          ? {
              id: assignedStop.id,
              stopName: assignedStop.stopName,
              stopOrder: assignedStop.stopOrder,
              scheduledPickupTime: assignedStop.scheduledPickupTime,
              scheduledDropoffTime: assignedStop.scheduledDropoffTime,
              location: assignedStop.location,
            }
          : null,
        currentLocation: displayLocation,
        vehicleLocation: vehicleLocation,
        status: studentStatus,
        etaToStop,
        lastUpdated: new Date(),
        isRealTime:
          studentStatus.isOnVehicle &&
          vehicleLocation &&
          !vehicleLocation.isStale,
      };
    } catch (error) {
      console.error("Error getting student location:", error);
      throw error;
    }
  }

  /**
   * Get all students for a guardian with their current locations
   */
  async getAllGuardianStudentsLocations(guardianId) {
    try {
      // Get all students linked to this guardian
      const guardianStudents = await db.guardianstudents.findAll({
        where: { guardianId },
        include: [
          {
            model: db.students,
            as: "student",
            include: [
              {
                model: db.vehicleroutes,
                as: "vehicleRoute",
                include: [
                  {
                    model: db.vehicles,
                    as: "vehicle",
                    attributes: ["id", "status"],
                  },
                ],
              },
            ],
          },
        ],
      });

      const studentsWithLocations = await Promise.all(
        guardianStudents.map(async (gs) => {
          try {
            const locationData = await this.getStudentCurrentLocation(
              gs.studentId,
              guardianId, // Pass guardianId for authorization
            );
            return {
              relationship: gs.relationshipToStudent,
              guardianStudentId: gs.id,
              ...locationData,
            };
          } catch (error) {
            console.error(
              `Error getting location for student ${gs.studentId}:`,
              error.message,
            );
            return {
              student: {
                id: gs.student.id,
                name: gs.student.user?.fullname,
              },
              error: error.message,
            };
          }
        }),
      );

      // Group by status for better UI display
      const onVehicle = studentsWithLocations.filter(
        (s) => s.status?.isOnVehicle && !s.error,
      );
      const atStop = studentsWithLocations.filter(
        (s) => s.status?.currentStopStatus === "at_pickup_stop" && !s.error,
      );
      const notOnVehicle = studentsWithLocations.filter(
        (s) => !s.status?.isOnVehicle && !s.error,
      );
      const withErrors = studentsWithLocations.filter((s) => s.error);

      return {
        totalStudents: studentsWithLocations.length,
        summary: {
          onVehicle: onVehicle.length,
          atStop: atStop.length,
          notOnVehicle: notOnVehicle.length,
          errors: withErrors.length,
        },
        students: studentsWithLocations,
      };
    } catch (error) {
      console.error("Error getting guardian students locations:", error);
      throw error;
    }
  }

  /**
   * Get vehicle stop details for a student from route's JSON stops
   */
  async getStudentVehicleStopDetails(studentId) {
    try {
      const student = await db.students.findByPk(studentId, {
        include: [
          {
            model: db.vehicleroutes,
            as: "vehicleRoute",
          },
        ],
      });

      if (!student || !student.vehicleRoute || !student.vehicleStopId) {
        return null;
      }

      const route = student.vehicleRoute;
      const routeStops = route.stops || [];

      // Find the student's stop in the JSON stops
      const currentStopIndex = routeStops.findIndex(
        (s) => s.id === student.vehicleStopId,
      );

      if (currentStopIndex === -1) {
        return null;
      }

      const currentStop = routeStops[currentStopIndex];

      return {
        currentStop: {
          id: currentStop.id,
          stopName: currentStop.stopName,
          stopOrder: currentStop.stopOrder,
          location: currentStop.location,
          scheduledPickupTime: currentStop.scheduledPickupTime,
          scheduledDropoffTime: currentStop.scheduledDropoffTime,
          estimatedWaitTime: currentStop.estimatedWaitTime,
          landmark: currentStop.landmark,
          notes: currentStop.notes,
        },
        previousStop:
          currentStopIndex > 0 ? routeStops[currentStopIndex - 1] : null,
        nextStop:
          currentStopIndex < routeStops.length - 1
            ? routeStops[currentStopIndex + 1]
            : null,
        totalStops: routeStops.length,
      };
    } catch (error) {
      console.error("Error getting student vehicle stop details:", error);
      throw error;
    }
  }

  /**
   * Calculate ETA to a stop
   */
  async calculateETA(currentLat, currentLon, targetLocation) {
    if (!targetLocation?.latitude || !targetLocation?.longitude) {
      return null;
    }

    const distance = this.calculateDistance(
      currentLat,
      currentLon,
      targetLocation.latitude,
      targetLocation.longitude,
    );

    // Assume average speed of 30 km/h (8.33 m/s)
    const avgSpeed = 8.33;
    const etaSeconds = distance / avgSpeed;
    const etaMinutes = Math.round(etaSeconds / 60);

    return {
      distance: Math.round(distance),
      distanceKm: (distance / 1000).toFixed(2),
      etaMinutes,
      etaMinutesDisplay:
        etaMinutes <= 1 ? "< 1 minute" : `${etaMinutes} minutes`,
      estimatedArrival: new Date(Date.now() + etaMinutes * 60 * 1000),
    };
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
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
}

module.exports = new StudentTrackingService();
