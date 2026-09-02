# Emergency Ride System - Testing Implementation Checklist

## Pre-Testing Setup

### Database Requirements
- [ ] Test database created with emergency ride schema
- [ ] Guardian test users created (with SUB_PRO plan)
- [ ] Driver test users created (with SUB_PRO plan)
- [ ] Student records linked to guardians
- [ ] Vehicles created and verified
- [ ] DriverService records with coordinates
- [ ] VehicleRoute records for driver services
- [ ] EmergencyRide table with all required fields

### Required Test Fixtures
```javascript
// Guardian fixtures
guardians = [
  { id: "guard-1", firstName: "John", email: "g1@test.com", subscriptionPlan: "SUB_PRO" },
  { id: "guard-2", firstName: "Jane", email: "g2@test.com", subscriptionPlan: "SUB_PRO" }
]

// Student fixtures
students = [
  { id: "student-1", guardianId: "guard-1", firstName: "Alice" },
  { id: "student-2", guardianId: "guard-2", firstName: "Bob" }
]

// Driver fixtures
drivers = [
  { 
    id: "driver-1", userId: "user-1", firstName: "Tom", 
    isActive: true, isVerified: true, emergencyRideEnabled: true,
    rating: 4.8, completedRides: 150
  },
  { 
    id: "driver-2", userId: "user-2", firstName: "Sarah", 
    isActive: true, isVerified: true, emergencyRideEnabled: true,
    rating: 4.5, completedRides: 89
  }
]

// Vehicle fixtures
vehicles = [
  {
    id: "vehicle-1", driverId: "driver-1", 
    make: "Toyota", model: "Hiace", 
    isActive: true, isVerified: true, insured: true,
    capacity: 7
  }
]

// DriverService fixtures
services = [
  {
    id: "service-1", driverId: "driver-1",
    latitude: -26.2041, longitude: 28.0473,
    serviceDay: "Monday", startTime: "06:00", endTime: "18:00",
    emergencyEnabled: true
  }
]
```

---

## PHASE 7: Driver Discovery - Unit Tests

### GET /available-drivers Tests
- [ ] ✅ Haversine distance calculation (exact values)
- [ ] ✅ Driver eligibility evaluation (all 15 criteria)
- [ ] ✅ Sorting by distance, ETA, rating
- [ ] ✅ Filtering out inactive drivers
- [ ] ✅ Filtering out unverified drivers
- [ ] ✅ Filtering out drivers without emergency permission
- [ ] ✅ Filtering by service availability (day/time)
- [ ] ✅ Handling no eligible drivers scenario
- [ ] ✅ Response includes distance, ETA, price
- [ ] ✅ Ineligible drivers excluded from results

### Eligibility Checks (15 criteria)
- [ ] ✅ Driver isActive = true
- [ ] ✅ Driver identity verified
- [ ] ✅ Driver license verified
- [ ] ✅ emergencyRideEnabled = true
- [ ] ✅ Vehicle isActive = true
- [ ] ✅ Vehicle identity verified
- [ ] ✅ Vehicle insurance valid
- [ ] ✅ Driver has no STUDENT_PICKED_UP rides
- [ ] ✅ Driver has no IN_TRANSIT rides
- [ ] ✅ Driver service available (correct day/time)
- [ ] ✅ Vehicle capacity sufficient
- [ ] ✅ Service route exists
- [ ] ✅ Pickup within service area
- [ ] ✅ Destination within service area
- [ ] ✅ No conflicts with student assignments

---

## PHASE 8: Driver Selection - Integration Tests

### POST /select-driver Tests
- [ ] ✅ Guardian authenticates with JWT
- [ ] ✅ Guardian can only select from available-drivers list
- [ ] ✅ Re-validation happens (driver still eligible)
- [ ] ✅ Price locked on ride (stored as finalPrice)
- [ ] ✅ Status changes: SEARCHING → DRIVER_SELECTED
- [ ] ✅ driverId assigned to ride
- [ ] ✅ vehicleId assigned to ride
- [ ] ✅ Audit log created: "emergency_ride_driver_selected"
- [ ] ✅ Transaction rolls back on validation error
- [ ] ✅ Ride locked to prevent concurrent selection

### Re-Validation Tests (CRITICAL)
- [ ] ✅ Driver still active (might have gone offline)
- [ ] ✅ Driver still has emergency enabled
- [ ] ✅ Driver still verified
- [ ] ✅ Vehicle still active and verified
- [ ] ✅ No conflicts with new rides added since discovery
- [ ] ✅ Price not changed

### Error Cases
- [ ] ✅ 401: Not authenticated
- [ ] ✅ 403: Guardian role required / PRO required
- [ ] ✅ 404: Ride not found
- [ ] ✅ 409: Driver no longer eligible
- [ ] ✅ 409: Driver already assigned to another ride

### Concurrency Protection
- [ ] ✅ Two simultaneous selects → one succeeds, one fails
- [ ] ✅ Driver cannot be double-booked
- [ ] ✅ Lock prevents race condition

---

## PHASE 9: Driver Accept/Reject - Unit Tests

### POST /accept Tests
- [ ] ✅ Driver authenticates with JWT
- [ ] ✅ Driver can only accept their assigned ride
- [ ] ✅ Status changes: DRIVER_SELECTED → DRIVER_ACCEPTED
- [ ] ✅ acceptedAt timestamp recorded
- [ ] ✅ Audit log created: "emergency_ride_accepted"

### Accept Validation
- [ ] ✅ Driver isActive = true
- [ ] ✅ Driver identity verified
- [ ] ✅ Driver license verified
- [ ] ✅ emergencyRideEnabled = true
- [ ] ✅ Ride in DRIVER_SELECTED status
- [ ] ✅ Driver is assigned to ride

### Accept Error Cases
- [ ] ✅ 401: Not authenticated
- [ ] ✅ 403: Driver role required / no driver profile / PRO required
- [ ] ✅ 404: Ride not found / driver not assigned
- [ ] ✅ 409: Driver inactive / not verified / wrong status

### POST /reject Tests
- [ ] ✅ Driver rejects ride
- [ ] ✅ Status changes: DRIVER_SELECTED → DRIVER_REJECTED
- [ ] ✅ rejectedAt timestamp recorded
- [ ] ✅ rejectionReason stored (optional)
- [ ] ✅ driverId cleared
- [ ] ✅ vehicleId cleared
- [ ] ✅ finalPrice cleared
- [ ] ✅ Ride returns to SEARCHING state
- [ ] ✅ Audit log created: "emergency_ride_rejected"

### Reject Error Cases
- [ ] ✅ 401: Not authenticated
- [ ] ✅ 403: Driver role required / no driver profile / PRO required
- [ ] ✅ 404: Ride not found / driver not assigned
- [ ] ✅ 409: Driver inactive / wrong status

### Guardian Re-Selection After Rejection
- [ ] ✅ Guardian can call GET /available-drivers again
- [ ] ✅ Rejected driver excluded from new results
- [ ] ✅ Guardian can POST /select-driver with new driver
- [ ] ✅ Original ride continues

---

## PHASE 10: Trip Lifecycle - Integration Tests

### POST /arriving Tests
- [ ] ✅ Driver marks arrival at pickup
- [ ] ✅ Status changes: DRIVER_ACCEPTED → DRIVER_ARRIVING
- [ ] ✅ driverArrivedAt timestamp recorded
- [ ] ✅ Audit log created: "emergency_ride_driver_arriving"
- [ ] ✅ Only driver role allowed
- [ ] ✅ Only assigned driver can mark arriving

### Arriving Validation
- [ ] ✅ Ride in DRIVER_ACCEPTED status
- [ ] ✅ Driver is assigned to ride

### Arriving Error Cases
- [ ] ✅ 409: Wrong status / driver not assigned

### POST /pickup Tests
- [ ] ✅ Driver confirms student picked up
- [ ] ✅ Status changes: DRIVER_ARRIVING → STUDENT_PICKED_UP
- [ ] ✅ studentPickedUpAt timestamp recorded
- [ ] ✅ Audit log created: "emergency_ride_student_picked_up"

### Pickup Validation
- [ ] ✅ Ride in DRIVER_ARRIVING status

### Pickup Error Cases
- [ ] ✅ 409: Wrong status

### POST /start Tests
- [ ] ✅ Driver starts trip to destination
- [ ] ✅ Status changes: STUDENT_PICKED_UP → IN_TRANSIT
- [ ] ✅ tripStartedAt timestamp recorded
- [ ] ✅ Audit log created: "emergency_ride_trip_started"

### Start Validation
- [ ] ✅ Ride in STUDENT_PICKED_UP status

### Start Error Cases
- [ ] ✅ 409: Wrong status

### POST /complete Tests
- [ ] ✅ Driver marks trip complete
- [ ] ✅ Status changes: IN_TRANSIT → STUDENT_DROPPED_OFF → COMPLETED
- [ ] ✅ studentDroppedOffAt timestamp recorded
- [ ] ✅ completedAt timestamp recorded (same)
- [ ] ✅ Atomic transaction (both status changes or none)
- [ ] ✅ Audit log created: "emergency_ride_completed"

### **CRITICAL**: Student Assignment Test
- [ ] ✅ Student's permanent VehicleAssignment is NOT modified
- [ ] ✅ Student continues with normal driver after ride
- [ ] ✅ Emergency ride is temporary transportation only

### Complete Validation
- [ ] ✅ Ride in IN_TRANSIT status

### Complete Error Cases
- [ ] ✅ 404: Ride not found
- [ ] ✅ 409: Wrong status

### Complete Atomicity Test
- [ ] ✅ Both status updates occur together
- [ ] ✅ No partial completion (either both or neither)

---

## Status Transitions - Validation Tests

### VALID_TRANSITIONS Enforcement
- [ ] ✅ DRIVER_ACCEPTED → DRIVER_ARRIVING (allowed)
- [ ] ✅ DRIVER_ACCEPTED → IN_TRANSIT (rejected)
- [ ] ✅ DRIVER_ARRIVING → STUDENT_PICKED_UP (allowed)
- [ ] ✅ DRIVER_ARRIVING → IN_TRANSIT (rejected)
- [ ] ✅ STUDENT_PICKED_UP → IN_TRANSIT (allowed)
- [ ] ✅ STUDENT_PICKED_UP → COMPLETED (rejected)
- [ ] ✅ IN_TRANSIT → STUDENT_DROPPED_OFF (allowed)
- [ ] ✅ IN_TRANSIT → COMPLETED (rejected)
- [ ] ✅ STUDENT_DROPPED_OFF → COMPLETED (allowed)

### Full Lifecycle Path Test
- [ ] ✅ DRIVER_SELECTED → DRIVER_ACCEPTED → ARRIVING → PICKED_UP → TRANSIT → DROPPED_OFF → COMPLETED
- [ ] ✅ All transitions succeed in sequence

---

## Cancellation Tests

### Guardian Cancellation
- [ ] ✅ Can cancel in REQUESTED
- [ ] ✅ Can cancel in SEARCHING
- [ ] ✅ Can cancel in DRIVER_SELECTED
- [ ] ✅ Can cancel in DRIVER_ACCEPTED
- [ ] ✅ Can cancel in DRIVER_ARRIVING
- [ ] ✅ Cannot cancel in STUDENT_PICKED_UP
- [ ] ✅ Cannot cancel in IN_TRANSIT
- [ ] ✅ Cannot cancel in STUDENT_DROPPED_OFF
- [ ] ✅ Cannot cancel in COMPLETED

### Driver Cancellation
- [ ] ✅ Can cancel in DRIVER_SELECTED (before accepting)
- [ ] ✅ Cannot cancel in DRIVER_ACCEPTED
- [ ] ✅ Cannot cancel in any state after acceptance

### Cancellation Features
- [ ] ✅ Optional cancellationReason stored
- [ ] ✅ cancelledAt timestamp recorded
- [ ] ✅ Audit log indicates cancelledBy (guardian vs driver)
- [ ] ✅ Status changes to CANCELLED
- [ ] ✅ Driver freed up for other rides

### Cancellation Error Cases
- [ ] ✅ 403: No active profile / PRO required
- [ ] ✅ 404: Ride not found
- [ ] ✅ 409: Cannot cancel in current status

---

## Concurrency & Race Condition Tests

### Concurrent Accept
- [ ] ✅ Driver 1 and Driver 2 both POST /accept simultaneously
- [ ] ✅ First one succeeds (409 or success)
- [ ] ✅ Second one fails (409)
- [ ] ✅ Database lock prevents double acceptance
- [ ] ✅ No partial state

### Concurrent Selection
- [ ] ✅ Guardian 1 selects same driver as Guardian 2
- [ ] ✅ First selection succeeds
- [ ] ✅ Second selection fails (driver already assigned)
- [ ] ✅ Driver not double-booked

### Concurrent Status Updates
- [ ] ✅ Arriving and Pickup called simultaneously
- [ ] ✅ One succeeds, one fails due to status check
- [ ] ✅ Ride only advances one status

### Database Transaction Rollback
- [ ] ✅ Validation fails mid-transaction
- [ ] ✅ Transaction rolls back
- [ ] ✅ Database unchanged
- [ ] ✅ Error response returned

---

## Authorization & Authentication Tests

### JWT Authentication
- [ ] ✅ No token → 401
- [ ] ✅ Malformed token → 401
- [ ] ✅ Expired token → 401
- [ ] ✅ Invalid signature → 401
- [ ] ✅ Valid token → Proceeds

### Role-Based Access
- [ ] ✅ Guardian JWT on driver endpoint → 403
- [ ] ✅ Driver JWT on guardian endpoint → 403
- [ ] ✅ Correct role → Proceeds

### PRO Subscription Check
- [ ] ✅ Non-PRO user → 403
- [ ] ✅ PRO user → Proceeds

### Ownership Validation
- [ ] ✅ Guardian can only access own rides
- [ ] ✅ Driver can only access assigned rides
- [ ] ✅ Cross-user access → 403/404
- [ ] ✅ Cross-guardian access → 403/404
- [ ] ✅ Cross-driver access → 403/404

---

## Audit Logging Tests

### Audit Log Creation
- [ ] ✅ Accept creates audit log
- [ ] ✅ Reject creates audit log
- [ ] ✅ Arriving creates audit log
- [ ] ✅ Pickup creates audit log
- [ ] ✅ Start creates audit log
- [ ] ✅ Complete creates audit log
- [ ] ✅ Cancel creates audit log

### Audit Log Content
- [ ] ✅ Correct userId recorded
- [ ] ✅ Correct action name recorded
- [ ] ✅ Correct entity (EmergencyRide)
- [ ] ✅ Correct entityId (ride ID)
- [ ] ✅ Relevant metadata included (driverId, studentId, etc.)
- [ ] ✅ Timestamp accurate
- [ ] ✅ Cancel reason logged (if provided)
- [ ] ✅ cancelledBy indicator present

---

## Error Handling Tests

### Missing Resources
- [ ] ✅ Non-existent ride → 404
- [ ] ✅ Non-existent driver → 404
- [ ] ✅ Non-existent guardian → 404

### Malformed Requests
- [ ] ✅ Missing required fields → 400
- [ ] ✅ Invalid field types → 400
- [ ] ✅ Invalid JSON → 400

### Database Errors
- [ ] ✅ Connection error → 500
- [ ] ✅ Transaction failure → 500 + rollback
- [ ] ✅ Integrity constraint → 400/409

### Invalid State Transitions
- [ ] ✅ Wrong status → 409
- [ ] ✅ Invalid transition → 409
- [ ] ✅ Skipped step → 409

### Concurrent Conflicts
- [ ] ✅ Double-booking → 409
- [ ] ✅ Double-accept → 409
- [ ] ✅ Race condition → 409 to second caller

---

## Timestamp Tests

### Timestamp Recording
- [ ] ✅ acceptedAt recorded when accepted
- [ ] ✅ rejectedAt recorded when rejected
- [ ] ✅ driverArrivedAt recorded when arriving
- [ ] ✅ studentPickedUpAt recorded when picked up
- [ ] ✅ tripStartedAt recorded when started
- [ ] ✅ studentDroppedOffAt recorded when dropped off
- [ ] ✅ completedAt recorded when completed
- [ ] ✅ cancelledAt recorded when cancelled

### Timestamp Accuracy
- [ ] ✅ Timestamps in ISO format
- [ ] ✅ Timestamps within 1 second of request
- [ ] ✅ Timestamps in UTC/server timezone
- [ ] ✅ Timestamps preserved across queries

### Timestamp Ordering
- [ ] ✅ acceptedAt before arrivedAt
- [ ] ✅ arrivedAt before pickedUpAt
- [ ] ✅ pickedUpAt before startedAt
- [ ] ✅ startedAt before completedAt

---

## Performance Tests

### Response Time
- [ ] ✅ GET /available-drivers: < 500ms
- [ ] ✅ POST /select-driver: < 200ms
- [ ] ✅ POST /accept: < 200ms
- [ ] ✅ POST /arriving: < 200ms
- [ ] ✅ POST /complete: < 200ms

### Database Queries
- [ ] ✅ Single ride fetch (not N+1)
- [ ] ✅ Efficient driver lookup
- [ ] ✅ Indexes used (query plan analyzed)
- [ ] ✅ No unnecessary includes

### Scalability
- [ ] ✅ 100 concurrent requests handled
- [ ] ✅ 1000 rides in database processed
- [ ] ✅ Lock contention minimal
- [ ] ✅ No memory leaks

---

## Data Consistency Tests

### ACID Compliance
- [ ] ✅ Atomicity: All or nothing
- [ ] ✅ Consistency: VALID_TRANSITIONS enforced
- [ ] ✅ Isolation: Concurrent transactions isolated
- [ ] ✅ Durability: Data persists after commit

### Ride State Integrity
- [ ] ✅ driverId set when DRIVER_SELECTED
- [ ] ✅ driverId cleared when DRIVER_REJECTED
- [ ] ✅ driverId not cleared when DRIVER_ACCEPTED
- [ ] ✅ finalPrice locked when DRIVER_SELECTED
- [ ] ✅ All required fields populated

### Cross-Table Consistency
- [ ] ✅ Driver exists when assigned
- [ ] ✅ Vehicle exists when assigned
- [ ] ✅ Student exists
- [ ] ✅ Guardian exists
- [ ] ✅ No orphaned records

---

## Integration Test Setup Code

### Test Database Seed
```javascript
// Seed test data
async function seedTestData() {
  // Create guardians
  const guard1 = await Guardian.create({...});
  
  // Create students
  const student1 = await Student.create({...});
  
  // Create drivers
  const driver1 = await Driver.create({...});
  
  // Create vehicles
  const vehicle1 = await Vehicle.create({...});
  
  // Create services
  const service1 = await DriverService.create({...});
  
  // Create ride
  const ride = await EmergencyRide.create({
    guardianId: guard1.id,
    studentId: student1.id,
    status: "SEARCHING",
    ...
  });
  
  return { guard1, student1, driver1, vehicle1, service1, ride };
}
```

### Test Endpoint Template
```javascript
describe('POST /accept', () => {
  test('Driver accepts ride successfully', async () => {
    // Setup
    const { ride, driver } = await seedTestData();
    const token = generateDriverJWT(driver.userId);
    
    // Execute
    const response = await request(app)
      .post(`/api/emergency-rides/${ride.id}/accept`)
      .set('Authorization', `Bearer ${token}`);
    
    // Verify
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('DRIVER_ACCEPTED');
    expect(response.body.acceptedAt).toBeDefined();
    
    // Check database
    const updated = await EmergencyRide.findByPk(ride.id);
    expect(updated.status).toBe('DRIVER_ACCEPTED');
  });
});
```

---

## Testing Workflow

### Step 1: Setup
- [ ] Create test database
- [ ] Run migrations
- [ ] Seed test data
- [ ] Verify data integrity

### Step 2: Unit Tests
- [ ] Run eligibility tests
- [ ] Run sorting tests
- [ ] Run transition tests
- [ ] All pass

### Step 3: Integration Tests
- [ ] Run PHASE 7 tests
- [ ] Run PHASE 8 tests
- [ ] Run PHASE 9 tests
- [ ] Run PHASE 10 tests
- [ ] All pass

### Step 4: Concurrency Tests
- [ ] Run concurrent scenarios
- [ ] Load test with 100+ concurrent
- [ ] Verify no race conditions
- [ ] Check lock contention

### Step 5: Performance Tests
- [ ] Measure response times
- [ ] Analyze query plans
- [ ] Check database usage
- [ ] Verify indexes working

### Step 6: Manual QA
- [ ] Test full happy path
- [ ] Test all error paths
- [ ] Test with real data
- [ ] Test UI integration

---

## Sign-Off Checklist

### Code Quality
- [ ] All tests pass
- [ ] Zero compilation errors
- [ ] Code reviewed
- [ ] No console.log left
- [ ] Error handling complete

### Documentation
- [ ] API docs updated
- [ ] Code comments added
- [ ] Test cases documented
- [ ] Database schema documented
- [ ] Deployment guide created

### Deployment
- [ ] Database migration script ready
- [ ] Rollback procedure documented
- [ ] Monitoring setup
- [ ] Alerting configured
- [ ] Backup strategy verified

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance benchmarks met
- [ ] Security review passed
- [ ] QA sign-off received

---

**Total Test Cases**: 150+
**Estimated Testing Time**: 2-3 days for full coverage
**Critical Success Path**: PHASE 7 → PHASE 8 → PHASE 9 → PHASE 10

Generated: 2026-08-31
Version: 1.0
