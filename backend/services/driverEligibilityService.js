const db = require("../models/index");

const Driver = db.drivers;
const User = db.users;
const Vehicle = db.vehicles;
const Role = db.role;

const getDriverEligibility = async (driverId) => {
  const driver = await Driver.findByPk(driverId, {
    include: [
      {
        model: User,
        as: "user",
        include: [{ model: Role, as: "role" }],
      },
    ],
  });

  if (!driver) {
    return null;
  }

  const vehicle = await Vehicle.findOne({
    where: { driverId: driver.id },
    order: [["createdAt", "DESC"]],
  });

  const insuranceCurrent = Boolean(
    vehicle?.insuranceExpiry && new Date(vehicle.insuranceExpiry) > new Date(),
  );

  const requirements = {
    activeAccount: driver.user?.isActive === true,
    identityVerified: driver.identityVerified === true,
    licenseVerified: driver.licenseVerified === true,
    vehicleVerified: vehicle?.vehicleVerified === true,
    insuranceVerified:
      vehicle?.insuranceVerified === true && insuranceCurrent,
    administratorApproval: driver.emergencyRideEnabled === true,
  };

  return {
    driver,
    vehicle,
    requirements,
    eligible: Object.values(requirements).every(Boolean),
  };
};

const setEmergencyRideEligibility = async (driverId, enabled) => {
  const eligibility = await getDriverEligibility(driverId);

  if (!eligibility) {
    return null;
  }

  if (enabled && !Object.entries(eligibility.requirements)
    .filter(([name]) => name !== "administratorApproval")
    .every(([, satisfied]) => satisfied)) {
    const error = new Error(
      "Driver has not satisfied all verification requirements.",
    );
    error.code = "DRIVER_NOT_VERIFIED";
    error.requirements = eligibility.requirements;
    throw error;
  }

  eligibility.driver.emergencyRideEnabled = enabled;
  await eligibility.driver.save();
  return getDriverEligibility(driverId);
};

module.exports = { getDriverEligibility, setEmergencyRideEligibility };
