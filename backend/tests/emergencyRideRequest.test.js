const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateRequest,
  ACTIVE_STATUSES,
  CANCELLABLE_STATUSES,
} = require("../controllers/emergencyRideController");

const validRequest = {
  studentId: "student-id",
  pickupAddress: "School",
  pickupLatitude: -26.2041,
  pickupLongitude: 28.0473,
  destinationAddress: "Home",
  destinationLatitude: -26.15,
  destinationLongitude: 28.05,
  tripType: "emergency_alternative",
  requestedPickupTime: "2099-01-01T10:00:00.000Z",
  emergencyReason: "Normal driver unavailable",
};

test("accepts a valid guardian request payload", () => {
  assert.deepEqual(validateRequest(validRequest), {});
});

test("rejects invalid student and pickup data", () => {
  const errors = validateRequest({
    ...validRequest,
    studentId: "",
    pickupLatitude: 91,
    pickupLongitude: -181,
    requestedPickupTime: "invalid-date",
  });

  assert.equal(errors.studentId, "is required");
  assert.equal(errors.pickupLatitude, "must be a valid coordinate");
  assert.equal(errors.pickupLongitude, "must be a valid coordinate");
  assert.equal(errors.requestedPickupTime, "must be a valid date");
});

test("identifies active rides and cancellable statuses", () => {
  assert.ok(ACTIVE_STATUSES.includes("SEARCHING"));
  assert.ok(ACTIVE_STATUSES.includes("IN_TRANSIT"));
  assert.ok(CANCELLABLE_STATUSES.includes("DRIVER_ARRIVING"));
  assert.ok(!CANCELLABLE_STATUSES.includes("STUDENT_PICKED_UP"));
  assert.ok(!ACTIVE_STATUSES.includes("COMPLETED"));
});
