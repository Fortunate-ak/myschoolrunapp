const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  comparePassword,
  hashPassword,
  revokeAllUserTokens,
  revokeSpecificRefreshToken,
  blacklistToken,
  generateOTPWithExpiry,
  hashOTP,
  verifyOTP,
  isOTPExpired,
  getRemainingOTPAttempts,
} = require("../utils/authHelpers");
const db = require("../models/index");
const User = db.users;
const Role = db.role;
const { Op } = require("sequelize");
const logAudit = require("../utils/logAudit");
const bcrypt = require("bcryptjs");
const requestIp = require("request-ip");
const crypto = require("crypto");
const sendEmail = require("../middleware/emailTransporter");
const {
  forgotPasswordTemplate,
  passwordResetConfirmationTemplate,
  passwordChangeConfirmationTemplate,
  emailVerificationTemplate,
} = require("../utils/emailTemplate");

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
const ACCOUNT_LOCK_TIME = parseInt(process.env.ACCOUNT_LOCK_TIME) || 15;
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT) || 60;

const login = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { email, password, deviceInfo } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password are required",
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Role,
          as: "role",
        },
      ],
    });

    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    const lockStatus = user.getAccountLockStatus();

    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`,
        lockUntil: lockStatus.lockUntil,
        remainingMinutes: lockStatus.remainingMinutes,
        isLocked: true,
      });
    }

    if (user.lastLoginAttempt) {
      const timeSinceLastAttempt =
        Date.now() - new Date(user.lastLoginAttempt).getTime();
      const timeoutMs = LOGIN_TIMEOUT * 1000;
      if (
        timeSinceLastAttempt < timeoutMs &&
        user.loginAttempts >= MAX_LOGIN_ATTEMPTS
      ) {
        const waitSeconds = Math.ceil(
          (timeoutMs - timeSinceLastAttempt) / 1000,
        );
        return res.status(429).json({
          message: `Please try again in ${waitSeconds} seconds`,
          waitSeconds,
          remainingAttempts: 0,
        });
      }
    }

    // In the login function, replace the invalid password section (around line 75):
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      // Increment attempts and get new lock status
      const newLockStatus = await user.incrementLoginAttempts();

      // Re-fetch user to get updated values
      await user.reload();

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - user.loginAttempts;

      if (remainingAttempts <= 0) {
        return res.status(423).json({
          message: `Account Locked. Please try again in ${ACCOUNT_LOCK_TIME} minutes`,
          remainingAttempts: 0,
          lockUntil: newLockStatus.lockUntil,
          isLocked: true,
        });
      }

      return res.status(401).json({
        message: `Invalid credentials. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining`,
        remainingAttempts,
        attemptsUsed: user.loginAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      });
    }

    // ✅ Reset login attempts on successful login
    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user);
    const { refreshToken, jti } = await generateRefreshToken(user, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      ...deviceInfo,
    });

    // Store refresh token in database (if your model has this field)
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // ← key fix
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // ← key fix
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logAudit({
      userId: user.id,
      action: "login",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname, // Fixed: changed from user.name to user.fullname
        role: user.role?.name,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const signUp = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { fullname, email, phone, role, password, confirmPassword } =
      req.body;

    const userExists = await User.findOne({
      where: { email },
      include: [{ model: Role, as: "role" }],
    });

    let userRoleId;

    if (role === "driver") {
      const userRole = await Role.findOne({ where: { name: "driver" } });
      userRoleId = userRole.id;
    } else if (role === "guardian") {
      const userRole = await Role.findOne({ where: { name: "guardian" } });
      userRoleId = userRole.id;
    }

    if (userExists) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "User already exists. Please use another email" });
    }

    if (password !== confirmPassword) {
      await transaction.rollback();
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create(
      {
        fullname,
        email,
        phone: phone || null,
        password: hashedPassword,
        roleId: userRoleId,
        isVerified: false,
      },
      { transaction },
    );

    await transaction.commit();

    try {
      const { otp, expiresAt } = generateOTPWithExpiry(10);
      const hashedOTP = hashOTP(otp);

      user.emailVerificationOTP = hashedOTP;
      user.emailVerificationOTPExpires = expiresAt;
      user.emailVerificationOTPAttempts = 0;

      await user.save();

      const schoolName = "SchoolRun";
      const schoolLogo = "https://schoolrun.sonichub.co.zw/logo2.jpeg";
      const supportEmail = "support@schoolrun.co.zw";

      const emailHtml = emailVerificationTemplate({
        fullname: user.fullname || "User",
        otp: otp,
        expiryMinutes: 10,
        schoolName: schoolName,
        schoolLogo: schoolLogo,
        supportEmail: supportEmail,
      });

      await sendEmail({
        to: user.email,
        subject: "Verify Your Email Address",
        html: emailHtml,
      });
    } catch (error) {
      console.error("Failed to send verification email", error);
    }

    return res.status(201).json({
      message:
        "Account created successfully. A verification code has been sent to your email",
      user,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const unLockAccount = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "role" }], // Added role include for audit
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await user.resetLoginAttempts();

    await logAudit({
      userId: req.user?.id, // Log which admin performed the unlock
      action: "Unlock Account",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        unlockedBy: req.user?.email,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Account unlocked successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const unlockAllLockedAccounts = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  try {
    const [affectedCount] = await User.update(
      {
        loginAttempts: 0,
        lockUntil: null,
        lastLoginAttempt: null,
      },
      {
        where: {
          lockUntil: {
            [Op.ne]: null, // Fixed: use Op from Sequelize
          },
        },
      },
    );

    await logAudit({
      userId: req.user?.id,
      action: "Unlock All Accounts",
      entity: "Auth",
      entityId: "multiple",
      metadata: {
        unlockedCount: affectedCount,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: `Unlocked ${affectedCount} accounts`,
      unlockedCount: affectedCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getLockedAccounts = async (req, res) => {
  try {
    const lockedUsers = await User.findAll({
      where: {
        lockUntil: {
          [Op.gt]: new Date(), // Fixed: use Op from Sequelize
        },
      },

      include: [
        {
          model: Role,
          as: "role",
        },
      ],
    });

    return res.status(200).json({
      count: lockedUsers.length,
      users: lockedUsers,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getAccountStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const lockStatus = user.getAccountLockStatus();

    return res.status(200).json({
      success: true,
      data: {
        isLocked: lockStatus.isLocked,
        remainingAttempts: lockStatus.remainingAttempts,
        lockUntil: lockStatus.lockUntil,
        remainingMinutes: lockStatus.remainingMinutes,
        isActive: user.isActive,
        totalAttemptsUsed: lockStatus.isLocked
          ? MAX_LOGIN_ATTEMPTS
          : user.loginAttempts,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  // Get refresh token from cookie instead of body (more secure)
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: "No refresh token provided" });
  }

  try {
    // Use your verifyToken function with refresh secret
    const payload = verifyToken(refreshToken, true); // true indicates it's a refresh token

    if (!payload) {
      return res
        .status(403)
        .json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findByPk(payload.id, {
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }

    // Check if account is locked
    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      return res.status(423).json({ message: "Account is locked" });
    }

    // Verify stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Refresh token mismatch" });
    }

    const newAccessToken = generateAccessToken(user);

    // Set new access token cookie with same settings as login
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // ← Match login settings
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const Logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const accessToken = req.cookies?.accessToken;
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  const clearCookies = () => {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });
  };

  if (!refreshToken) {
    // Try to identify user from access token to clean up their session
    if (accessToken) {
      const payload = verifyToken(accessToken, false); // verify as access token
      if (payload?.id) {
        await revokeAllUserTokens(payload.id).catch(() => {});
        const user = await User.findByPk(payload.id);
        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      }
    }
    clearCookies();
    return res.status(200).json({ message: "Logged out successfully" });
  }

  try {
    let payload = null;
    try {
      payload = verifyToken(refreshToken, true);
    } catch (verifyError) {
      // Continue with logout even if token is invalid
    }

    if (payload && payload.id) {
      const user = await User.findByPk(payload.id, {
        include: [{ model: Role, as: "role" }],
      });

      if (user) {
        // Clear refresh token from database
        user.refreshToken = null;
        await user.save();

        // Blacklist the refresh token only if we have valid jti and exp
        if (payload.jti && payload.exp) {
          blacklistToken(payload.jti, payload.exp * 1000);
        }

        // Log audit only if we have valid user data
        await logAudit({
          userId: user.id,
          action: "logout",
          entity: "Auth",
          entityId: user.id,
          metadata: {
            email: user.email || "Unknown",
            role: user.role?.name || "Unknown",
            ip: userIp,
            userAgent: userAgent,
            timestamp: new Date().toISOString(),
          },
        }).catch((auditError) => {
          // Don't fail logout if audit fails
        });
      }
    }

    // Clear cookies regardless
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    // Still clear cookies on error
    try {
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      });
    } catch (cookieError) {}

    return res.status(200).json({ message: "Logged out successfully" });
  }
};

const changePassword = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  const deviceInfo = {
    ip: userIp,
    userAgent: userAgent,
    browser: req.get("User-Agent")?.split(" ").slice(-2).join(" ") || "Unknown",
    platform: req.get("User-Agent")?.includes("Windows")
      ? "Windows"
      : req.get("User-Agent")?.includes("Mac")
        ? "Mac"
        : req.get("User-Agent")?.includes("Linux")
          ? "Linux"
          : req.get("User-Agent")?.includes("Android")
            ? "Android"
            : req.get("User-Agent")?.includes("iOS")
              ? "iOS"
              : "Unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    const { id } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Both old and new passwords are required",
      });
    }

    if (newPassword.length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "role" }],
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Old password is incorrect",
      });
    }

    if (!user.isActive) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Account is deactivated. Cannot change password.",
      });
    }

    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      await transaction.rollback();
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`,
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      await transaction.rollback();
      return res.status(400).json({
        message: "New password cannot be the same as old password",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(newPassword, salt);

    user.password = encryptedPassword;
    await user.save({ transaction });

    await user.resetLoginAttempts();

    await transaction.commit();

    try {
      const schoolName = "Easglesvale School";
      const schoolLogo =
        "https://www.eaglesvale.ac.zw/wp-content/uploads/2023/12/Copy-of-Eaglesvale-Logo-FULL-COLOUR.png";
      const supportEmail = "support@schoolrun.co.zw";
      const portalUrl = `${req.protocol}://${req.get("host")}`;

      const emailHtml = passwordChangeConfirmationTemplate({
        fullname: user.fullname || "User",
        email: user.email,
        schoolName: schoolName,
        schoolLogo: schoolLogo,
        portalUrl: portalUrl,
        supportEmail: supportEmail,
        deviceInfo: {
          ip: deviceInfo.ip,
          browser: deviceInfo.browser,
          platform: deviceInfo.platform,
          userAgent: deviceInfo.userAgent,
          timestamp: deviceInfo.timestamp,
          location:
            req.headers["cf-ipcountry"] ||
            req.headers["x-country"] ||
            "Unknown",
        },
        changedVia: "Profile Settings",
      });

      await sendEmail({
        to: user.email,
        subject: "Password Changed Successfully",
        html: emailHtml,
      });
    } catch (error) {
      console.error(
        "❌ Failed to send password change confirmation email:",
        emailError,
      );
    }

    await logAudit({
      userId: user.id,
      action: "password_change",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user?.email,
        role: user?.role?.name,
        ip: userIp,
        userAgent: userAgent,
        deviceInfo: deviceInfo,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: "Server error" });
  }
};

const getCurrentUser = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const userId = req.user.id; // From passport authentication

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "role",
        },
      ],
    });

    if (!user) {
      return res.status(204).end();
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    const lockStatus = user.getAccountLockStatus();

    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`,
        isLocked: true,
        remainingMinutes: lockStatus.remainingMinutes,
      });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: user.role?.name,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const forgotPassword = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res
        .status(200)
        .json({ message: "A password reset link has been sent to your email" });
    }

    if (!user.isActive) {
      return res
        .status(200)
        .json({ message: "A password reset link has been sent" });
    }

    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      return res.status(200).json({
        message: " A password reset link has been sent",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetExpires;

    await user.save();

    const protocol = req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    const schoolName = "Easglesvale School";
    const schoolLogo =
      "https://www.eaglesvale.ac.zw/wp-content/uploads/2023/12/Copy-of-Eaglesvale-Logo-FULL-COLOUR.png";
    const supportEmail = "support@schoolrun.co.zw";

    const emailHtml = forgotPasswordTemplate({
      fullname: user.fullname || "User",
      resetLink: resetLink,
      expiryHours: 1,
      schoolName: schoolName,
      schoolLogo: schoolLogo,
      supportEmail: supportEmail,
    });

    const emailSent = await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: emailHtml,
    });

    if (emailSent) {
      console.log(`✅ Password reset email sent to ${user.email}`);
    } else {
      console.log(`❌ Failed to send password reset email to ${user.email}`);
    }

    await logAudit({
      userId: user.id,
      action: "forgot_password_request",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "A password reset link has been sent.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Please try again later",
    });
  }
};

const resetPassword = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  const deviceInfo = {
    ip: userIp,
    userAgent: userAgent,
    browser: req.get("User-Agent")?.split(" ").slice(-2).join(" ") || "Unknown",
    platform: req.get("User-Agent")?.includes("Windows")
      ? "Windows"
      : req.get("User-Agent")?.includes("Mac")
        ? "Mac"
        : req.get("User-Agent")?.includes("Linux")
          ? "Linux"
          : req.get("User-Agent")?.includes("Android")
            ? "Android"
            : req.get("User-Agent")?.includes("iOS")
              ? "iOS"
              : "Unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (newPassword.length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Passsword must be at least 6 characters",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      where: {
        email: email,
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
      include: [{ model: Role, as: "role" }],
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    if (!user.isActive) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      await transaction.rollback();
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes.`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save({ transaction });

    await transaction.commit();

    const protocol = req.protocol;
    const host = req.get("host");
    const portalUrl = `${protocol}://${host}`;

    const schoolName = "Easglesvale School";
    const schoolLogo =
      "https://www.eaglesvale.ac.zw/wp-content/uploads/2023/12/Copy-of-Eaglesvale-Logo-FULL-COLOUR.png";
    const supportEmail = "support@schoolrun.co.zw";

    const confirmHtml = passwordResetConfirmationTemplate({
      fullname: user.fullname || "User",
      schoolName: schoolName,
      schoolLogo: schoolLogo,
      portalUrl: portalUrl,
      supportEmail: supportEmail,
    });

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Confirmation",
        html: confirmHtml,
      });
    } catch (error) {
      console.error("Failed to send confirmation email:", emailError);
    }

    await logAudit({
      userId: user.id,
      action: "password_reset",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role?.name,
        ip: userIp,
        userAgent: userAgent,
        deviceInfo: deviceInfo,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      message: "Server error: Please try again later.",
    });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        valid: false,
        message: "Token and email are required",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      where: {
        email: email,
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        valid: false,
        message: "Invalid or expired token",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        valid: false,
        message: "Account is deactivated",
      });
    }

    return res.status(200).json({
      valid: true,
      message: "Token is valid",
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({
      valid: false,
      message: "Server Error",
    });
  }
};

const sendEmailVerificationOTP = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(404).json({
        message: "Invalid email",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is deactivated",
      });
    }

    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`,
      });
    }

    const { otp, expiresAt } = generateOTPWithExpiry(10);
    const hashedOtp = hashOTP(otp);

    user.emailVerificationOTP = hashedOtp;
    user.emailVerificationOTPExpires = expiresAt;
    user.emailVerificationOTPAttempts = 0;
    await user.save();

    const schoolName = "SchoolRun";
    const schoolLogo = "https://schoolrun.sonichub.co.zw/logo2.jpeg";
    const supportEmail = "support@schoolrun.co.zw";

    const emailHtml = emailVerificationTemplate({
      fullname: user.fullname || "User",
      otp: otp,
      expiryMinutes: 10,
      schoolName: schoolName,
      schoolLogo: schoolLogo,
      supportEmail: supportEmail,
    });

    await sendEmail({
      to: user.email,
      subject: "Email Verification Code",
      html: emailHtml,
    });

    await logAudit({
      userId: user.id,
      action: "send_email_verification_otp",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role?.name,
        ip: userIp,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Verification code sent to your email",
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Please try again later",
    });
  }
};

const verifyEmailOTP = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  const MAX_OTP_ATTEMPTS = 5;

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Invalid OTP format. Please enter a 6-digit code.",
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "Email is already verified",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    const lockStatus = user.getAccountLockStatus();
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`,
      });
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      return res.status(400).json({
        message: "No verification code found. Please request a new one.",
      });
    }

    if (isOTPExpired(user.emailVerificationOTPExpires)) {
      return res.status(400).json({
        message: "Verification code has expired. Please request a new one.",
      });
    }

    const remainingAttempts = getRemainingOTPAttempts(
      user.emailVerificationOTPAttempts,
      MAX_OTP_ATTEMPTS,
    );

    if (remainingAttempts <= 0) {
      // Generate new OTP automatically when attempts are exhausted
      const { otp: newOTP, expiresAt: newExpiresAt } =
        generateOTPWithExpiry(10);
      const hashedNewOTP = hashOTP(newOTP);

      user.emailVerificationOTP = hashedNewOTP;
      user.emailVerificationOTPExpires = newExpiresAt;
      user.emailVerificationOTPAttempts = 0;
      await user.save();

      // Send new OTP via email
      try {
        const schoolName = "SchoolRun";
        const schoolLogo = "https://schoolrun.sonichub.co.zw/logo2.jpeg";
        const supportEmail = "support@schoolrun.co.zw";

        const emailHtml = emailVerificationTemplate({
          fullname: user.fullname || "User",
          otp: newOTP,
          expiryMinutes: 10,
          schoolName: schoolName,
          schoolLogo: schoolLogo,
          supportEmail: supportEmail,
        });

        await sendEmail({
          to: user.email,
          subject: "New Verification Code",
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send new OTP email:", emailError);
      }
      return res.status(400).json({
        message:
          "Too many failed attempts. A new verification code has been sent to your email.",
      });
    }

    const isValid = verifyOTP(otp, user.emailVerificationOTP);

    if (!isValid) {
      user.emailVerificationOTPAttempts += 1;
      await user.save();

      const newRemainingAttempts = getRemainingOTPAttempts(
        user.emailVerificationOTPAttempts,
        MAX_OTP_ATTEMPTS,
      );

      return res.status(400).json({
        message: `Invalid verification code. ${newRemainingAttempts} attempt${newRemainingAttempts !== 1 ? "s" : ""} remaining.`,
        remainingAttempts: newRemainingAttempts,
      });
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpires = null;
    user.emailVerificationOTPAttempts = 0;
    await user.save();

    await logAudit({
      userId: user.id,
      action: "email_verified",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role?.name,
        ip: userIp,
        userAgent: userAgent,
        verifiedAt: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "Email verified successfully!",
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        role: user.role?.name,
        isVerified: user.isVerified,
        verifiedAt: user.verifiedAt,
      },
    });
  } catch (error) {
    console.error("verifyEmailOTP error:", error);
    return res.status(500).json({
      message: "Server error: Please try again later",
    });
  }
};

const resendEmailVerificationOTP = async (req, res) => {
  const userIp = requestIp.getClientIp(req);
  const userAgent = req.get("User-Agent");
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if email is already verified
    if (user.isVerified) {
      return res.status(400).json({
        message: "Email is already verified",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    // Generate new OTP
    const { otp, expiresAt } = generateOTPWithExpiry(10);
    const hashedOTP = hashOTP(otp);

    user.emailVerificationOTP = hashedOTP;
    user.emailVerificationOTPExpires = expiresAt;
    user.emailVerificationOTPAttempts = 0;
    await user.save();

    // Send OTP via email
    const schoolName = "SchoolRun";
    const schoolLogo = "https://schoolrun.sonichub.co.zw/logo2.jpeg";
    const supportEmail = "support@schoolrun.co.zw";

    const emailHtml = emailVerificationTemplate({
      fullname: user.fullname || "User",
      otp: otp,
      expiryMinutes: 10,
      schoolName: schoolName,
      schoolLogo: schoolLogo,
      supportEmail: supportEmail,
    });

    await sendEmail({
      to: user.email,
      subject: "New Verification Code",
      html: emailHtml,
    });

    await logAudit({
      userId: user.id,
      action: "resend_email_verification_code",
      entity: "Auth",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role?.name,
        ip: userIp,
        userAgent: userAgent,
        verifiedAt: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      message: "A new verification code has been sent to your email",
      expiresIn: 600,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error: Please try again later",
    });
  }
};

const checkEmailVerification = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      isVerified: user.isVerified,
      verifiedAt: user.verifiedAt,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getOTPStatus = async (req, res) => {
  const MAX_OTP_ATTEMPTS = 5;

  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const hasOTP = !!user.emailVerificationOTP;
    const isExpired = hasOTP && isOTPExpired(user.emailVerificationOTPExpires);
    const remainingAttempts = getRemainingOTPAttempts(
      user.emailVerificationOTPAttempts,
      MAX_OTP_ATTEMPTS,
    );
let roleDetails = null;
if (user.role?.name === "guardian") {
  roleDetails = await db.guardians.findOne({ where: { userId: user.id } });
}
return res.status(200).json({
  user: {
    id: user.id,
    email: user.email,
    fullname: user.fullname,
    role: user.role?.name,
    isVerified: user.isVerified,
    isSubscribed: roleDetails?.isSubscribed ?? null, // null = n/a (e.g. drivers)
  },
});
  } catch (error) {
    console.error("getOTPStatus error:", error);
    return res.status(500).json({
      message: "Server error: Please try again later",
    });
  }
};
module.exports = {
  login,
  signUp,
  unLockAccount,
  unlockAllLockedAccounts,
  getLockedAccounts,
  getAccountStatus,
  refreshAccessToken,
  Logout,
  changePassword,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  validateResetToken,
  sendEmailVerificationOTP,
  verifyEmailOTP,
  resendEmailVerificationOTP,
  checkEmailVerification,
  getOTPStatus,
};
