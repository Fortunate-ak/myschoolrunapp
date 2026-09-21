const db = require("../models/index");
const GuardianRequest = db.guardianrequests;
const User = db.users;
const Driver = db.drivers;
const Guardian = db.guardians;
const Student = db.students;
const VehicleRoute = db.vehicleroutes;
const GuardianStudents = db.guardianstudents;
const { notifyUser } = require("../services/notificationService");
const { guardianRequestMessages } = require("../services/notificationMessages");
const { isGuardianSubscriptionActive } = require("../utils/subscriptionHelpers");

const VALID_REQUEST_TYPES = ["student_onboard_request", "route_stop_request"];

const isValidLocation = (loc) =>
  loc &&
  typeof loc === "object" &&
  loc.latitude != null &&
  loc.longitude != null;

// ── CREATE REQUEST ───────────────────────────────────────────────────────────

const createRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.user;

  try {
    const guardian = await Guardian.findOne({
      where: { userId: id },
      include: [{ model: User, as: "user" }],
      transaction,
    });

    if (!guardian) {
      await transaction.rollback();
      return res.status(404).json({ message: "Guardian profile not found" });
    }

    // ── SUBSCRIPTION GATE (System B — authoritative, server-side) ─────────
    // This is the actual enforcement point for Option 2: booking a driver
    // requires an active guardian subscription. There is no trial fallback
    // here — System A was never wired up anywhere in the app and has been
    // dropped from the plan entirely. Uses the same isGuardianSubscriptionActive
    // helper as getProfile/subscribeGuardian so all three stay in sync.
    if (!isGuardianSubscriptionActive(guardian)) {
      await transaction.rollback();
      return res.status(403).json({
        message: "An active subscription is required to request a driver.",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    const {
      driverId,
      requestType,
      numberOfStudents,
      routeId,
      vehicleStopId,
      studentId, // legacy single student
      studentIds, // new array of student IDs
      students, // for onboard request
    } = req.body;

    if (!requestType || !VALID_REQUEST_TYPES.includes(requestType)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Valid request type is required" });
    }
    if (!driverId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Driver ID is required" });
    }

    const driver = await Driver.findByPk(driverId, {
      include: [{ model: User, as: "user" }],
      transaction,
    });
    if (!driver) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const payload = {
      driverId,
      guardianId: guardian.id,
      requestType,
      status: "pending",
    };

    // ── STUDENT ONBOARD REQUEST ──────────────────────────────────────────
    if (requestType === "student_onboard_request") {
      if (!Array.isArray(students) || students.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "At least one student is required for this request",
        });
      }

      for (const [index, s] of students.entries()) {
        if (!s?.fullname || !s?.gender) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Student at position ${index + 1} is missing a fullname or gender`,
          });
        }
        if (!isValidLocation(s.homeAddress)) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Student at position ${index + 1} is missing a valid home address`,
          });
        }
        if (!isValidLocation(s.schoolAddress)) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Student at position ${index + 1} is missing a valid school address`,
          });
        }
      }

      payload.students = students.map((s) => ({
        fullname: s.fullname,
        gender: s.gender,
        homeAddress: s.homeAddress,
        schoolAddress: s.schoolAddress,
      }));
      payload.numberOfStudents = students.length;

      // ── ROUTE / STOP REQUEST ─────────────────────────────────────────────
    } else {
      // route_stop_request
      // Accept studentIds array OR single studentId (backward compatible)
      let studentIdArray = studentIds || (studentId ? [studentId] : []);
      if (studentIdArray.length === 0) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ message: "At least one student is required" });
      }

      if (!routeId) {
        await transaction.rollback();
        return res.status(400).json({ message: "Route ID is required" });
      }

      const route = await VehicleRoute.findByPk(routeId, { transaction });
      if (!route) {
        await transaction.rollback();
        return res.status(404).json({ message: "Vehicle route not found" });
      }

      // Validate each student
      const studentsData = [];
      for (const sid of studentIdArray) {
        const link = await GuardianStudents.findOne({
          where: { guardianId: guardian.id, studentId: sid },
          transaction,
        });
        if (!link) {
          await transaction.rollback();
          return res
            .status(403)
            .json({ message: `Student ${sid} is not linked to your account` });
        }
        const student = await Student.findByPk(sid, { transaction });
        if (!student) {
          await transaction.rollback();
          return res.status(404).json({ message: `Student ${sid} not found` });
        }
        if (
          !isValidLocation(student.homeAddress) ||
          !isValidLocation(student.schoolAddress)
        ) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Student ${student.fullname} needs a home and school address with coordinates before requesting a route`,
          });
        }
        studentsData.push({
          id: student.id,
          fullname: student.fullname,
          gender: student.gender,
          homeAddress: student.homeAddress,
          schoolAddress: student.schoolAddress,
        });
      }

      // Store payload
      payload.students = studentsData;
      payload.routeId = route.id;
      // Keep single studentId for backward compatibility (first student)
      payload.studentId = studentsData[0].id;
      payload.homeLocation = studentsData[0].homeAddress;
      payload.schoolLocation = studentsData[0].schoolAddress;
    }

    const request = await GuardianRequest.create(payload, { transaction });
    await transaction.commit();

    // Notify driver
    try {
      await notifyUser(
        driver.user?.id,
        guardianRequestMessages.request_sent(
          request,
          guardian.user?.fullname || "A guardian",
        ),
        req.app.get("io"),
      );
    } catch (notifyError) {
      console.error("Failed to notify driver of new request:", notifyError);
    }

    return res.status(201).json({ message: "Request sent", request });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Create request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── APPROVE REQUEST ─────────────────────────────────────────────────────────

const approveRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.user;
  const { requestId } = req.params;

  try {
    const driver = await Driver.findOne({ where: { userId: id } });
    const request = await GuardianRequest.findOne({
      where: { id: requestId, driverId: driver.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: `Request is already ${request.status}` });
    }

    request.status = "approved";
    await request.save({ transaction });

    // ── For route_stop_request, assign all students to the route ────────
    if (
      request.requestType === "route_stop_request" &&
      request.students &&
      request.students.length
    ) {
      const route = await VehicleRoute.findByPk(request.routeId, {
        transaction,
      });
      if (!route) {
        await transaction.rollback();
        return res.status(404).json({ message: "Route no longer exists" });
      }

      for (const studentData of request.students) {
        const student = await Student.findByPk(studentData.id, { transaction });
        if (!student) continue;

        const homeStop = route.findOrCreateStop(
          studentData.homeAddress,
          "home",
          `${studentData.fullname}'s Home`,
        );
        const schoolStop = route.findOrCreateStop(
          studentData.schoolAddress,
          "school",
          studentData.schoolAddress?.address || "School Stop",
        );

        await Student.update(
          {
            vehicleRouteId: route.id,
            vehicleStopId: homeStop?.id || null,
            schoolStopId: schoolStop?.id || null,
          },
          { where: { id: student.id }, transaction },
        );
      }

      // Triggers afterUpdate hook to sync route.stops with vehiclestops table
      await route.save({ transaction, hooks: true });
    }

    await transaction.commit();

    // Notify guardian
    try {
      const guardianRecord = await Guardian.findByPk(request.guardianId, {
        include: [{ model: User, as: "user" }],
      });
      const io = req.app.get("io");
      await notifyUser(
        guardianRecord?.user?.id,
        guardianRequestMessages.request_approved(
          request,
          req.user.fullname || "Your driver",
        ),
        io,
      );
      if (io && guardianRecord?.user?.id) {
        io.to(`user-${guardianRecord.user.id}`).emit(
          "guardian-request-update",
          { request },
        );
      }
    } catch (notifyError) {
      console.error("Failed to notify guardian of approval:", notifyError);
    }

    return res.status(200).json({ message: "Request approved", request });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Approve request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── REJECT REQUEST ──────────────────────────────────────────────────────────

const rejectRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.user;
  const { requestId } = req.params;

  try {
    const driver = await Driver.findOne({ where: { userId: id } });
    const request = await GuardianRequest.findOne({
      where: { id: requestId, driverId: driver.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: `Request is already ${request.status}` });
    }

    request.status = "rejected";
    await request.save({ transaction });
    await transaction.commit();

    // Notify guardian
    try {
      const guardianRecord = await Guardian.findByPk(request.guardianId, {
        include: [{ model: User, as: "user" }],
      });
      const io = req.app.get("io");
      await notifyUser(
        guardianRecord?.user?.id,
        guardianRequestMessages.request_rejected(
          request,
          req.user.fullname || "Your driver",
        ),
        io,
      );
      if (io && guardianRecord?.user?.id) {
        io.to(`user-${guardianRecord.user.id}`).emit(
          "guardian-request-update",
          { request },
        );
      }
    } catch (notifyError) {
      console.error("Failed to notify guardian of rejection:", notifyError);
    }

    return res.status(200).json({ message: "Request rejected", request });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Reject request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET ALL REQUESTS FOR DRIVER ────────────────────────────────────────────

const getAllRequestsForDriver = async (req, res) => {
  const { id } = req.user;

  const driver = await Driver.findOne({ where: { userId: id } });

  try {
    const requests = await GuardianRequest.findAll({
      where: { driverId: driver.id },
      include: [
        {
          model: Guardian,
          as: "guardian",
          include: [{ model: User, as: "user" }],
        },
        {
          model: VehicleRoute,
          as: "route", // we have this association in the model
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.status(200).json(requests);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET ALL REQUESTS FOR GUARDIAN ──────────────────────────────────────────

const getAllGuardianRequests = async (req, res) => {
  const { id } = req.user;

  try {
    const guardian = await Guardian.findOne({ where: { userId: id } });
    if (!guardian) {
      return res.status(404).json({ message: "Guardian profile not found" });
    }

    const requests = await GuardianRequest.findAll({
      where: { guardianId: guardian.id },
      order: [["createdAt", "DESC"]],
    });
    return res.status(200).json(requests);
  } catch (error) {
    console.error("Get guardian requests error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── CANCEL REQUEST ──────────────────────────────────────────────────────────

const cancelRequest = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.user;
  const { requestId } = req.params;

  try {
    const guardian = await Guardian.findOne({
      where: { userId: id },
      transaction,
    });
    if (!guardian) {
      await transaction.rollback();
      return res.status(404).json({ message: "Guardian profile not found" });
    }

    const request = await GuardianRequest.findOne({
      where: { id: requestId, guardianId: guardian.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res.status(400).json({
        message: `Cannot cancel a request that is already ${request.status}`,
      });
    }

    request.status = "cancelled";
    await request.save({ transaction });
    await transaction.commit();

    // Notify driver
    try {
      const driverRecord = await Driver.findByPk(request.driverId, {
        include: [{ model: User, as: "user" }],
      });
      await notifyUser(
        driverRecord?.user?.id,
        guardianRequestMessages.request_cancelled(
          request,
          req.user.fullname || "A guardian",
        ),
        req.app.get("io"),
      );
    } catch (notifyError) {
      console.error("Failed to notify driver of cancellation:", notifyError);
    }

    return res.status(200).json({ message: "Request cancelled" });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Cancel request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  createRequest,
  cancelRequest,
  approveRequest,
  rejectRequest,
  getAllGuardianRequests,
  getAllRequestsForDriver,
};
