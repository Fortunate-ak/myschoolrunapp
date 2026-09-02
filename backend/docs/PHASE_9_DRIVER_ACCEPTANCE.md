# PHASE 9: Driver Acceptance - Implementation Guide

## Overview
PHASE 9 involves implementing the driver acceptance flow for emergency rides. After a guardian selects a driver (PHASE 8), the driver receives the request and can accept or reject it.

## Current State (End of PHASE 8)

### Emergency Ride Status at PHASE 8 Completion
```
{
  status: "DRIVER_SELECTED",
  driverId: <driver-id>,
  vehicleId: <vehicle-id>,
  finalPrice: <locked-price>,
  currency: "USD"
}
```

### Timeline After PHASE 8
- Guardian selects driver → Status becomes DRIVER_SELECTED
- System is now waiting for driver acceptance/rejection
- Timeout: None specified yet (TODO: Define)

---

## PHASE 9 Requirements

### Endpoints to Implement

#### 1. POST `/api/emergency-rides/:id/accept`
**Role**: Driver
**Status**: DRIVER_SELECTED → DRIVER_ACCEPTED
**Response**: Updated emergency ride object

#### 2. POST `/api/emergency-rides/:id/reject`  
**Role**: Driver
**Status**: DRIVER_SELECTED → SEARCHING (back to finding drivers)
**Note**: Offer the ride to next available driver? Or restart search?

### Notifications
- Driver should receive notification when selected (via push notifications/Socket.io)
- Guardian should receive confirmation when driver accepts

### Database Fields
May need to add to EmergencyRide model:
- `acceptedAt`: Timestamp when driver accepts
- `rejectionReason`: Text field if driver rejects
- `rejectedAt`: Timestamp when driver rejects

### Timeout Handling
Define:
- How long should driver have to accept? (Suggested: 30-60 seconds)
- What happens if timeout expires? (Suggested: Offer to next driver or restart search)
- Should driver be penalized for rejections?

---

## Implementation Checklist

- [ ] Define timeout window for driver acceptance
- [ ] Implement `POST /api/emergency-rides/:id/accept` endpoint
- [ ] Implement `POST /api/emergency-rides/:id/reject` endpoint  
- [ ] Add `acceptedAt` and `rejectedAt` fields to model
- [ ] Add acceptance status checks
- [ ] Send push notification to driver when ride is assigned
- [ ] Send confirmation to guardian when driver accepts
- [ ] Handle timeout (auto-reject or move to next driver)
- [ ] Add audit logging for accept/reject actions
- [ ] Add unit tests for acceptance logic
- [ ] Add integration tests with timing
- [ ] Handle race conditions (driver accepts while guardian cancels)

---

## Expected Transitions

### Happy Path
```
REQUESTING
    ↓
SEARCHING (guardian searches for drivers)
    ↓
DRIVER_SELECTED (guardian selects driver)
    ↓
DRIVER_ACCEPTED (driver accepts) ← PHASE 9
    ↓
DRIVER_ARRIVING (driver en route)
    ↓
... (continues through pickup, transit, dropoff)
```

### Rejection Path
```
DRIVER_SELECTED
    ↓
SEARCHING (driver rejects, back to search)
    ↓
DRIVER_SELECTED (guardian selects different driver)
    ↓
DRIVER_ACCEPTED (driver accepts)
    ↓
... (continues)
```

### Timeout Path
```
DRIVER_SELECTED
    ↓
[30 seconds pass]
    ↓
SEARCHING (auto-reject on timeout)
    ↓
... (guardian selects next driver)
```

---

## Driver Access Pattern

Drivers need a new endpoint to fetch pending emergency rides:

### GET `/api/drivers/emergency-rides/pending` (FUTURE)
**Role**: Driver
**Returns**: List of DRIVER_SELECTED rides awaiting their response
**Purpose**: Allows driver to see and manage pending emergency ride requests

---

## Key Considerations

### 1. Race Conditions
- What if driver accepts while guardian cancels?
  - Suggested: Driver acceptance wins (ride cannot be cancelled once accepted)
- What if driver rejects while guardian cancels?
  - Suggested: Cancellation wins

### 2. Timeout Implementation Options
**Option A: Scheduled Job**
- Use node-cron to check for expired rides
- Mark as expired after timeout window
- Offer to next driver automatically

**Option B: Lazy Evaluation**
- Check timeout on GET pending rides
- Only when driver checks their app
- Simpler but less consistent

**Option C: Client-Side Timer**
- Frontend shows countdown timer
- Sends accept/reject before timeout
- Server validates actual timeout too

### 3. Re-offering Logic
When driver rejects:
- Automatically offer to next eligible driver?
- Return to SEARCHING and let guardian choose?
- Suggested: Return to SEARCHING for guardian to choose

### 4. Driver Rating Impact
- Should rejections affect driver rating?
- Should frequent rejections restrict driver?
- TODO: Define business rules

---

## Integration Points

### Notifications Service
```javascript
// Notify driver when selected
await notificationService.send({
  userId: driver.userId,
  type: "emergency_ride_offered",
  data: {
    rideId: ride.id,
    pickupLocation: ride.pickupAddress,
    fare: ride.finalPrice,
    expiresIn: 60 // seconds
  }
});

// Notify guardian when driver accepts
await notificationService.send({
  userId: guardian.userId,
  type: "emergency_ride_accepted",
  data: {
    driverName: driver.name,
    vehicleInfo: ride.vehicle,
    eta: calculateETA()
  }
});
```

### Socket.io Events (FUTURE)
```javascript
// Driver-side
socket.on('emergency_ride:offered', (rideData) => {
  // Update UI with ride details
  // Show accept/reject buttons
  // Start countdown timer
});

socket.on('emergency_ride:expired', () => {
  // Ride offer expired
  // Remove from pending list
});

// Guardian-side
socket.on('emergency_ride:accepted', (driverData) => {
  // Update UI with driver accepted
  // Show driver location tracking
});

socket.on('driver:rejected', (reason) => {
  // Driver rejected offer
  // Return to driver selection
});
```

---

## API Reference for PHASE 9

### Request Bodies

#### Accept Ride
```json
POST /api/emergency-rides/:id/accept
{
  "acceptedAt": "2099-01-01T10:00:00.000Z"  // Auto-set server-side
}
```

#### Reject Ride
```json
POST /api/emergency-rides/:id/reject
{
  "rejectionReason": "Too far away" // Optional
}
```

### Response Examples

#### Accept Response (200 OK)
```json
{
  "id": "ride-id",
  "status": "DRIVER_ACCEPTED",
  "driverId": "driver-id",
  "acceptedAt": "2099-01-01T10:00:05.000Z",
  "driver": { /* driver details */ },
  "vehicle": { /* vehicle details */ },
  "finalPrice": 250
}
```

#### Reject Response (200 OK)
```json
{
  "id": "ride-id",
  "status": "SEARCHING",
  "driverId": null,
  "rejectedAt": "2099-01-01T10:00:05.000Z",
  "rejectionReason": "Too far away"
}
```

---

## Testing Strategy

### Unit Tests
- Test status transitions
- Test timestamp recording
- Test rejection reason handling
- Test timeout scenarios

### Integration Tests  
- Test driver receives notification
- Test guardian receives notification
- Test race conditions
- Test timeout expiration
- Test rejected driver removed from active rides

### Load Tests
- Multiple drivers accepting simultaneously
- Large scale rejection handling
- Timeout job performance

---

## Database Changes

```javascript
// Add to EmergencyRide migration/model

acceptedAt: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: "Timestamp when driver accepted the ride"
},

rejectedAt: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: "Timestamp when driver rejected the ride"
},

rejectionReason: {
  type: DataTypes.TEXT,
  allowNull: true,
  comment: "Reason provided by driver for rejection"
},

acceptanceTimeoutAt: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: "When acceptance offer expires"
}
```

---

## Implementation Order

1. ✅ Add database fields
2. ✅ Implement POST accept endpoint
3. ✅ Implement POST reject endpoint
4. ✅ Add driver permission checks
5. ✅ Implement timeout checking
6. ✅ Add notifications
7. ✅ Add audit logging
8. ✅ Add tests
9. ✅ Document edge cases

---

## Known Issues to Resolve

1. **Timeout Window Duration**
   - How long should driver have to accept?
   - What if network is slow?
   - Suggested: 60 seconds with 10 second leeway

2. **Rejection Impact**
   - Should driver accept rate affect availability?
   - Should rejection have consequences?
   - Business rule needed

3. **Re-offering Strategy**
   - Offer to next driver automatically?
   - Let guardian choose?
   - Suggested: Let guardian choose for transparency

4. **Guardian Cancellation**
   - Can guardian cancel after driver accepted?
   - What's the penalty?
   - Suggested: No - ride is committed

5. **Driver Availability During Acceptance**
   - What if driver becomes unavailable while deciding?
   - Suggested: Allow rejection with reason

---

## References

- Current: [PHASE 7 & 8 Docs](./EMERGENCY_RIDE_PHASE_7_8.md)
- Model: `models/emergencyRides.js`
- Controller: `controllers/emergencyRideController.js`
- Routes: `routes/emergencyRides.js`
- Tests: `tests/emergencyRideMatching.test.js`

---

## Quick Start

```bash
# To implement PHASE 9:

1. Read this guide completely
2. Review PHASE 7 & 8 implementation
3. Define timeout and re-offering strategy (meeting needed)
4. Add database fields
5. Create POST /accept and /reject endpoints
6. Add notification integration
7. Implement timeout handling
8. Write comprehensive tests
9. Update documentation
```

Good luck! 🚀

