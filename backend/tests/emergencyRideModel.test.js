const test = require("node:test");
const assert = require("node:assert/strict");
const Sequelize = require("sequelize");
const createEmergencyRide = require("../models/emergencyRides");

const sequelize = new Sequelize.Sequelize("mysql://user:password@localhost/database", {
  logging: false,
});
const EmergencyRide = createEmergencyRide(sequelize, Sequelize.DataTypes);

test("defines the EmergencyRide schema and lifecycle statuses", () => {
  assert.equal(EmergencyRide.tableName, "emergencyrides");
  assert.equal(EmergencyRide.options.timestamps, true);

  for (const field of [
    "guardianId",
    "studentId",
    "driverId",
    "originalDriverId",
    "vehicleId",
    "routeId",
    "pickupAddress",
    "destinationAddress",
    "requestedPickupTime",
    "emergencyReason",
    "offeredPrice",
    "finalPrice",
    "requestedAt",
    "completedAt",
    "cancelledAt",
  ]) {
    assert.ok(EmergencyRide.rawAttributes[field], `${field} should exist`);
  }

  assert.deepEqual(EmergencyRide.rawAttributes.status.values, [
    "REQUESTED",
    "SEARCHING",
    "DRIVER_SELECTED",
    "DRIVER_ACCEPTED",
    "DRIVER_ARRIVING",
    "STUDENT_PICKED_UP",
    "IN_TRANSIT",
    "STUDENT_DROPPED_OFF",
    "COMPLETED",
    "CANCELLED",
    "DRIVER_REJECTED",
    "EXPIRED",
    "NO_DRIVER_AVAILABLE",
  ]);
});

test.after(() => sequelize.close());
