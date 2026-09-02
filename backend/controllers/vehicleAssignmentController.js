const db = require("../models/index");
const BusAssignment = db.busassignments;
const Bus = db.buses;
const BusRoute = db.busroutes;
const BusStop = db.busstops;
const Student = db.students;
const User = db.users;

/**
 * Assign student to bus
 */
const assignStudentToBus = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      studentId,
      busId,
      routeId,
      pickupStopId,
      dropoffStopId,
      assignmentType,
      effectiveFrom,
      effectiveTo,
      activeDays,
      guardianPhone,
      emergencyContact,
      specialRequirements,
    } = req.body;

    // Validate required fields
    if (!studentId || !busId || !routeId || !pickupStopId || !dropoffStopId) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Student, bus, route, pickup stop, and dropoff stop are required",
      });
    }

    // Validate student exists
    const student = await Student.findByPk(studentId, { transaction });
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Student not found",
      });
    }

    // Validate bus
    const bus = await Bus.findByPk(busId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!bus || bus.status !== "active") {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid or inactive bus",
      });
    }

    // Note: currentOccupancy field doesn't exist in the bus model
    // You might need to calculate occupancy from assignments or remove this check

    // Validate route
    const route = await BusRoute.findByPk(routeId, { transaction });
    if (!route || route.busId !== busId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid route or route does not belong to this bus",
      });
    }

    // Validate stops
    const pickupStop = await BusStop.findByPk(pickupStopId, { transaction });
    const dropoffStop = await BusStop.findByPk(dropoffStopId, { transaction });

    if (!pickupStop || pickupStop.routeId !== routeId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid pickup stop or stop does not belong to this route",
      });
    }

    if (!dropoffStop || dropoffStop.routeId !== routeId) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid dropoff stop or stop does not belong to this route",
      });
    }

    // Check for existing active assignment
    const existingAssignment = await BusAssignment.findOne({
      where: {
        studentId,
        status: "active",
      },
      transaction,
    });

    if (existingAssignment) {
      await transaction.rollback();
      return res.status(409).json({
        message: "Student already has an active bus assignment",
        existingAssignment,
      });
    }

    // Create assignment
    const assignment = await BusAssignment.create(
      {
        studentId,
        busId,
        routeId,
        pickupStopId,
        dropoffStopId,
        assignmentType: assignmentType || "regular",
        effectiveFrom: effectiveFrom || new Date(),
        effectiveTo,
        activeDays: activeDays || route.activeDays,
        guardianPhone,
        emergencyContact,
        specialRequirements,
        status: "active",
        isActive: true,
      },
      { transaction },
    );

    // Note: Removed bus occupancy update since currentOccupancy doesn't exist

    await transaction.commit();

    // Fetch complete assignment
    const completeAssignment = await BusAssignment.findByPk(assignment.id, {
      include: [
        {
          model: Student,
          as: "student",
        },
        {
          model: Bus,
          as: "bus",
        },
        {
          model: BusRoute,
          as: "route",
        },
        {
          model: BusStop,
          as: "pickupStop",
        },
        {
          model: BusStop,
          as: "dropoffStop",
        },
      ],
    });

    return res.status(201).json({
      message: "Student assigned to bus successfully",
      assignment: completeAssignment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error assigning student to bus:", error);
    return res.status(500).json({
      message: "Server error: Failed to assign student to bus",
      error: error.message,
    });
  }
};

/**
 * Get all bus assignments with filters
 */
const getAllBusAssignments = async (req, res) => {
  try {
    const { status, busId, routeId, studentId } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (busId) whereClause.busId = busId;
    if (routeId) whereClause.routeId = routeId;
    if (studentId) whereClause.studentId = studentId;

    const assignments = await BusAssignment.findAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: "student",
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
          attributes: ["busNumber", "registrationNumber"],
        },
        {
          model: BusRoute,
          as: "route",
          attributes: ["routeNumber", "routeName"],
        },
        {
          model: BusStop,
          as: "pickupStop",
          attributes: ["stopName", "location", "scheduledPickupTime"],
        },
        {
          model: BusStop,
          as: "dropoffStop",
          attributes: ["stopName", "location", "scheduledDropoffTime"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching bus assignments:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch bus assignments",
      error: error.message,
    });
  }
};

/**
 * Get single bus assignment
 */
const getBusAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await BusAssignment.findByPk(id, {
      include: [
        {
          model: Student,
          as: "student",
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
          include: [
            {
              model: db.busdrivers,
              as: "assignedDriver",
              include: [
                {
                  model: db.users,
                  as: "user",
                },
              ],
            },
          ],
        },
        {
          model: BusRoute,
          as: "route",
        },
        {
          model: BusStop,
          as: "pickupStop",
        },
        {
          model: BusStop,
          as: "dropoffStop",
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({
        message: "Bus assignment not found",
      });
    }

    return res.status(200).json(assignment);
  } catch (error) {
    console.error("Error fetching bus assignment:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch bus assignment",
      error: error.message,
    });
  }
};

/**
 * Update bus assignment
 */
const updateBusAssignment = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    const assignment = await BusAssignment.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!assignment) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Bus assignment not found",
      });
    }

    const {
      pickupStopId,
      dropoffStopId,
      activeDays,
      guardianPhone,
      emergencyContact,
      specialRequirements,
      effectiveTo,
      status,
    } = req.body;

    // Validate stops if being updated
    if (pickupStopId) {
      const pickupStop = await BusStop.findByPk(pickupStopId, { transaction });
      if (!pickupStop || pickupStop.routeId !== assignment.routeId) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Invalid pickup stop",
        });
      }
      assignment.pickupStopId = pickupStopId;
    }

    if (dropoffStopId) {
      const dropoffStop = await BusStop.findByPk(dropoffStopId, {
        transaction,
      });
      if (!dropoffStop || dropoffStop.routeId !== assignment.routeId) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Invalid dropoff stop",
        });
      }
      assignment.dropoffStopId = dropoffStopId;
    }

    if (activeDays) assignment.activeDays = activeDays;
    if (guardianPhone) assignment.guardianPhone = guardianPhone;
    if (emergencyContact) assignment.emergencyContact = emergencyContact;
    if (specialRequirements !== undefined)
      assignment.specialRequirements = specialRequirements;
    if (effectiveTo) assignment.effectiveTo = effectiveTo;
    if (status) assignment.status = status;

    await assignment.save({ transaction });

    await transaction.commit();

    return res.status(200).json({
      message: "Bus assignment updated successfully",
      assignment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating bus assignment:", error);
    return res.status(500).json({
      message: "Server error: Failed to update bus assignment",
      error: error.message,
    });
  }
};

/**
 * Cancel bus assignment
 */
const cancelBusAssignment = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const assignment = await BusAssignment.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!assignment) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Bus assignment not found",
      });
    }

    if (assignment.status === "cancelled") {
      await transaction.rollback();
      return res.status(400).json({
        message: "Assignment is already cancelled",
      });
    }

    // Update assignment
    assignment.status = "cancelled";
    assignment.effectiveTo = new Date();
    assignment.isActive = false;

    await assignment.save({ transaction });

    // Note: Removed bus occupancy update since currentOccupancy doesn't exist

    await transaction.commit();

    return res.status(200).json({
      message: "Bus assignment cancelled successfully",
      assignment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error cancelling bus assignment:", error);
    return res.status(500).json({
      message: "Server error: Failed to cancel bus assignment",
      error: error.message,
    });
  }
};

/**
 * Get students on a bus
 */
const getStudentsOnBus = async (req, res) => {
  try {
    const { busId } = req.params;

    const assignments = await BusAssignment.findAll({
      where: {
        busId,
        status: "active",
      },
      include: [
        {
          model: Student,
          as: "student",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname"],
            },
          ],
        },
        {
          model: BusStop,
          as: "pickupStop",
        },
        {
          model: BusStop,
          as: "dropoffStop",
        },
      ],
    });

    return res.status(200).json({
      busId,
      count: assignments.length,
      students: assignments,
    });
  } catch (error) {
    console.error("Error fetching students on bus:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch students on bus",
      error: error.message,
    });
  }
};

/**
 * Get student's bus assignment
 */
const getStudentBusAssignment = async (req, res) => {
  try {
    const { studentId } = req.params;

    const assignment = await BusAssignment.findOne({
      where: {
        studentId,
        status: "active",
      },
      include: [
        {
          model: Bus,
          as: "bus",
          include: [
            {
              model: db.busdrivers,
              as: "assignedDriver",
              include: [
                {
                  model: db.users,
                  as: "user",
                  attributes: ["fullname", "phone"],
                },
              ],
            },
          ],
        },
        {
          model: BusRoute,
          as: "route",
        },
        {
          model: BusStop,
          as: "pickupStop",
        },
        {
          model: BusStop,
          as: "dropoffStop",
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({
        message: "No active bus assignment found for this student",
      });
    }

    return res.status(200).json(assignment);
  } catch (error) {
    console.error("Error fetching student bus assignment:", error);
    return res.status(500).json({
      message: "Server error: Failed to fetch student bus assignment",
      error: error.message,
    });
  }
};

module.exports = {
  assignStudentToBus,
  getAllBusAssignments,
  getBusAssignmentById,
  updateBusAssignment,
  cancelBusAssignment,
  getStudentsOnBus,
  getStudentBusAssignment,
};
