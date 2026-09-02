# Emergency Ride System - PHASE 7 & 8 Implementation

## Overview
This document describes the implementation of PHASE 7 (Driver Discovery) and PHASE 8 (Driver Selection) for the Emergency Ride system.

## Phases Implemented

### PHASE 7: Find Available Alternative Drivers
Endpoints and functions that discover and list eligible drivers for an emergency ride.

### PHASE 8: Guardian Selects Alternative Driver  
Endpoint that allows a guardian to select a specific driver for their emergency ride.

---

## API Endpoints

### 1. GET `/api/emergency-rides/:id/available-drivers`

**Purpose**: Find and list all eligible drivers for an emergency ride, sorted by priority.

**Access Control**:
- Requires JWT authentication
- Requires `guardian` role
- Requires PRO subscription (`requireProFeature` middleware)
- Guardian must own the emergency ride

**Request Parameters**:
- Path: `id` - Emergency ride ID

**Response** (200 OK):
```json
{
  "availableDrivers": [
    {
      "driver": {
        "id": "uuid",
        "fullname": "John Doe",
        "profileImage": "url",
        "rating": 4.8,
        "verificationStatus": "verified"
      },
      "vehicle": {
        "id": "uuid",
        "make": "Toyota",
        "model": "Hiace",
        "registrationNumber": "ABC 123 GP",
        "capacity": 4
      },
      "rating": 4.8,
      "distance": 2.5,         // km
      "eta": 5,                 // minutes
      "price": 250,
      "currency": "USD",
      "verificationStatus": "verified",
      "eligible": true,
      "reasons": []  // Only if ineligible
    }
  ],
  "totalEligible": 3,
  "total": 8
}
```

**Error Responses**:
- `403`: Not authenticated or not a guardian
- `404`: Emergency ride not found
- `409`: Ride is no longer in SEARCHING status

**Sorting Order**:
1. **Availability** - Eligible drivers first, ineligible last
2. **Distance** - Closer drivers first
3. **ETA** - Shorter ETA first
4. **Rating** - Higher rating first
5. **Price** - Lower price first

**Implementation Details**:
- Queries all active, verified drivers with emergency permission
- Evaluates each driver using `evaluateEmergencyRideDriverEligibility()`
- Sorts using `sortEmergencyRideDrivers()`
- Returns comprehensive details for guardian decision-making
- Ineligible drivers included for transparency with reasons list

---

### 2. POST `/api/emergency-rides/:id/select-driver`

**Purpose**: Guardian selects a specific driver for their emergency ride.

**Access Control**:
- Requires JWT authentication
- Requires `guardian` role
- Requires PRO subscription
- Guardian must own the emergency ride

**Request Body**:
```json
{
  "driverId": "uuid"
}
```

**Response** (200 OK):
Returns complete emergency ride object with driver, vehicle, and pricing information.

**Error Responses**:
- `400`: Missing or invalid driverId
- `403`: Not authenticated or not a guardian
- `404`: Emergency ride or driver not found
- `409`: 
  - Ride no longer in SEARCHING status
  - Driver no longer eligible (with reasons)
  - Driver already assigned to another active ride

**Post-Selection State**:
- `EmergencyRide.status` = `DRIVER_SELECTED`
- `EmergencyRide.driverId` = selected driver
- `EmergencyRide.vehicleId` = driver's vehicle
- `EmergencyRide.finalPrice` = service price (locked in)
- `EmergencyRide.currency` = service currency
- Audit log created with action `emergency_ride_driver_selected`

**CRITICAL: Re-Validation**
Before assignment, the driver is re-evaluated for eligibility. This ensures:
- Changes since the earlier `/available-drivers` call are detected
- Example: Driver becomes inactive, vehicle insurance expires, service becomes inactive
- Guardian cannot select an ineligible driver even if they appeared eligible seconds ago

**Concurrency Protection**:
- Database transaction with pessimistic locking on both ride and driver
- `enforceSingleDriverAssignment()` prevents two guardians from selecting the same driver
- First request wins, second fails with 409 error

---

## Helper Functions

### 1. `evaluateEmergencyRideDriverEligibility(driver, ride)`

**Purpose**: Determine if a driver is eligible for a specific emergency ride.

**Parameters**:
- `driver`: Driver object with related user, vehicle, service, and busyRide
- `ride`: EmergencyRide object

**Returns**:
```javascript
{
  eligible: boolean,           // Overall eligibility
  reasons: string[],          // List of ineligibility reasons
  distanceKm: number,         // Distance from service origin to pickup
  price: number,              // Service price
  currency: string,           // Service currency
  verificationStatus: string, // "verified" or "unverified"
  rating: number,             // Driver rating
  eta: number,                // Estimated arrival in minutes
}
```

**Eligibility Checks**:

✅ **Driver Status**
- Driver is active
- Driver user is active
- Driver is verified (identity & license)
- User account is verified

✅ **Emergency Ride Permission**
- Driver has `emergencyRideEnabled = true`

✅ **Availability**
- Driver not handling another conflicting ride
  - Conflicting statuses: DRIVER_SELECTED, DRIVER_ACCEPTED, DRIVER_ARRIVING, STUDENT_PICKED_UP, IN_TRANSIT

✅ **Vehicle Requirements**
- Vehicle is assigned to driver
- Vehicle is active
- Vehicle is verified (vehicle & insurance)
- Vehicle insurance not expired
- Vehicle has capacity >= 1

✅ **Service Configuration**
- Service is assigned and active
- Service type matches ride type (or is "emergency_transport")
- Service available on requested day
- Service available at requested time

✅ **Geographic & Logistics**
- Distance calculated from service origin to pickup location
- ETA calculated based on distance and average speed (30 km/h)

---

### 2. `sortEmergencyRideDrivers(drivers)`

**Purpose**: Sort drivers by priority order for selection.

**Parameters**:
- `drivers`: Array of driver evaluation results (output of `evaluateEmergencyRideDriverEligibility`)

**Returns**: Sorted array

**Sorting Criteria** (in order):
1. Availability (eligible first)
2. Distance (closer first, km)
3. ETA (shorter first, minutes)
4. Rating (higher first)
5. Price (lower first)

**Algorithm**:
```
For each pair of drivers:
  If availability differs → eligible driver wins
  Else if distance differs → shorter distance wins
  Else if ETA differs → shorter ETA wins
  Else if rating differs → higher rating wins
  Else if price differs → lower price wins
  Else → keep original order
```

---

### 3. `enforceSingleDriverAssignment(driverId, rideId, transaction)`

**Purpose**: Prevent a driver from being assigned to multiple concurrent rides.

**Parameters**:
- `driverId`: Driver UUID
- `rideId`: Emergency ride UUID (current ride being assigned)
- `transaction`: Sequelize transaction object (with locking)

**Returns**: `true` if assignment allowed, `false` if driver already assigned

**Implementation**:
- Queries for other active emergency rides assigned to same driver
- Uses database locking within transaction
- Returns false if any conflicting ride found
- Caller should rollback transaction if false

**Conflict Statuses**:
- DRIVER_SELECTED
- DRIVER_ACCEPTED
- DRIVER_ARRIVING
- STUDENT_PICKED_UP
- IN_TRANSIT

---

### 4. `haversineDistance(lat1, lon1, lat2, lon2)`

**Purpose**: Calculate great-circle distance between two coordinates.

**Parameters**:
- `lat1, lon1`: Origin latitude/longitude (degrees)
- `lat2, lon2`: Destination latitude/longitude (degrees)

**Returns**: Distance in kilometers

**Formula**: Haversine formula for accurate geodetic distance
- Earth radius: 6,371 km
- Accounts for Earth's curvature

---

## Database Schema

### Updated EmergencyRide Model
```javascript
{
  id: UUID (primary key),
  guardianId: UUID (foreign key),
  studentId: UUID (foreign key),
  driverId: UUID (foreign key, nullable) // Set in PHASE 8
  originalDriverId: UUID (foreign key, nullable),
  vehicleId: UUID (foreign key, nullable) // Set in PHASE 8
  pickupAddress: STRING,
  pickupLatitude: DECIMAL,
  pickupLongitude: DECIMAL,
  destinationAddress: STRING,
  destinationLatitude: DECIMAL,
  destinationLongitude: DECIMAL,
  tripType: STRING,
  requestedPickupTime: DATE,
  emergencyReason: TEXT,
  specialInstructions: TEXT,
  finalPrice: DECIMAL, // Set in PHASE 8
  currency: STRING,
  status: ENUM(REQUESTED, SEARCHING, DRIVER_SELECTED, ...),
  requestedAt: DATE,
  // ... other fields and timestamps
}
```

### Indexes Used
- `[guardianId, status]` - Quick lookup of guardian's rides by status
- `[driverId, status]` - Quick lookup of driver's active rides
- `[status, requestedAt]` - Efficient status-based queries

---

## Transaction & Locking Strategy

### GET /available-drivers
- Reads driver data
- No locking required (read-only operation)
- No transaction overhead

### POST /select-driver
- **Transaction**: Yes, required
- **Lock Type**: Pessimistic (UPDATE lock)
- **Locked Resources**:
  1. EmergencyRide row (`LOCK.UPDATE`)
  2. Driver row (`LOCK.UPDATE`)
- **Purpose**: Prevent concurrent assignments
- **Rollback**: Any validation failure causes complete rollback

**Lock Acquisition Order**:
1. Lock ride (prevent status changes)
2. Lock driver (prevent reassignment)
3. Validate eligibility
4. Check single assignment (query other rides)
5. Update ride
6. Create audit log
7. Commit

---

## Geographic Utilities

### Service Origin vs Pickup Location
- **Service Origin**: Where driver typically operates from (DriverService record)
- **Pickup Location**: Guardian-specified emergency pickup location
- **Distance**: Haversine distance between these two points
- **ETA**: Distance / 30 km/h + variance

### Availability Window
- **Service Days**: JSON array of day names (Monday, Tuesday, etc.)
- **Service Hours**: JSON object `{ start: "HH:MM", end: "HH:MM" }`
- **Request Time**: Guardian-specified pickup time
- **Check**: Is request time within available window?

---

## Security & Authorization

### Authentication & Authorization Chain
```
Request → JWT Authentication
        ↓
        → Guardian Role Check
        ↓
        → PRO Subscription Check
        ↓
        → Guardian Ownership Check (endpoint-specific)
        ↓
        → Business Logic
```

### Data Isolation
- Guardians only see their own rides
- Can only select drivers they got from available list
- Cannot access other guardians' rides or driver availability

### Audit Logging
- All driver selections logged with:
  - `userId` (guardian's user ID)
  - `action`: "emergency_ride_driver_selected"
  - `entity`: "EmergencyRide"
  - `entityId`: ride ID
  - `metadata`: driverId, vehicleId, price, currency

---

## Test Coverage

### Unit Tests (`emergencyRideMatching.test.js`)
✅ 40+ test cases covering:
- Eligible driver acceptance
- All rejection reasons (driver, vehicle, service, availability)
- Distance and ETA calculations
- Multi-criteria sorting
- Null value handling

### Integration Tests (`emergencyRideEndpoints.test.js`)
📝 Test templates for:
- Authentication & authorization
- All error conditions
- Happy path scenarios
- Concurrency scenarios
- Edge cases (midnight times, DST, antipodal coordinates)

---

## What's NOT Included (Next Phases)

### PHASE 9: Driver Acceptance
- Driver receives notification
- Driver can accept/reject
- Endpoint: POST `/api/emergency-rides/:id/accept` (driver role)

### PHASE 10+: Live Tracking & Notifications
- Real-time location updates via Socket.io
- Push notifications to guardian
- Live ETA updates
- Student arrived alerts

---

## Configuration

### Environment Variables
- `AVG_SPEED_KMH` = 30 (distance/ETA calculation)
- `MAX_LOGIN_ATTEMPTS` (for authentication)
- `NODE_ENV` (development/production)

### Database Connection
- Sequelize ORM with MySQL2 driver
- Transaction support required
- Pessimistic locking support required

---

## Performance Considerations

### Query Optimization
- Indexes on (guardianId, status) and (driverId, status)
- Uses `include` with specific attributes
- Eager loads driver, vehicle, service in single query
- Filters at database level

### Concurrency Handling
- Database-level row locks prevent race conditions
- Transactions ensure consistency
- No application-level semaphores needed

### Scalability
- Driver matching is O(n) where n = active drivers
- Sorting is O(n log n)
- For 1000+ drivers, may need pagination
- Future: Implement geographic indexing (R-tree) for radius search

---

## Common Issues & Troubleshooting

### Issue: "Driver is no longer eligible"
- **Cause**: Driver status changed after `/available-drivers` call
- **Solution**: Get available drivers again, select from updated list
- **Why**: Re-validation is intentional for data consistency

### Issue: "Driver already assigned"
- **Cause**: Another guardian selected the driver first (race condition)
- **Solution**: Try again, select different driver from available list
- **Why**: Database locking ensures consistency

### Issue: "Ride not found"
- **Cause**: Invalid ride ID or guardian doesn't own ride
- **Solution**: Verify ride ID, ensure guardian is the ride requester
- **Why**: Data isolation & security

### Issue: Empty available drivers list
- **Possible Causes**:
  - No drivers with emergency permission in area
  - Request time outside all service hours
  - No verified/active drivers
  - Vehicle capacity issues
- **Solution**: Try again later, contact support for area coverage

---

## Files Modified

| File | Changes |
|------|---------|
| `emergencyRideController.js` | +4 helper functions, +2 endpoints, +geographic utilities |
| `emergencyRides.js` (routes) | +2 new routes (GET, POST) |
| `emergencyRideMatching.test.js` | Expanded from 10 to 40+ unit tests |
| `emergencyRideEndpoints.test.js` | NEW - 30+ integration test templates |

---

## Code Quality

- **Error Handling**: Comprehensive try-catch with transaction rollback
- **Validation**: Input validation + re-validation before assignment
- **Logging**: Audit logs for all actions
- **Type Safety**: Proper data type checks
- **Documentation**: Inline comments for complex logic

---

## Future Improvements

1. **Geographic Indexing**: Use R-tree for radius-based driver search
2. **Rating System**: Implement driver ratings persistence
3. **Service Filtering**: Add filter by price range, distance radius
4. **Pagination**: For large driver lists
5. **Caching**: Cache driver availability for repeated calls
6. **Real-time Updates**: WebSocket subscriptions for availability changes
7. **A/B Testing**: Compare sorting algorithms
8. **Machine Learning**: Predict optimal driver based on success rate

---

## Contact & Questions

For questions about this implementation, refer to:
- Unit test cases in `emergencyRideMatching.test.js`
- Integration test templates in `emergencyRideEndpoints.test.js`
- Inline code comments in `emergencyRideController.js`

