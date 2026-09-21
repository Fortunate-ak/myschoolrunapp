const db = require("../models/index");
const { Op } = require("sequelize");
const Role = db.role;
const Student = db.students;
const User = db.users;
const Class = db.classes;
const Grade = db.grades;
const Driver = db.drivers;
const GuardianStudents = db.guardianstudents;
const ClassName = db.classnames;
const Guardian = db.guardians;
const VehicleRoute = db.vehicleroutes;
const Vehicle = db.vehicles;
const { hashPassword } = require("../utils/authHelpers");
const { isGuardianSubscriptionActive } = require("../utils/subscriptionHelpers");
const requestIp = require("request-ip");
const {
  generateAndHashPassword,
  generateEmailFromName,
  generateEmailWithStudentNumber,
  generatePasswordFromName,
  generateStudentNumber,
} = require("../utils/userHelpers");
const { syncGuardianToRouteChannel } = require("./messagesController");
const logAudit = require("../utils/logAudit");
const sendEmail = require("../middleware/emailTransporter");
const { studentConfirmationTemplate } = require("../utils/emailTemplate");

const setGuardianProfile = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const guardianId = req.user.id;
    const {
      studentName,
      studentGender,
      relationshipToStudent,
      guardianGender,
      guardianAddress,
      existingGuardianId,
      homeAddress,
      schoolAddress,
    } = req.body;

    if (!studentName || !studentGender || !homeAddress) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Student name, home address and gender are required",
      });
    }

    const existingGuardian = await Guardian.findOne({
      where: { userId: guardianId },
      transaction,
    });

    if (existingGuardian) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Guardian profile already exists" });
    }

    // ── Resolve roles ─────────────────────────────────────────────────────────
    const [studentRole, guardianRole] = await Promise.all([
      Role.findOne({ where: { name: "student" }, transaction }),
      Role.findOne({ where: { name: "guardian" }, transaction }),
    ]);

    if (!studentRole || !guardianRole) {
      await transaction.rollback();
      return res.status(500).json({ message: "Role not found" });
    }

    const guardian = await Guardian.create(
      {
        userId: guardianId,
        guardianAddress: guardianAddress ? guardianAddress : null,
        gender: guardianGender,
        isActive: true,
      },
      { transaction },
    );

    const student = await Student.create(
      {
        fullname: studentName,
        gender: studentGender,
        isActive: true,
        homeAddress: homeAddress ? homeAddress : null,
        vehicleRouteId: null,
        vehicleStopId: null,
        schoolAddress: schoolAddress ? schoolAddress : null,
      },
      { transaction },
    );

    // ── Link guardian ↔ student ───────────────────────────────────────────────
    await GuardianStudents.create(
      {
        guardianId: guardian.id,
        studentId: student.id,
        relationshipToStudent: relationshipToStudent || "guardian",
      },
      { transaction },
    );

    await transaction.commit();

    await logAudit({
      userId: guardianId,
      action: "guardian_profile_created",
      entity: "Guardian",
      entityId: guardian.id,
      metadata: {
        guardianId: guardian.id,
        studentId: student.id,
        studentName: studentName,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    // Return full hydrated record for the UI
    const result = await Student.findByPk(student.id, {
      include: [
        {
          model: Guardian,
          as: "guardians",
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email", "phone"],
            },
          ],
        },
      ],
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return res
      .status(500)
      .json({ message: "Server error: Failed to create student details" });
  }
};

const setDriverProfile = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  const userId = req.user.id;

  try {
    const {
      idNumber,
      licenseNumber,
      gender,
      profileImage,
      carMake,
      carModel,
      image,
      registrationNumber,
      capacity,
      lastServiceDate,
      nextServiceDate,
      insuranceExpiry,
    } = req.body;

    const driverExists = await Driver.findOne({
      where: { userId },
      include: [
        { model: User, as: "user", include: [{ model: Role, as: "role" }] },
      ],
      transaction,
    });

    if (driverExists) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver profile already exists" });
    }

    const driver = await Driver.create(
      {
        userId: userId,
        idNumber: idNumber,
        licenseNumber: licenseNumber,
        gender: gender,
        isActive: true,
        profileImage: req.files?.profileImage?.[0]?.path.replace(/\\/g, "/"),
      },
      { transaction },
    );

    const vehicleExists = await Vehicle.findOne({
      where: { driverId: driver.id, registrationNumber: registrationNumber },
      transaction,
    });

    if (vehicleExists) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Vehicle already exists for user" });
    }

    const vehicle = await Vehicle.create(
      {
        driverId: driver.id,
        image: req.files?.vehicleImage?.[0]?.path.replace(/\\/g, "/"),
        carModel,
        carMake,
        registrationNumber,
        capacity,
        lastServiceDate,
        nextServiceDate,
        insuranceExpiry,
        isActive: true,
      },
      { transaction },
    );

    await transaction.commit();

    await logAudit({
      userId: userId,
      action: "driver_set_profile",
      entity: "Driver",
      entityId: driver.id,
      metadata: {
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res
      .status(201)
      .json({ message: "Driver profile set successfully", vehicle, driver });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error(error);

    return res
      .status(500)
      .json({ message: "Server error. Failed to set profile" });
  }
};

const addStudentToGuardian = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const guardianId = req.user.id;

    const {
      studentName,
      studentGender,
      relationshipToStudent,
      homeAddress,
      schoolAddress,
    } = req.body;

    if (!studentName || !studentGender) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Student name and gender are required" });
    }

    const guardian = await Guardian.findOne({
      where: { userId: guardianId },
      transaction,
    });

    if (!guardian) {
      await transaction.rollback();
      return res.status(404).json({
        message:
          "Guardian profile not found. Please complete your profile first.",
      });
    }

    if (!guardian.isActive) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Guardian account is not active.",
      });
    }

    const existingStudent = await Student.findOne({
      where: { fullname: studentName },
      include: [
        {
          model: Guardian,
          as: "guardians",
          where: { id: guardian.id },
          required: true,
        },
      ],
      transaction,
    });

    if (existingStudent) {
      await transaction.rollback();
      return res.status(400).json({
        message: `${studentName} is already associated with your account.`,
      });
    }

    const studentRole = await Role.findOne({
      where: { name: "student" },
      transaction,
    });

    if (!studentRole) {
      await transaction.rollback();
      return res.status(500).json({ message: "Student role not found" });
    }

    // homeAddress/schoolAddress are both editable on the client. If the
    // guardian doesn't override them, default to whichever address is on
    // file for an existing sibling — most students at the same guardian
    // share a home, but not always a school (or, in co-parenting cases,
    // not always a home either), so this is a starting point, not a rule.
    let defaultHomeAddress = null;
    let defaultSchoolAddress = null;
    if (!homeAddress || !schoolAddress) {
      const siblingStudent = await Student.findOne({
        include: [
          {
            model: Guardian,
            as: "guardians",
            where: { id: guardian.id },
            required: true,
          },
        ],
        order: [["createdAt", "ASC"]],
        transaction,
      });
      defaultHomeAddress = siblingStudent?.homeAddress || null;
      defaultSchoolAddress = siblingStudent?.schoolAddress || null;
    }

    // Route/stop are intentionally NOT set here — see setGuardianProfile.
    // Assignment happens only once a driver approves a route_stop_request.

    const student = await Student.create(
      {
        fullname: studentName,
        gender: studentGender,
        isActive: true,
        homeAddress: homeAddress || defaultHomeAddress,
        schoolAddress: schoolAddress || defaultSchoolAddress,
        vehicleRouteId: null,
        vehicleStopId: null,
      },
      { transaction },
    );

    await GuardianStudents.create(
      {
        guardianId: guardian.id,
        studentId: student.id,
        relationshipToStudent: relationshipToStudent || "guardian",
      },
      { transaction },
    );

    await transaction.commit();

    await logAudit({
      userId: guardianId,
      action: "guardian_added_student",
      entity: "Student",
      entityId: student.id,
      metadata: {
        guardianId: guardian.id,
        studentName: studentName,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    const result = await Student.findByPk(student.id, {
      include: [
        {
          model: Guardian,
          as: "guardians",
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email", "phone"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({
      message: "Student added successfully",
      student: result,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    return res.status(500).json({
      message: "Server error: Failed to add student",
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, attributes: ["name"], as: "role" }],
    });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

const getAllGuardians = async (req, res) => {
  try {
    const guardians = await Guardian.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email", "phone", "isActive"],
          include: {
            model: Role,
            as: "role",
            attributes: ["name"],
            where: { name: "guardian" },
          },
        },
        {
          model: Student,
          as: "students",
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            { model: User, as: "user", attributes: ["id", "fullname"] },
          ],
        },
      ],
    });
    return res.status(200).json(guardians);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error: Failed to fetch guardians" });
  }
};

const getGuardianById = async (req, res) => {
  try {
    const { id } = req.params;
    const guardian = await Guardian.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email", "phone", "isActive"],
          include: { model: Role, as: "role", attributes: ["name"] },
        },
        {
          model: Student,
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email"],
            },
          ],
        },
      ],
    });

    if (!guardian)
      return res.status(404).json({ message: "Guardian not found" });
    return res.status(200).json(guardian);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch guardian" });
  }
};

const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname"],
          include: [
            {
              model: Role,
              as: "role",
              attributes: ["name"],
              where: { name: "driver" },
            },
          ],
        },
        {
          model: Vehicle,
          as: "vehicle",
          include: [
            {
              model: VehicleRoute,
            },
          ],
        },
      ],
    });
    return res.status(200).json(drivers);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch drivers" });
  }
};

const updateUserStatus = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const updates = req.body;

    // Update status field (if you're using a 'status' field)
    // Or update isActive if that's what you're using
    if (updates.status !== undefined) {
      user.status = updates.status;
    }

    // If you also want to update isActive based on status
    if (updates.status !== undefined) {
      user.isActive =
        updates.status === "active" || updates.status === "Active";
    }

    // Also support direct isActive updates
    if (updates.isActive !== undefined) {
      user.isActive = updates.isActive;
    }

    await user.save({ transaction });
    await transaction.commit();

    // Log audit after commit
    try {
      await logAudit({
        userId: user?.id,
        action: "changed_user_status",
        entity: "User",
        entityId: user.id,
        metadata: {
          email: user?.email,
          role: user?.role?.name,
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          previousStatus:
            user.previous("isActive") !== undefined
              ? user.previous("isActive")
              : null,
          newStatus: user.isActive,
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    return res.status(200).json(user);
  } catch (error) {
    // Only rollback if transaction is not already finished
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }

    console.error("updateUserStatus error:", error);
    return res.status(500).json({
      message: "Internal server error: Failed to update user status",
      error: error.message,
    });
  }
};

const bulkActivateUsers = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const currentUser = req.user;

  try {
    const { userIds } = req.body;
    const { isActive } = req.body; // Should be true for activation

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "User IDs are required" });
    }

    if (typeof isActive !== "boolean") {
      await transaction.rollback();
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    // Find all users
    const users = await User.findAll({
      where: {
        id: userIds,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (users.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "No users found" });
    }

    // Update all users
    const updatedUsers = [];
    for (const user of users) {
      user.isActive = isActive;
      await user.save({ transaction });
      updatedUsers.push(user);
    }

    await transaction.commit();

    // Log audit
    try {
      await logAudit({
        userId: currentUser?.id,
        action: isActive ? "activated_bulk_users" : "deactivated_bulk_users",
        entity: "User",
        entityId: userIds.join(","),
        metadata: {
          email: currentUser?.email,
          role: currentUser?.role?.name,
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          userIds: userIds,
          count: userIds.length,
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    return res.status(200).json({
      message: `${users.length} users ${isActive ? "activated" : "deactivated"} successfully`,
      updatedUsers,
    });
  } catch (error) {
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Bulk activate users error:", error);
    return res.status(500).json({
      message: "Server error: Failed to update users",
      error: error.message,
    });
  }
};

const bulkDeactivateUsers = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const currentUser = req.user;

  try {
    const { userIds } = req.body;
    const { isActive } = req.body; // Should be false for deactivation

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "User IDs are required" });
    }

    if (typeof isActive !== "boolean") {
      await transaction.rollback();
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    // Prevent deactivating yourself
    if (userIds.includes(currentUser.id)) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "You cannot deactivate your own account" });
    }

    // Find all users
    const users = await User.findAll({
      where: {
        id: userIds,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (users.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "No users found" });
    }

    // Update all users
    const updatedUsers = [];
    for (const user of users) {
      user.isActive = isActive;
      await user.save({ transaction });
      updatedUsers.push(user);
    }

    await transaction.commit();

    // Log audit
    try {
      await logAudit({
        userId: currentUser?.id,
        action: isActive ? "activated_bulk_users" : "deactivated_bulk_users",
        entity: "User",
        entityId: userIds.join(","),
        metadata: {
          email: currentUser?.email,
          role: currentUser?.role?.name,
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          userIds: userIds,
          count: userIds.length,
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    return res.status(200).json({
      message: `${users.length} users ${isActive ? "activated" : "deactivated"} successfully`,
      updatedUsers,
    });
  } catch (error) {
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Bulk deactivate users error:", error);
    return res.status(500).json({
      message: "Server error: Failed to update users",
      error: error.message,
    });
  }
};

const deactivateUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const currentUser = req.user;

  try {
    const { id } = req.params;

    // Prevent deactivating yourself
    if (id === currentUser.id) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "You cannot deactivate your own account" });
    }

    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      await transaction.rollback();
      return res.status(400).json({ message: "User is already deactivated" });
    }

    user.isActive = false;
    await user.save({ transaction });
    await transaction.commit();

    // Log audit
    try {
      await logAudit({
        userId: currentUser?.id,
        action: "deactivate_user",
        entity: "User",
        entityId: user.id,
        metadata: {
          email: currentUser?.email,
          role: currentUser?.role?.name,
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          deactivatedUser: user.email,
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    return res.status(200).json(user);
  } catch (error) {
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Deactivate user error:", error);
    return res.status(500).json({
      message: "Server error: Failed to deactivate user",
      error: error.message,
    });
  }
};

// Single user activation
const activateUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const currentUser = req.user;

  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isActive) {
      await transaction.rollback();
      return res.status(400).json({ message: "User is already active" });
    }

    user.isActive = true;
    await user.save({ transaction });
    await transaction.commit();

    // Log audit
    try {
      await logAudit({
        userId: currentUser?.id,
        action: "activate_user",
        entity: "User",
        entityId: user.id,
        metadata: {
          email: currentUser?.email,
          role: currentUser?.role?.name,
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
          activatedUser: user.email,
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    return res.status(200).json(user);
  } catch (error) {
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Activate user error:", error);
    return res.status(500).json({
      message: "Server error: Failed to activate user",
      error: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const { id } = req.params;

  try {
    const user = await User.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const updates = req.body;
    ["fullname", "email", "phone", "isActive"].forEach((field) => {
      if (updates[field] !== undefined) {
        if (field === "isActive" && typeof updates[field] === "string") {
          user[field] =
            updates[field] === "Active" || updates[field] === "true";
        } else {
          user[field] = updates[field];
        }
      }
    });

    await user.save({ transaction });
    await transaction.commit();

    const updatedUser = await User.findByPk(id, {
      include: [{ model: Role, attributes: ["name"], as: "role" }],
    });
    return res.status(200).json(updatedUser);
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal server error: Failed to update user" });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const students = await Student.findAll({
      include: [
        {
          model: Guardian,
          as: "guardians",
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email", "phone"],
            },
          ],
          required: false,
        },
      ],
    });
    return res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch students" });
  }
};

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findByPk(id, {
      include: [
        {
          model: Guardian,
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent"],
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "fullname", "email", "phone"],
            },
          ],
          required: false,
        },
      ],
    });

    if (!student) return res.status(404).json({ message: "Student not found" });
    return res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch student" });
  }
};

const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    return res.status(200).json(roles);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch roles" });
  }
};

const getGuardianStudents = async (req, res) => {
  try {
    const { id } = req.user;

    // Find the guardian with their user info
    const guardian = await Guardian.findOne({
      where: { userId: id, isActive: true },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullname", "email"],
        },
        {
          model: Student,
          as: "students",
          through: {
            model: GuardianStudents,
            attributes: ["relationshipToStudent", "id"],
          },
          include: [
            {
              model: VehicleRoute,
              as: "vehicleRoute",
              include: [
                {
                  model: Vehicle,
                  as: "vehicle",
                  include: [{ model: Driver, as: "driver" }],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!guardian) {
      return res.status(404).json({
        success: false,
        message: "Guardian profile not found",
      });
    }

    // If guardian has no students
    if (!guardian.students || guardian.students.length === 0) {
      return res.status(200).json({
        message: "No students associated with this guardian",
        guardian: {
          id: guardian.id,
          name: guardian.user?.fullname || "Guardian",
          email: guardian.email,
          phone: guardian.phone,
          occupation: guardian.occupation,
          address: guardian.address,
        },
        students: [],
        totalStudents: 0,
      });
    }

    return res.status(200).json(guardian);
  } catch (error) {
    console.error("Error fetching guardian's students:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch students",
      error: error.message,
    });
  }
};

const updateDriver = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { id } = req.params;
    const updates = req.body;

    // Find vehicle driver with user
    const vehicleDriver = await Driver.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: [{ model: User, as: "user" }],
    });

    if (!vehicleDriver) {
      await transaction.rollback();
      return res.status(404).json({ message: "Vehicle driver not found" });
    }

    // Update user fields
    if (updates.fullname !== undefined && vehicleDriver.user) {
      vehicleDriver.user.fullname = updates.fullname;
      await vehicleDriver.user.save({ transaction });
    }

    if (updates.email !== undefined && vehicleDriver.user) {
      vehicleDriver.user.email = updates.email;
      await vehicleDriver.user.save({ transaction });
    }

    if (updates.phone !== undefined && vehicleDriver.user) {
      vehicleDriver.user.phone = updates.phone;
      await vehicleDriver.user.save({ transaction });
    }

    if (updates.isActive !== undefined && vehicleDriver.user) {
      vehicleDriver.user.isActive = updates.isActive;
      await vehicleDriver.user.save({ transaction });
    }

    // Update driver fields
    const driverFields = [
      "licenseNumber",
      "experienceYears",
      "phoneNumber",
      "status",
      "medicalCertificateExpiry",
      "joinDate",
      "emergencyContact",
      "isActive",
    ];

    driverFields.forEach((field) => {
      if (updates[field] !== undefined) {
        vehicleDriver[field] = updates[field];
      }
    });

    await vehicleDriver.save({ transaction });

    // Commit the transaction first
    await transaction.commit();

    // Log audit after commit
    try {
      await logAudit({
        userId: req.user?.id,
        action: "update_vehicle_driver",
        entity: "Driver",
        entityId: vehicleDriver.id,
        metadata: {
          email: vehicleDriver.user?.email,
          role: "driver",
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      console.error("Audit logging error:", auditError);
    }

    // Return updated driver with user
    const result = await Driver.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });

    return res.status(200).json(result);
  } catch (error) {
    // Only rollback if transaction is not already finished
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }

    console.error("Update vehicle driver error:", error);
    return res.status(500).json({
      message: "Server error: Failed to update vehicle driver",
      error: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.findByPk(id, {
      attributes: [
        "id",
        "fullname",
        "email",
        "phone",
        "isActive",
        "createdAt",
        "updatedAt",
      ],
      include: [{ model: Role, as: "role", attributes: ["id", "name"] }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const roleName = user.role?.name;
    let roleDetails = null;

    switch (roleName) {
      case "guardian": {
        // Fetch the raw Sequelize record first so we can both include
        // associations AND compute the canUseApp flag from the instance
        // (isGuardianSubscriptionActive needs isSubscribed/
        // subscriptionExpiresAt, which toJSON() alone won't give us a
        // place to attach a derived field to).
        const guardianRecord = await Guardian.findOne({
          where: { userId: id },
          include: [
            {
              model: Student,
              as: "students",
              through: {
                model: GuardianStudents,
                attributes: ["relationshipToStudent"],
              },
            },
          ],
        });

        if (guardianRecord) {
          // Option 2: canUseApp is purely "is System B's subscription
          // active" — there is no app-wide trial gate anymore. This is
          // computed here (not stored) so it's always derived fresh from
          // isSubscribed + subscriptionExpiresAt rather than risking a
          // stale stored value.
          roleDetails = guardianRecord.toJSON();
          roleDetails.canUseApp = isGuardianSubscriptionActive(guardianRecord);
        } else {
          roleDetails = null;
        }
        break;
      }
      case "driver":
        roleDetails = (await Driver.findOne({ where: { userId: id } })) ?? null;
        break;
      default:
        roleDetails = null;
    }

    return res.status(200).json({ user, roleDetails });
  } catch (error) {
    console.error("getProfile error", error);
    return res
      .status(500)
      .json({ message: "Server error: Failed to fetch profile" });
  }
};

const createUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const { fullname, email, role, phone } = req.body;

  if (!fullname || !email || !role) {
    await transaction.rollback();
    return res.status(400).json({
      message: "Fullname, email and role are required",
    });
  }

  try {
    const roleInstance = await Role.findOne({
      where: { name: role },
      transaction,
    });
    const emailExists = await User.findOne({
      where: { email: email },
      transaction,
    });

    if (emailExists) {
      await transaction.rollback();
      return res.status(401).json({ message: "Email already exists" });
    }

    if (!roleInstance) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid role" });
    }

    const adminPassword = await generateAndHashPassword(fullname);

    const user = await User.create(
      {
        email,
        roleId: roleInstance.id,
        password: adminPassword,
        phone,
        fullname,
      },
      { transaction },
    );

    if (role !== "admin") {
      const token = crypto.randomBytes(32).toString("hex");

      user.inviteToken = token;
      user.inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.save({ transaction });
    }

    await transaction.commit();

    // Move audit logging AFTER commit, but handle its errors separately
    try {
      await logAudit({
        userId: user.id,
        action: "create_user",
        entity: "User",
        entityId: user.id,
        metadata: {
          email: user?.email,
          role: role, // Fixed: roleInstance?.name might be undefined, use the role variable
          ip: userIp,
          userAgent: userAgent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      // Don't fail the main operation if audit logging fails
      console.error("Failed to log audit:", auditError);
      // Optionally log to a different error tracking system
    }

    return res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    // Only rollback if transaction is still active
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error creating user", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const VALID_PAYMENT_METHODS = ["card", "ecocash", "onemoney", "bank_transfer", "cash_on_pickup"];

const subscribeGuardian = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const guardianId = req.user.id;
    const { plan, paymentMethod, paymentReference } = req.body;

    const validPlans = ["basic", "family", "premium"];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ message: "A valid plan is required" });
    }

    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "A valid payment method is required" });
    }

    if (!paymentReference || !paymentReference.trim()) {
      return res.status(400).json({ message: "A payment reference is required" });
    }

    const guardian = await Guardian.findOne({ where: { userId: guardianId } });

    if (!guardian) {
      return res.status(404).json({
        message: "Guardian profile not found. Please complete your profile first.",
      });
    }

    // 30-day billing cycle from now — adjust if your pricing model differs
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    guardian.isSubscribed = true;
    guardian.subscriptionPlan = plan;
    guardian.subscriptionExpiresAt = expiresAt;
    guardian.paymentMethod = paymentMethod;
    guardian.paymentReference = paymentReference.trim();
    await guardian.save();

    await logAudit({
      userId: guardianId,
      action: "guardian_subscribed",
      entity: "Guardian",
      entityId: guardian.id,
      metadata: {
        plan,
        expiresAt,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    // Attach the freshly-computed canUseApp so the guardian's Redux state
    // (subscribeGuardian.fulfilled replaces guardianProfile wholesale with
    // this response) reflects access immediately, without waiting on a
    // separate getGuardianProfile() refetch.
    const guardianJSON = guardian.toJSON();
    guardianJSON.canUseApp = isGuardianSubscriptionActive(guardian);
    return res.status(200).json(guardianJSON);
  } catch (error) {
    console.error("subscribeGuardian error:", error);
    return res.status(500).json({ message: "Server error: Failed to subscribe" });
  }
};

module.exports = {
  updateUserStatus,
  getAllUsers,
  getAllGuardians,
  getAllRoles,
  getAllStudents,
  getGuardianById,
  getStudentById,
  updateUser,
  getProfile,
  getGuardianStudents,
  updateDriver,
  getAllDrivers,
  createUser,
  bulkDeactivateUsers,
  bulkActivateUsers,
  deactivateUser,
  activateUser,
  addStudentToGuardian,
  setDriverProfile,
  setGuardianProfile,
  subscribeGuardian,
};
