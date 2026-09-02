const StudentTrackingService = require("../services/studentTrackingService");
const db = require("../models/index");

/**
 * Get current location of a specific student (for guardian)
 */
const getStudentLocation = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;

    // Get guardian record
    const guardian = await db.guardians.findOne({
      where: { userId, isActive: true },
    });

    if (!guardian) {
      return res.status(403).json({
        success: false,
        message: "Guardian profile not found",
      });
    }

    // Pass both guardian.id and userId for better authorization
    const locationData = await StudentTrackingService.getStudentCurrentLocation(
      studentId,
      guardian.id, // Pass guardianId
      userId, // Also pass userId for fallback checks
    );

    return res.status(200).json({
      success: true,
      data: locationData,
    });
  } catch (error) {
    console.error("Error getting student location:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get student location",
    });
  }
};

/**
 * Get all students for the logged-in guardian with their locations
 */
const getMyStudentsLocations = async (req, res) => {
  try {
    const userId = req.user.id;

    const guardian = await db.guardians.findOne({
      where: { userId, isActive: true },
    });

    if (!guardian) {
      return res.status(403).json({
        success: false,
        message: "Guardian profile not found",
      });
    }

    const locationsData =
      await StudentTrackingService.getAllGuardianStudentsLocations(guardian.id);

    return res.status(200).json({
      success: true,
      data: locationsData,
    });
  } catch (error) {
    console.error("Error getting guardian students locations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get students locations",
    });
  }
};

/**
 * Get all students on a route (for driver/dispatcher)
 */
const getRouteStudents = async (req, res) => {
  try {
    const { routeId } = req.params;

    // Check if user has permission (admin, dispatcher, or driver assigned to this route)
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "driver") {
      const driver = await db.drivers.findOne({ where: { userId } });
      if (driver) {
        const vehicleAssignment = await db.vehicles.findOne({
          where: { driverId: driver.id, isActive: true },
        });

        const route = await db.vehicleroutes.findByPk(routeId);
        if (
          route &&
          vehicleAssignment &&
          route.vehicleId !== vehicleAssignment.id
        ) {
          return res.status(403).json({
            success: false,
            message: "You don't have access to this route",
          });
        }
      }
    }

    const routeStudents =
      await StudentTrackingService.getRouteStudentsLocations(routeId);

    return res.status(200).json({
      success: true,
      data: routeStudents,
    });
  } catch (error) {
    console.error("Error getting route students:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get route students",
    });
  }
};

/**
 * Stream real-time location updates for a student (SSE)
 */
const streamStudentLocation = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;

    const guardian = await db.guardians.findOne({
      where: { userId, isActive: true },
    });

    if (!guardian) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Set up SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial location immediately
    const sendUpdate = async () => {
      try {
        const location = await StudentTrackingService.getStudentCurrentLocation(
          studentId,
          guardian.id,
        );
        res.write(`data: ${JSON.stringify(location)}\n\n`);
      } catch (error) {
        console.error("Error sending update:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      }
    };

    await sendUpdate();

    // Set up interval for real-time updates (every 3 seconds when vehicle is moving)
    let intervalId = setInterval(sendUpdate, 3000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(intervalId);
      res.end();
    });
  } catch (error) {
    console.error("Error in streamStudentLocation:", error);
    return res.status(500).json({ message: "Failed to stream location" });
  }
};

/**
 * Assign student to a route (admin only)
 * Now expects stopId from the route's JSON stops array
 */
const assignStudentToRoute = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { studentId, routeId, stopId } = req.body;

    // Validate entities exist
    const student = await db.students.findByPk(studentId, { transaction });
    const route = await db.vehicleroutes.findByPk(routeId, {
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ message: "Student not found" });
    }

    if (!route) {
      await transaction.rollback();
      return res.status(404).json({ message: "Route not found" });
    }

    // Validate the stop exists in the route's JSON stops
    const routeStops = route.stops || [];
    const stopExists = routeStops.some((s) => s.id === stopId);

    if (stopId && !stopExists) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid stop ID. Stop does not exist in this route.",
      });
    }

    // Update student with route and stop
    await student.update(
      {
        routeId,
        vehicleStopId: stopId || null,
      },
      { transaction },
    );

    // Get the vehicle assigned to this route
    const vehicle = await db.vehicles.findByPk(route.vehicleId, {
      transaction,
    });

    // Get the stop details from the route's JSON
    const assignedStop = routeStops.find((s) => s.id === stopId);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Student assigned to route successfully",
      data: {
        student: {
          id: student.id,
          name: student.user?.fullname,
        },
        route: {
          id: route.id,
          routeNumber: route.routeNumber,
          routeName: route.routeName,
        },
        stop: assignedStop
          ? {
              id: assignedStop.id,
              stopName: assignedStop.stopName,
              stopOrder: assignedStop.stopOrder,
              location: assignedStop.location,
            }
          : null,
        vehicle: vehicle
          ? {
              id: vehicle.id,
              vehicleNumber: vehicle.vehicleNumber,
            }
          : null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error assigning student to route:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign student to route",
    });
  }
};

/**
 * Get student's vehicle stop details
 */
const getStudentStopDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;

    const guardian = await db.guardians.findOne({
      where: { userId, isActive: true },
    });

    if (!guardian) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Verify guardian has access
    const guardianStudent = await db.guardianstudents.findOne({
      where: { studentId, guardianId: guardian.id },
    });

    if (!guardianStudent) {
      return res
        .status(403)
        .json({ message: "Unauthorized: No access to this student" });
    }

    const stopDetails =
      await StudentTrackingService.getStudentVehicleStopDetails(studentId);

    return res.status(200).json({
      success: true,
      data: stopDetails,
    });
  } catch (error) {
    console.error("Error getting student stop details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get stop details",
    });
  }
};

module.exports = {
  getStudentLocation,
  getMyStudentsLocations,
  getRouteStudents,
  streamStudentLocation,
  assignStudentToRoute,
  getStudentStopDetails,
};
