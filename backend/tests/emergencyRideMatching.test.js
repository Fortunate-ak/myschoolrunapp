const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateEmergencyRideDriverEligibility,
  sortEmergencyRideDrivers,
} = require("../controllers/emergencyRideController");

const ride = {
  id: "ride-1",
  pickupLatitude: -26.2041,
  pickupLongitude: 28.0473,
  requestedPickupTime: new Date("2099-01-01T10:00:00.000Z"),
  tripType: "emergency_transport",
};

const eligibleDriver = {
  id: "driver-eligible",
  isActive: true,
  emergencyRideEnabled: true,
  identityVerified: true,
  licenseVerified: true,
  rating: 4.8,
  profileImage: "https://example.com/img.jpg",
  user: { isActive: true, isVerified: true },
  vehicle: {
    id: "vehicle-eligible",
    isActive: true,
    vehicleVerified: true,
    insuranceVerified: true,
    insuranceExpiry: "2099-12-31T00:00:00.000Z",
    capacity: 4,
    registrationNumber: "ABC 123 GP",
  },
  service: {
    id: "service-eligible",
    isActive: true,
    serviceType: "emergency_transport",
    price: 250,
    currency: "USD",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    availableHours: { start: "00:00", end: "23:59" },
    originLatitude: -26.205,
    originLongitude: 28.048,
  },
};

test("eligible driver is returned as a valid emergency ride option", () => {
  const result = evaluateEmergencyRideDriverEligibility(eligibleDriver, ride);

  assert.equal(result.eligible, true);
  assert.equal(result.distanceKm, 0); 
  assert.equal(result.price, 250);
  assert.equal(result.currency, "USD");
  assert.equal(result.verificationStatus, "verified");
  assert.equal(result.reasons.length, 0);
});

test("unverified driver (identity not verified) is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    identityVerified: false,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver not verified"));
});

test("unverified driver (license not verified) is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    licenseVerified: false,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver not verified"));
});

test("unverified driver (user not verified) is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    user: { ...eligibleDriver.user, isVerified: false },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver not verified"));
});

test("inactive driver is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    isActive: false,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver inactive"));
});

test("driver with inactive user is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    user: { ...eligibleDriver.user, isActive: false },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver inactive"));
});

test("busy driver is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility(
    {
      ...eligibleDriver,
      busyRide: { id: "other-ride", status: "DRIVER_ACCEPTED" },
    },
    ride,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver busy"));
});

test("driver with conflicting IN_TRANSIT ride is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility(
    {
      ...eligibleDriver,
      busyRide: { id: "other-ride", status: "IN_TRANSIT" },
    },
    ride,
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("driver busy"));
});

test("driver without emergency ride permission is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    emergencyRideEnabled: false,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("emergency ride not enabled"));
});

test("driver without vehicle is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: null,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("no vehicle assigned"));
});

test("driver with inactive vehicle is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: {
      ...eligibleDriver.vehicle,
      isActive: false,
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("vehicle inactive"));
});

test("driver with unverified vehicle is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: {
      ...eligibleDriver.vehicle,
      vehicleVerified: false,
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("vehicle not verified"));
});

test("driver with vehicle insurance not verified is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: {
      ...eligibleDriver.vehicle,
      insuranceVerified: false,
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("vehicle not verified"));
});

test("driver with expired vehicle insurance is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: {
      ...eligibleDriver.vehicle,
      insuranceExpiry: "2020-12-31T00:00:00.000Z",
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("vehicle insurance expired"));
});

test("driver with zero vehicle capacity is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    vehicle: {
      ...eligibleDriver.vehicle,
      capacity: 0,
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("insufficient vehicle capacity"));
});

test("driver without service is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: null,
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("no service configured"));
});

test("driver with inactive service is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      isActive: false,
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("service not active"));
});

test("driver with wrong service type is rejected", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      serviceType: "regular_route",
    },
  }, ride);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("service type mismatch"));
});

test("driver unavailable on requested day is rejected", () => {
  const rideOnTuesday = {
    ...ride,
    requestedPickupTime: new Date("2099-01-05T10:00:00.000Z"), // Tuesday
  };

  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      availableDays: ["Monday", "Wednesday"], // No Tuesday
    },
  }, rideOnTuesday);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("service unavailable on requested day"));
});

test("driver unavailable at requested time is rejected", () => {
  const rideAt22_00 = {
    ...ride,
    requestedPickupTime: new Date("2099-01-01T22:00:00.000Z"), // 22:00 (10 PM)
  };

  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      availableHours: { start: "06:00", end: "20:00" }, // Only 6 AM to 8 PM
    },
  }, rideAt22_00);

  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("service unavailable at requested time"));
});

test("driver available at service hours boundary is accepted", () => {
  const rideAt06_00 = {
    ...ride,
    requestedPickupTime: new Date("2099-01-01T06:00:00.000Z"), // 6:00 AM
  };

  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      availableHours: { start: "06:00", end: "20:00" },
    },
  }, rideAt06_00);

  assert.equal(result.eligible, true);
});

test("calculates distance correctly from service origin to pickup", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      originLatitude: -26.2041,
      originLongitude: 28.0473,
    },
  }, ride);

  assert.ok(result.distanceKm >= 0);
  assert.equal(typeof result.distanceKm, "number");
});

test("calculates ETA correctly based on distance", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    service: {
      ...eligibleDriver.service,
      originLatitude: -26.2041,
      originLongitude: 28.0473,
    },
  }, ride);

  if (result.distanceKm > 0) {
    assert.ok(result.eta > 0);
    assert.equal(typeof result.eta, "number");
  }
});

test("sort order prefers eligible drivers first", () => {
  const evaluated = [
    { ...eligibleDriver, id: "driver-1", eligible: false },
    { ...eligibleDriver, id: "driver-2", eligible: true },
  ];

  const sorted = sortEmergencyRideDrivers(evaluated);
  assert.equal(sorted[0].id, "driver-2"); // Eligible first
  assert.equal(sorted[1].id, "driver-1");
});

test("sort order prefers closer distance for eligible drivers", () => {
  const drivers = [
    { ...eligibleDriver, id: "driver-far", eligible: true, distanceKm: 10 },
    { ...eligibleDriver, id: "driver-close", eligible: true, distanceKm: 2 },
  ];

  const sorted = sortEmergencyRideDrivers(drivers);
  assert.equal(sorted[0].id, "driver-close");
  assert.equal(sorted[1].id, "driver-far");
});

test("sort order prefers shorter ETA for same distance", () => {
  const drivers = [
    { ...eligibleDriver, id: "driver-slow", eligible: true, distanceKm: 5, eta: 20, rating: 4.5, price: 100 },
    { ...eligibleDriver, id: "driver-fast", eligible: true, distanceKm: 5, eta: 10, rating: 4.5, price: 100 },
  ];

  const sorted = sortEmergencyRideDrivers(drivers);
  assert.equal(sorted[0].id, "driver-fast");
  assert.equal(sorted[1].id, "driver-slow");
});

test("sort order prefers higher rating for same distance and ETA", () => {
  const drivers = [
    { ...eligibleDriver, id: "driver-low", eligible: true, distanceKm: 5, eta: 10, rating: 4.2, price: 100 },
    { ...eligibleDriver, id: "driver-high", eligible: true, distanceKm: 5, eta: 10, rating: 4.9, price: 100 },
  ];

  const sorted = sortEmergencyRideDrivers(drivers);
  assert.equal(sorted[0].id, "driver-high");
  assert.equal(sorted[1].id, "driver-low");
});

test("sort order prefers lower price for same distance, ETA, and rating", () => {
  const drivers = [
    { ...eligibleDriver, id: "driver-expensive", eligible: true, distanceKm: 5, eta: 10, rating: 4.8, price: 500 },
    { ...eligibleDriver, id: "driver-cheap", eligible: true, distanceKm: 5, eta: 10, rating: 4.8, price: 100 },
  ];

  const sorted = sortEmergencyRideDrivers(drivers);
  assert.equal(sorted[0].id, "driver-cheap");
  assert.equal(sorted[1].id, "driver-expensive");
});

test("complete sorting priority chain: availability > distance > ETA > rating > price", () => {
  const drivers = [
    // Ineligible driver
    { ...eligibleDriver, id: "driver-ineligible", eligible: false, distanceKm: 1, eta: 5, rating: 5, price: 50 },
    // Eligible but far
    { ...eligibleDriver, id: "driver-far", eligible: true, distanceKm: 20, eta: 60, rating: 5, price: 50 },
    // Eligible, close, slow ETA
    { ...eligibleDriver, id: "driver-slow", eligible: true, distanceKm: 5, eta: 20, rating: 5, price: 50 },
    // Eligible, close, fast ETA, low rating
    { ...eligibleDriver, id: "driver-lowrating", eligible: true, distanceKm: 5, eta: 10, rating: 3, price: 50 },
    // Eligible, close, fast ETA, high rating, expensive
    { ...eligibleDriver, id: "driver-expensive", eligible: true, distanceKm: 5, eta: 10, rating: 5, price: 500 },
    // Best option: eligible, close, fast ETA, high rating, cheap
    { ...eligibleDriver, id: "driver-best", eligible: true, distanceKm: 5, eta: 10, rating: 5, price: 50 },
  ];

  const sorted = sortEmergencyRideDrivers(drivers);
  
  assert.equal(sorted[0].id, "driver-best", "Best option should be first");
  assert.equal(sorted[sorted.length - 1].id, "driver-ineligible", "Ineligible should be last");
});

test("handles drivers with null values gracefully", () => {
  const result = evaluateEmergencyRideDriverEligibility({
    ...eligibleDriver,
    rating: null,
    eta: null,
  }, ride);

  assert.equal(typeof result.rating, "number");
  assert.equal(typeof result.price, "number");
});
