# Emergency Ride System - Quick Reference Guide

## Complete API Map

### PHASE 6: Request & Cancel (Existing)
```
POST   /api/emergency-rides/request           [Guardian] Request emergency ride
POST   /api/emergency-rides/:id/cancel        [Guardian] Cancel ride
```

### PHASE 7: Find Drivers (Existing)
```
GET    /api/emergency-rides/:id/available-drivers  [Guardian] Find eligible drivers
```

### PHASE 8: Select Driver (Existing)
```
POST   /api/emergency-rides/:id/select-driver  [Guardian] Select a driver
```

### PHASE 9: Driver Accept/Reject (NEW)
```
POST   /api/emergency-rides/:id/accept        [Driver] Accept the ride
POST   /api/emergency-rides/:id/reject        [Driver] Reject the ride
```

### PHASE 10: Trip Lifecycle (NEW)
```
POST   /api/emergency-rides/:id/arriving      [Driver] Arrived at pickup
POST   /api/emergency-rides/:id/pickup        [Driver] Student picked up
POST   /api/emergency-rides/:id/start         [Driver] Trip started
POST   /api/emergency-rides/:id/complete      [Driver] Trip completed
```

### PHASE 10: Cancellation (Updated)
```
POST   /api/emergency-rides/:id/cancel        [Guardian or Driver] Cancel ride
```

---

## Lifecycle Status Flow

```
REQUESTED → SEARCHING → DRIVER_SELECTED → DRIVER_ACCEPTED → DRIVER_ARRIVING
                  ↑         ↑                 ↑ (can reject)   ↓
                  └─────────┴─────────────────┴─ Back to SEARCHING
                            └─── CANCELLED

DRIVER_ARRIVING → STUDENT_PICKED_UP → IN_TRANSIT → STUDENT_DROPPED_OFF → COMPLETED
```

### Key Transitions
| From | To | Endpoint | Role | Condition |
|------|----|---------| ---- | --------- |
| DRIVER_SELECTED | DRIVER_ACCEPTED | POST /accept | Driver | Driver accepts ride |
| DRIVER_SELECTED | DRIVER_REJECTED | POST /reject | Driver | Driver rejects ride |
| DRIVER_REJECTED | SEARCHING | (automatic) | - | Ride re-offered to others |
| DRIVER_ACCEPTED | DRIVER_ARRIVING | POST /arriving | Driver | Driver arrived at pickup |
| DRIVER_ARRIVING | STUDENT_PICKED_UP | POST /pickup | Driver | Student entered vehicle |
| STUDENT_PICKED_UP | IN_TRANSIT | POST /start | Driver | Trip to destination started |
| IN_TRANSIT | COMPLETED | POST /complete | Driver | Student dropped off + trip complete |

---

## Role-Based Permissions

### Guardian Permissions
```
POST   /request                    Request emergency ride
GET    /:id/available-drivers     Find drivers
POST   /:id/select-driver         Select a driver
POST   /:id/cancel                Cancel (in early stages only)
```

### Driver Permissions
```
POST   /:id/accept                Accept ride
POST   /:id/reject                Reject ride
POST   /:id/arriving              Mark arriving
POST   /:id/pickup                Mark pickup
POST   /:id/start                 Start trip
POST   /:id/complete              Complete trip
POST   /:id/cancel                Cancel (DRIVER_SELECTED only)
```

---

## Status-Based Cancellation Rules

### Guardian Can Cancel
- REQUESTED
- SEARCHING
- DRIVER_SELECTED
- DRIVER_ACCEPTED
- DRIVER_ARRIVING

### Guardian Cannot Cancel
- STUDENT_PICKED_UP (trip committed)
- IN_TRANSIT (in progress)
- STUDENT_DROPPED_OFF (ending)
- COMPLETED (finished)
- CANCELLED (already cancelled)

### Driver Can Cancel
- DRIVER_SELECTED (before accepting)

### Driver Cannot Cancel
- DRIVER_ACCEPTED and beyond (committed to trip)

---

## Key Constraints

### ✅ Must Enforce
1. Only assigned driver can operate on ride
2. Only ride owner (guardian) can see/cancel ride
3. All PRO subscription required
4. Status transitions must follow exact sequence
5. Student's permanent assignment never modified
6. All actions logged to audit trail
7. Transactions ensure consistency

### ❌ Must NOT Do
1. Automatically assign drivers (guardian chooses)
2. Modify student's normal vehicle assignment
3. Allow double-booking of drivers
4. Skip status steps
5. Allow cross-ride/cross-user access
6. Cancel rides during active transport

---

## HTTP Status Codes Used

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Ride accepted, status updated |
| 201 | Created | Emergency ride request created |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | No JWT token |
| 403 | Forbidden | Wrong role / no PRO subscription |
| 404 | Not Found | Ride doesn't exist / driver not assigned |
| 409 | Conflict | Invalid status transition / driver inactive |
| 500 | Server Error | Database error / transaction failed |

---

## Request/Response Examples

### Request Emergency Ride
```bash
POST /api/emergency-rides/request
Content-Type: application/json
Authorization: Bearer <guardian-jwt>

{
  "studentId": "uuid",
  "pickupAddress": "123 Main St",
  "pickupLatitude": -26.2041,
  "pickupLongitude": 28.0473,
  "destinationAddress": "456 Oak Ave",
  "destinationLatitude": -26.1950,
  "destinationLongitude": 28.0550,
  "tripType": "emergency_transport",
  "requestedPickupTime": "2026-08-31T14:30:00Z",
  "emergencyReason": "School ended early"
}

Response 201:
{
  "id": "ride-uuid",
  "guardianId": "guardian-uuid",
  "studentId": "student-uuid",
  "status": "SEARCHING",
  "pickupAddress": "123 Main St",
  "destinationAddress": "456 Oak Ave",
  "requestedAt": "2026-08-31T14:20:00Z"
}
```

### Get Available Drivers
```bash
GET /api/emergency-rides/ride-uuid/available-drivers
Authorization: Bearer <guardian-jwt>

Response 200:
{
  "availableDrivers": [
    {
      "driver": {
        "id": "driver-1",
        "fullname": "John Doe",
        "rating": 4.8,
        "profileImage": "url"
      },
      "vehicle": {
        "make": "Toyota",
        "model": "Hiace",
        "registrationNumber": "ABC 123"
      },
      "distance": 2.5,
      "eta": 5,
      "price": 250,
      "currency": "USD",
      "eligible": true
    }
  ],
  "totalEligible": 3,
  "total": 8
}
```

### Select Driver
```bash
POST /api/emergency-rides/ride-uuid/select-driver
Authorization: Bearer <guardian-jwt>
Content-Type: application/json

{
  "driverId": "driver-1"
}

Response 200:
{
  "id": "ride-uuid",
  "status": "DRIVER_SELECTED",
  "driverId": "driver-1",
  "vehicleId": "vehicle-uuid",
  "finalPrice": 250,
  "currency": "USD"
}
```

### Accept Ride
```bash
POST /api/emergency-rides/ride-uuid/accept
Authorization: Bearer <driver-jwt>

Response 200:
{
  "id": "ride-uuid",
  "status": "DRIVER_ACCEPTED",
  "acceptedAt": "2026-08-31T14:25:00Z"
}
```

### Complete Trip
```bash
POST /api/emergency-rides/ride-uuid/complete
Authorization: Bearer <driver-jwt>

Response 200:
{
  "id": "ride-uuid",
  "status": "COMPLETED",
  "studentDroppedOffAt": "2026-08-31T14:45:00Z",
  "completedAt": "2026-08-31T14:45:00Z"
}
```

---

## Audit Trail Events

Every action creates an audit log:
```
emergency_ride_requested
emergency_ride_driver_selected
emergency_ride_accepted
emergency_ride_rejected
emergency_ride_driver_arriving
emergency_ride_student_picked_up
emergency_ride_trip_started
emergency_ride_completed
emergency_ride_cancelled_by_guardian
emergency_ride_cancelled_by_driver
```

---

## Error Response Format

```json
{
  "message": "Error description",
  "currentStatus": "DRIVER_SELECTED",  // Optional
  "reasons": ["reason 1", "reason 2"]  // Optional, for eligibility errors
}
```

---

## Security Checklist

- ✅ JWT authentication on all endpoints
- ✅ Role-based access control (guardian vs driver)
- ✅ PRO subscription verification
- ✅ Ride ownership validation
- ✅ Driver assignment validation
- ✅ Transaction-level locking
- ✅ Status validation
- ✅ Audit logging
- ✅ No data leakage between users
- ✅ Immutable ride history

---

## Performance Tips

1. **Database Indexes**
   - Use indexes on (guardianId, status)
   - Use indexes on (driverId, status)
   - Queries optimize for quick lookups

2. **Caching Opportunities**
   - Driver availability (60-second TTL)
   - Vehicle capacity (static data)
   - Service hours (static data)

3. **Async Operations**
   - Audit logging can be queued
   - Notifications can be offloaded
   - Analytics processing can be batch

4. **Scaling**
   - Transactions are short (< 1 second)
   - Connection pool handles concurrency
   - R-tree indexing ready for geographic queries

---

## Common Workflows

### Happy Path: Guardian Requests & Driver Accepts
```
1. Guardian: POST /request
   → Status: SEARCHING

2. Guardian: GET /available-drivers
   → Get list of eligible drivers

3. Guardian: POST /select-driver
   → Status: DRIVER_SELECTED

4. Driver: POST /accept
   → Status: DRIVER_ACCEPTED

5. Driver: POST /arriving
   → Status: DRIVER_ARRIVING

6. Driver: POST /pickup
   → Status: STUDENT_PICKED_UP

7. Driver: POST /start
   → Status: IN_TRANSIT

8. Driver: POST /complete
   → Status: COMPLETED
```

### Rejection Path: Driver Rejects
```
1. Guardian: [previous steps lead to DRIVER_SELECTED]

2. Driver: POST /reject
   → Status: DRIVER_REJECTED

3. Guardian: GET /available-drivers (same ride ID)
   → Get new list (original driver excluded)

4. Guardian: POST /select-driver (new driver)
   → Status: DRIVER_SELECTED

5. [Continue with new driver...]
```

### Early Cancellation: Guardian Cancels During Search
```
1. Guardian: POST /request
   → Status: SEARCHING

2. Guardian: POST /cancel
   → Status: CANCELLED
   → Ride ends, no driver interaction
```

### Emergency Cancellation: Guardian Cancels Before Pickup
```
1. Guardian: [previous steps to DRIVER_ACCEPTED]

2. Guardian: POST /cancel
   → Status: CANCELLED
   → Driver freed up
   → Audit logged
```

---

## Troubleshooting Guide

### "Invalid status transition"
→ Follow the exact sequence shown above, no shortcuts

### "Driver not assigned to this ride"
→ Wrong driver attempting operation, use correct driver's JWT

### "Cannot cancel in current status"
→ Guardian: Cannot cancel after STUDENT_PICKED_UP
→ Driver: Cannot cancel after DRIVER_ACCEPTED

### "Emergency ride not found"
→ Verify ride UUID format
→ Verify ride ownership

### "Active driver profile required"
→ Use driver's JWT, not guardian's

### "Active guardian profile required"  
→ Use guardian's JWT, not driver's

---

## Testing Checklist

### Unit Tests
- ✅ Status transitions valid/invalid
- ✅ Authorization checks
- ✅ Validation rules
- ✅ Timestamp recording

### Integration Tests  
- ⏳ Full workflows
- ⏳ Error paths
- ⏳ Concurrency scenarios
- ⏳ Database consistency

### Load Tests
- ⏳ Concurrent requests
- ⏳ Large-scale operations
- ⏳ Performance benchmarks

---

## Future Enhancements

1. **Real-Time Updates** (Socket.io)
   - Live location tracking
   - Push notifications
   - Dynamic ETA updates

2. **Payment Integration**
   - Automatic charge on completion
   - Multiple payment methods
   - Refund handling

3. **Rating System**
   - Driver ratings
   - Guardian ratings
   - Review system

4. **Analytics**
   - Completion rates
   - Average times
   - Driver performance metrics

5. **Automatic Handling**
   - Timeout rejection
   - Auto re-assignment
   - Performance-based penalties

---

## Support & Documentation

- API Docs: See `EMERGENCY_RIDE_PHASE_9_10.md`
- Code: See `emergencyRideController.js`
- Tests: See `emergencyRidePhase9_10.test.js`
- Routes: See `emergencyRides.js`

---

**Version**: 1.0 (PHASES 6-10)
**Last Updated**: 2026-08-31
**Status**: Implementation Complete, Integration Testing Ready
