const test = require("node:test");
const assert = require("node:assert/strict");
const { validateServiceInput } = require("../services/driverServiceService");

const validService = {
  origin: "School",
  destination: "Home",
  originLatitude: -26.2041,
  originLongitude: 28.0473,
  destinationLatitude: -26.15,
  destinationLongitude: 28.05,
  serviceType: "emergency_transport",
  price: 150,
  currency: "USD",
  pricingType: "FIXED",
  availableDays: ["Monday"],
  availableHours: { start: "08:00", end: "17:00" },
  isActive: false,
};

test("accepts a valid inactive FIXED service", () => {
  assert.deepEqual(validateServiceInput(validService), {});
});

test("rejects invalid coordinates and negative prices", () => {
  const errors = validateServiceInput({
    ...validService,
    originLatitude: 91,
    destinationLongitude: -181,
    price: -1,
  });

  assert.equal(errors.originLatitude, "must be a valid coordinate");
  assert.equal(errors.destinationLongitude, "must be a valid coordinate");
  assert.equal(errors.price, "must be a non-negative number");
});

test("requires activation to be explicitly true", () => {
  const errors = validateServiceInput(validService, { requireActive: true });
  assert.equal(errors.isActive, "must be true to activate a service");
});
