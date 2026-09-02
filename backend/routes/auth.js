const express = require("express");
const router = express.Router();
const { passport, requireRole } = require("../config/passport");
const {
  login,
  Logout,
  changePassword,
  refreshAccessToken,
  getCurrentUser,
  getAccountStatus,
  getLockedAccounts,
  unLockAccount,
  unlockAllLockedAccounts,
  forgotPassword,
  resetPassword,
  validateResetToken,
  signUp,
  sendEmailVerificationOTP,
  verifyEmailOTP,
  resendEmailVerificationOTP,
  checkEmailVerification,
  getOTPStatus,
} = require("../controllers/authController");
const passwordChangeRateLimiter = require("../middleware/passwordChangeLimiter");

router.post("/signup", signUp);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", Logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/validate-reset-token", validateResetToken);
router.patch(
  "/change-password",
  passport.authenticate("jwt", { session: false }),
  passwordChangeRateLimiter,
  changePassword,
);

router.post("/send-verification-otp", sendEmailVerificationOTP);
router.post("/verify-email-otp", verifyEmailOTP);
router.post("/resend-verification-otp", resendEmailVerificationOTP);
router.get("/check-email-verification/:email", checkEmailVerification);
router.get("/otp-status/:email", getOTPStatus);

router.get(
  "/locked-accounts",
  passport.authenticate("jwt", { session: false }),
  requireRole(["super-admin", "admin"]),
  getLockedAccounts,
);

router.post(
  "/unlock-account/:userId",
  passport.authenticate("jwt", { session: false }),
  requireRole(["super-admin", "admin"]),
  unLockAccount,
);

router.post(
  "/unlock-all-accounts",
  passport.authenticate("jwt", { session: false }),
  requireRole(["super-admin", "admin"]),
  unlockAllLockedAccounts,
);

router.get(
  "/account-status",
  passport.authenticate("jwt", { session: false }),
  getAccountStatus,
);
router.get(
  "/me",
  passport.authenticate("jwt", { session: false }),
  getCurrentUser,
);

module.exports = router;
