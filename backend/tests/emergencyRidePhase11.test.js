const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EMERGENCY_RIDE_SOCKET_EVENTS,
  canAccessEmergencyRideRoom,
  buildEmergencyRideNotification,
  buildEmergencyRideSocketPayload,
} = require("../controllers/emergencyRideController");

test("Phase 11 exposes the expected emergency ride socket events", () => {
  assert.ok(Array.isArray(EMERGENCY_RIDE_SOCKET_EVENTS));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-requested"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-driver-selected"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-accepted"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-rejected"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-driver-arriving"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-student-picked-up"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-started"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-location-update"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-student-dropped-off"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-completed"));
  assert.ok(EMERGENCY_RIDE_SOCKET_EVENTS.includes("emergency-ride-cancelled"));
});

test("guardian can access their emergency ride room", () => {
  const ride = { id: "ride-123", guardianId: "guardian-1", driverId: "driver-1" };
  const result = canAccessEmergencyRideRoom(ride, "guardian-user-1", "guardian");
  assert.equal(result, true);
});

test("assigned driver can access their emergency ride room", () => {
  const ride = { id: "ride-123", guardianId: "guardian-1", driverId: "driver-1" };
  const result = canAccessEmergencyRideRoom(ride, "driver-user-1", "driver", "driver-1");
  assert.equal(result, true);
});

test("unauthorized user cannot access an emergency ride room", () => {
  const ride = { id: "ride-123", guardianId: "guardian-1", driverId: "driver-1" };
  const result = canAccessEmergencyRideRoom(ride, "other-user", "guardian", "other-driver");
  assert.equal(result, false);
});

test("notification payload includes the expected emergency ride metadata", () => {
  const ride = {
    id: "ride-123",
    guardianId: "guardian-1",
    driverId: "driver-1",
    studentId: "student-1",
    status: "DRIVER_ACCEPTED",
  };

  const outcome = buildEmergencyRideNotification("emergency-ride-accepted", ride, {
    approvedBy: "driver",
    etaMinutes: 8,
  });

  assert.equal(outcome.title, "Emergency Ride Update");
  assert.ok(outcome.message.includes("accepted"));
  assert.equal(outcome.notifType, "info");
  assert.equal(outcome.entityType, "emergency_ride");
  assert.equal(outcome.entityId, "ride-123");
  assert.equal(outcome.metadata.status, "DRIVER_ACCEPTED");
  assert.equal(outcome.metadata.driverId, "driver-1");
  assert.equal(outcome.metadata.etaMinutes, 8);
});

test("socket payload is emitted with ride id and status metadata", () => {
  const ride = {
    id: "ride-123",
    guardianId: "guardian-1",
    driverId: "driver-1",
    studentId: "student-1",
    status: "STUDENT_PICKED_UP",
  };

  const payload = buildEmergencyRideSocketPayload("emergency-student-picked-up", ride, {
    latitude: -26.2,
    longitude: 28.04,
  });

  assert.equal(payload.event, "emergency-student-picked-up");
  assert.equal(payload.rideId, "ride-123");
  assert.equal(payload.status, "STUDENT_PICKED_UP");
  assert.equal(payload.location.latitude, -26.2);
  assert.equal(payload.location.longitude, 28.04);
});
