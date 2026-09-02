# SchoolRun Backend — Technical Documentation

**Project:** SchoolRunForLancers — `backend/`
**Stack:** Node.js, Express, Sequelize (MySQL), Socket.io, PeerJS, Passport (JWT/RS256)
**Purpose:** API and real-time server powering the SchoolRun guardian app, driver app, and admin web dashboard.

---

## 1. Overview & Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (`nodemon index.js` for dev, via `npm start`) |
| Web framework | Express |
| Database | MySQL, via Sequelize ORM (migrations-driven schema) |
| Real-time | Socket.io (tracking, chat, notifications) + PeerJS (voice/video calls) |
| Auth | Passport.js, JWT signed with RS256 (asymmetric key pair: `private.key` / `public.key`) |
| File uploads | Multer, stored on local disk under `/uploads` |
| Email | Nodemailer (Gmail SMTP) |
| Push notifications | `expo-server-sdk` (Expo push tokens) |
| Scheduled jobs | `node-cron` |
| Admin dashboard | Pre-built static SPA served from `admin/dist` (separate frontend project, built with Vite — not part of this backend's source) |

Key dependencies (from `package.json`): `express`, `sequelize`, `mysql2`, `passport`, `passport-jwt`, `socket.io`, `peer`/`peerjs`, `multer`, `nodemailer`, `expo-server-sdk`, `node-cron`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `cors`, `request-ip`.

There is currently no automated test suite (`npm test` is a placeholder).

---

## 2. Project Structure

```
backend/
├── index.js                  # App entry point — server bootstrap
├── generateMigrations.js     # One-off script: scans models/, writes migration files
├── config/
│   ├── config.js             # Sequelize CLI config (dev/test/production)
│   ├── automigrations.js     # Config for a separate auto-migration-diff tool
│   ├── passport.js           # JWT strategy (RS256) + requireRole/checkTokenExpiry
│   └── multer.js             # File upload configuration & presets
├── models/                   # Sequelize model definitions (see §4)
│   ├── index.js               # Aggregator — loads every model, wires associations
│   ├── messaging/             # conversations, messages, attachments, participants
│   └── vehicle/               # drivers, vehicles, routes, stops, tracking, alerts, assignments, attendance
├── migrations/                # Sequelize migration history (schema changes, in order)
├── seeders/                   # Seed data (currently: default roles)
├── controllers/                # Route handler logic, one file per feature area
├── routes/                    # Express routers, one file per feature area (see §6)
├── socket/
│   ├── socketHandler.js       # All Socket.io event wiring
│   └── peerHandler.js         # PeerJS signalling server setup
├── services/                  # Business logic reused across controllers/sockets (notifications, tracking cleanup, etc.)
├── middleware/                 # auditMiddleware, emailTransporter, passwordChangeLimiter
├── utils/                      # authHelpers, userHelpers, emailTemplate, logAudit, etc.
├── jobs/                       # Scheduled background jobs (node-cron)
├── bootstrap/
│   └── createAdminIfEmpty.js  # Creates a default admin account on first run
├── uploads/                    # User-uploaded files (profile images, attachments, etc.)
├── admin/dist/                 # Pre-built admin web dashboard (static SPA)
├── private.key / public.key   # RS256 key pair for signing/verifying JWTs
└── .env                        # Environment configuration (never commit — see §3)
```

---

## 3. Environment Variables

Values are not reproduced here for security — see your local `.env`. Variable **names** the codebase expects:

| Variable | Purpose |
|---|---|
| `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | MySQL connection (read by `config/config.js`, `config/automigrations.js`) |
| `APP_PORT` | Port the Express/Socket.io server listens on |
| `NODE_ENV` | `development` / `production` / `test` — controls `sequelize.sync()` behavior, cookie security flags, CSP strictness, and which `config.js` block is used |
| `EMAIL_SERVICE`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Nodemailer SMTP config for verification/reset emails |
| `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` | Used by `bootstrap/createAdminIfEmpty.js` |
| `PRIVATE_KEY`, `PUBLIC_KEY` (or `private.key`/`public.key` files) | RS256 key pair for JWT signing/verification |
| `CLIENT_URL` | Allowed CORS origin (admin dashboard's dev URL) |
| `LOGIN_TIMEOUT`, `ACCOUNT_LOCK_TIME`, `MAX_LOGIN_ATTEMPTS` | Brute-force login protection thresholds |
| `EXPO_ACCESS_TOKEN` | Used by the Expo push notification SDK |
| `MAPBOX` | Mapbox secret token (used by the mobile apps, referenced here for the CSP allowlist) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Present in `.env` but the actual signing mechanism uses the RS256 key pair — see Known Issues (§10) |

> **Security note:** During this documentation session, a `.env` file containing live secrets (DB password, email app password, JWT secrets, private/public keys, Mapbox token) was shared in a chat conversation. If that hasn't already been done, rotate all of these values.

---

## 4. Database Schema

Schema is managed entirely through Sequelize **migrations** — `NODE_ENV=production` deliberately skips `sequelize.sync()` (see §5), so `migrations/` is the single source of truth for table structure. `generateMigrations.js` is a helper script that can scan `models/` and scaffold new migration files from model definitions.

### 4.1 Identity & Roles

**`role`**
`id` (UUID, PK), `name`
- `hasMany` → `users`, `notifications`
- Seeded roles (`seeders/`): `admin`, `super-admin`, `student`, `guardian`, `driver`

**`users`**
`id`, `fullname`, `email`, `phone`, `password` (bcrypt hash), `roleId`, `refreshToken`, `resetPasswordToken`, `resetPasswordExpires`, `emailVerificationOTP`, `emailVerificationOTPExpires`, `emailVerificationOTPAttempts`, `isVerified`, `verifiedAt`, `inviteToken`, `inviteExpires`, `loginAttempts`, `lockUntil`, `lastLoginAttempt`, `isActive`
- `belongsTo` → `role`
- `hasOne` → `drivers`, `guardians`

**`guardians`**
`id`, `userId`, `guardianAddress`, `gender`, `isActive`, `isSubscribed`, `subscriptionPlan`, `subscriptionExpiresAt`
- `belongsTo` → `users` (as `user`)
- `hasMany` → `guardianstudents`
- `belongsToMany` → `students` (through `guardianstudents`)
- *(the `isSubscribed`/`subscriptionPlan`/`subscriptionExpiresAt` columns are a simple flag-based subscription mechanism added directly to this table — see §9 for how it relates to the separate `subscriptionplans`/`usersubscriptions` tables)*

**`drivers`**
`id`, `userId`, `profileImage`, `idNumber`, `licenseNumber`, `gender`, `isActive`
- `belongsTo` → `users`

**`students`**
`id`, `fullname`, `schoolAddress`, `homeAddress`, `vehicleRouteId`, `vehicleStopId`, `gender`, `isActive`
- `hasMany` → `guardianstudents`
- `belongsTo` → `vehicleroutes`
- `belongsToMany` → `guardians` (through `guardianstudents`)

**`guardianstudents`** (join table)
`id`, `guardianId`, `studentId`, `relationshipToStudent`

**`guardianrequests`**
`id`, `driverId`, `guardianId`, `requestType`, `numberOfStudents`, `students`, `studentId`, `vehicleStopId`, `routeId`, `homeLocation`, `schoolLocation`, `status`
- `belongsTo` → `guardians`, `drivers`, `vehicleroutes` (as `route`), `students`
- Represents a guardian's request to be assigned to a driver/route (approve/reject workflow — see §6.5)

### 4.2 Vehicles & Routing

**`vehicles`**
`id`, `driverId`, `image`, `carMake`, `carModel`, `registrationNumber`, `capacity`, `lastServiceDate`, `nextServiceDate`, `insuranceExpiry`, `isActive`
- `belongsTo` → `drivers`
- `hasMany` → `vehicletracking`, `vehicleassignments`, `vehiclealerts`, `vehicleroutes`

**`vehicleroutes`**
`id`, `routeNumber`, `routeName`, `vehicleId`, `routeType`, `startTime`, `estimatedEndTime`, `activeDays`, `totalDistance`, `estimatedDuration`, `status`, `isActive`, `stops`, `location` fields
- `belongsTo` → `vehicles`
- `hasMany` → `vehicleassignments` (as `studentAssignments`)

**`vehiclestops`**
`id`, `routeId`, `stopName`, `stopOrder`, `location`, `scheduledPickupTime`, `scheduledDropoffTime`, `estimatedWaitTime`, `landmark`, `notes`, `isActive`
- `belongsTo` → `vehicleroutes`
- `hasMany` → `vehicleassignments` (as `pickupAssignments` / `dropoffAssignments`)

**`vehicleassignments`**
`id`, `studentId`, `vehicleId`, `routeId`, `pickupStopId`, `dropoffStopId`, `assignmentType`, `effectiveFrom`, `effectiveTo`, `activeDays`, `guardianPhone`, `emergencyContact`, `specialRequirements`, `status`, `isActive`
- Links a student to a specific vehicle/route/pickup-dropoff pair
- `hasMany` → `vehicleattendance`

**`vehicleattendance`**
`id`, `assignmentId`, `studentId`, `vehicleId`, `routeId`, `date`, `tripType`, `status`, `boardingStopId`, `boardingTime`, `exitStopId`, `exitTime`, `markedById`, `parentNotified`, `notificationSentAt`, `notes`
- Per-trip boarding/exit record for a student

**`vehicletracking`**
`id`, `vehicleId`, `routeId`, `latitude`, `longitude`, `speed`, `heading`, `accuracy`, `timestamp`, `currentStopId`, `distanceToNextStop`, `estimatedArrivalTime`, `status`, `engineStatus`
- Raw GPS ping history, written by `POST /api/vehicle-tracking/record-location`

**`vehiclealerts`**
`id`, `vehicleId`, `routeId`, `stopId`, `alertType`, `severity`, `title`, `message`, `location`, `delayMinutes`, `etaMinutes`, `status`, `resolvedBy`, `resolvedAt`, `resolutionNotes`, `readBy`, `notifiedParents`, `notifiedAdmins`, `driverName`, `driverPhone`
- SOS, delay, arrival, and other alert types raised during a trip

### 4.3 Messaging

**`conversations`**
`id`, `type`, `name`, `createdBy`, `classId`, `routeId`, `lastMessageAt`, `isActive`
- `belongsTo` → `users` (as `creator`), `vehicleroutes` (as `route` — for route-based group channels)
- `hasMany` → `conversationparticipants`, `messages`

**`conversationparticipants`**
`id`, `conversationId`, `userId`, `role`, `lastReadMessageId`, `isMuted`, `joinedAt`, `isActive`

**`messages`**
`id`, `conversationId`, `senderId`, `message`, `messageType`, `isEdited`, `editedAt`, `isDeleted`, `deletedFor`, `readBy`, `deliveredTo`, `isActive`
- `hasMany` → `messageattachments`

**`messageattachments`**
`id`, `messageId`, `fileName`, `filePath`, `fileSize`, `mimeType`, `isActive`

### 4.4 Notifications & Announcements

**`notifications`**
`id`, `userId`, `title`, `notifType`, `message`, `roleId`, `isGlobal`, `isRead`, `readAt`, `entityType`, `entityId`, `metadata`

**`announcements`**
`id`, `authorId`, `message`, `audienceType`, `audienceIds`, `priority`, `isActive`

**`pushnotificationtokens`**
`id`, `userId`, `expoPushToken`, `deviceName`, `deviceType`, `platform`, `appVersion`, `lastUsed`, `isActive`

### 4.5 Subscriptions (two parallel systems — see §9)

**`subscriptionplans`**
`id`, `name`, `description`, `price`, `duration`, `isActive`

**`usersubscriptions`**
`id`, `guardianId`, `planId`, `status` (`active`/`expired`/`cancelled`/`pending_payment`), `startDate`, `endDate`, `autoRenew`, `paymentReference`, `paymentMethod`, `amountPaid`, `currency`, `cancelledAt`
- `belongsTo` → `guardians`, `subscriptionplans` (as `plan`)

### 4.6 Audit

**`auditlogs`**
`id`, `userId`, `action`, `entity`, `entityId`, `metadata`
- Written by `utils/logAudit.js`, called throughout nearly every controller after significant actions (login, signup, subscription, user activation, etc.)

---

## 5. Application Bootstrap (`index.js`)

1. Loads `.env`, creates the Express app and a raw `http.Server` wrapping it (needed so Socket.io and PeerJS can share the same port as the HTTP API).
2. Configures Socket.io CORS to explicitly allow requests with **no `Origin` header** — required because React Native/Expo mobile clients don't send one; a standard browser-only CORS check would otherwise reject them.
3. Initializes PeerJS (`initializePeer`) at `/peerjs-server`, for voice/video call signalling.
4. Initializes all Socket.io event handlers (`initializeSocket`).
5. Attaches `io` to every request as `req.io`, so any controller can broadcast real-time events without importing socket logic directly.
6. Connects to the database (`db.sequelize.authenticate()`). **Important:** `db.sequelize.sync()` — which would auto-create/alter tables from model definitions — only runs when `NODE_ENV !== "production"`. In production, schema changes must go through a migration; nothing is auto-created.
7. Applies global middleware in order: CORS → cookie parser → JSON/urlencoded body parsing → Passport init → security headers (CSP, X-Frame-Options, HSTS, etc., stricter in production) → audit middleware → static file serving (`/uploads`, and the admin dashboard's `admin/dist`).
8. Mounts all API routers under `/api/*` (see §6).
9. Any non-`/api` request falls through to the admin dashboard's `index.html` (SPA fallback routing).
10. Starts the HTTP server, then calls `createAdminIfEmpty()` to seed a default admin account if none exists.

A `TrackingCleanupJob` (`jobs/trackingCleanupJob.js`, `node-cron`) is started immediately as part of module load, independent of the above sequence.

---

## 6. REST API Reference

All routes are mounted under `/api/<prefix>` as shown. Unless noted, `passport.authenticate("jwt")` is required (either per-route or via `router.use(...)` at the top of the file) — this validates an RS256-signed JWT from either the `Authorization: Bearer` header or the `accessToken` cookie.

### 6.1 `/api/auth` — `routes/auth.js` → `authController.js`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/signup` | — | Register a new user (driver or guardian), sends email OTP |
| POST | `/login` | — | Email/password login; sets `accessToken`/`refreshToken` httpOnly cookies; enforces login-attempt lockout |
| POST | `/refresh-token` | cookie | Issue a new access token from a valid refresh token |
| POST | `/logout` | — | Clears cookies, revokes refresh token |
| POST | `/forgot-password` | — | Emails a password reset link |
| POST | `/reset-password` | — | Completes password reset via emailed token |
| GET | `/validate-reset-token` | — | Checks a reset token's validity before showing the reset form |
| PATCH | `/change-password` | JWT + rate-limited | Authenticated password change |
| POST | `/send-verification-otp` | — | (Re)send an email verification OTP |
| POST | `/verify-email-otp` | — | Verify the 6-digit email OTP |
| POST | `/resend-verification-otp` | — | Resend OTP, resets attempt counter |
| GET | `/check-email-verification/:email` | — | Check if an email is already verified |
| GET | `/otp-status/:email` | — | OTP existence/expiry/remaining-attempts status |
| GET | `/locked-accounts` | admin/super-admin | List all currently locked accounts |
| POST | `/unlock-account/:userId` | admin/super-admin | Manually unlock one account |
| POST | `/unlock-all-accounts` | admin/super-admin | Bulk-unlock all locked accounts |
| GET | `/account-status` | JWT | Current user's lock/attempt status |
| GET | `/me` | JWT | Current authenticated user's basic info |

### 6.2 `/api/users` — `routes/user.js` → `userController.js`

All routes require JWT (`router.use(passport.authenticate(...))` applies to the whole file).

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/all-users` | any authenticated | List all users |
| GET | `/all-students` | admin, driver | List all students |
| GET | `/student/:id` | admin, guardian | Get one student |
| GET | `/all-roles` | any | List roles |
| GET | `/all-guardians` | admin, driver | List all guardians |
| GET | `/guardian/:id` | admin, guardian | Get one guardian |
| GET | `/all-drivers` | admin, driver, guardian | List all drivers |
| PATCH | `/update-status/:id` | admin | Update a user's active/status field |
| PATCH | `/update-user/:id` | admin | Update user fields |
| PATCH | `/bulk-deactivate` | admin | Deactivate multiple users |
| PATCH | `/bulk-activate` | admin | Activate multiple users |
| PATCH | `/deactivate-user/:id` | admin | Deactivate one user |
| PATCH | `/activate-user/:id` | admin | Activate one user |
| GET | `/my-profile` | any | Current user's profile + role-specific details (guardian/driver record) |
| GET | `/guardian-students` | guardian, driver | Guardian's own students (with route/vehicle/driver nested) |
| PATCH | `/update-driver/:id` | driver | Update driver record |
| POST | `/create-user` | admin | Admin-created user (auto-generated password, invite token) |
| POST | `/add-student` | any | Guardian adds an additional student to their own account |
| POST | `/create-driver-profile` | driver | One-time driver profile + vehicle setup (multipart: profile/vehicle images) |
| POST | `/create-guardian-profile` | any | One-time guardian profile + first student setup |
| POST | `/subscribe` | any | Sets `guardians.isSubscribed = true` for the calling guardian (see §9) |

### 6.3 `/api/vehicles` — `routes/vehicles.js` → `vehicleController.js`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/add-vehicle` | driver | Register a vehicle (multipart image upload) |
| PATCH | `/update-vehicle/:id` | driver | Update vehicle |
| GET | `/vehicle/:id` | driver | Get one vehicle |
| GET | `/driver-vehicles` | any | Vehicles belonging to the current driver |
| GET | `/all-vehicles` | any | All vehicles |
| GET | `/all-available-vehicles` | any | Vehicles not currently assigned/active on a route |
| GET | `/vehicle-statistics` | admin | Fleet statistics |

### 6.4 `/api/vehicleroutes` — `routes/vehicleRoutes.js` → `vehicleRouteController.js`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/create-vehicle-route` | driver | Create a route |
| PATCH | `/update-vehicle-route/:id` | driver | Update route |
| PATCH | `/add-stop-to-route/:routeId` | driver | Add a stop |
| PATCH | `/update-vehicle-stop/:stopId` | driver | Update a stop |
| GET | `/vehicle-driver-route` | driver | Route(s) assigned to current driver |
| GET | `/vehicle-route/:id` | driver, guardian | Get one route |
| GET | `/all-vehicle-routes` | driver | List all routes |
| GET | `/route-schedule/:routeId` | driver, guardian | Today's schedule for a route |
| DELETE | `/delete-vehicle-stop/:stopId` | any | Delete a stop |
| DELETE | `/delete-route/:id` | driver | Delete a route |
| PATCH | `/reorder-vehicle-stops/:routeId` | driver | Reorder stops |

### 6.5 `/api/driverassignment` — `routes/vehicleDriverAssignment.js` → `vehicleToDriverAssignmentController.js`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/assign-driver` | admin | Assign a vehicle to a driver |
| PATCH | `/update-driver-assignment/:id` | admin | Update the assignment |
| GET | `/all-driver-assignments` | admin, driver | List assignments |
| GET | `/my-buses` | driver | Vehicles assigned to current driver |

### 6.6 `/api/guardian-requests` — `routes/guardianRequests.js` → `guardianRequestController.js`

Whole-file JWT required.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/create-request` | guardian | Guardian requests to join a driver's route |
| PATCH | `/approve-request/:requestId` | driver | Driver approves — likely where route/stop assignment actually happens |
| PATCH | `/reject-request/:requestId` | driver | Driver rejects |
| PATCH | `/cancel-request/:requestId` | guardian | Guardian cancels their own request |
| GET | `/all-driver-requests` | driver | Pending requests for this driver |
| GET | `/all-guardian-requests` | guardian | This guardian's own requests |

### 6.7 `/api/vehicle-tracking` — `routes/vehicleTracking.js` → `vehicleTrackingController.js`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/record-location` | **none** | GPS device/driver app posts a location ping |
| GET | `/current-location/:vehicleId` | admin, guardian, driver | Latest known location |
| GET | `/tracking-history/:vehicleId` | admin, senior-teacher, sports-director | Historical location log |
| GET | `/active-vehicles` | admin, senior-teacher, sports-director, driver | All vehicles currently moving |
| GET | `/eta/:vehicleId/:stopId` | admin, senior-teacher, sports-director, driver | ETA calculation to a stop |
| GET | `/check-delay/:vehicleId/:routeId` | admin, senior-teacher, sports-director | Delay check against schedule |
| GET | `/driver/current-vehicle` | driver | Driver's own current vehicle location |
| GET | `/public/track/:vehicleId` | **none** | Public tracking link (intentionally unauthenticated) |

> Two endpoints (`/record-location`, `/public/track/:vehicleId`) are intentionally public — worth confirming this is deliberate given they expose/accept live location data without auth.

### 6.8 `/api/student-tracking` — `routes/studentTracking.js` → `studentTrackingController.js`

Whole-file JWT required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/my-students` | Guardian's students' current locations |
| GET | `/student/:studentId/location` | One student's location (via their assigned vehicle) |
| GET | `/student/:studentId/stream` | Server-Sent-Events style streaming endpoint for live updates |
| GET | `/student/:studentId/stop-details` | Pickup/dropoff stop info for a student |
| GET | `/route/:routeId/students` | All students on a given route |

### 6.9 `/api/vehicle-alerts` — `routes/vehicleAlerts.js` → `vehicleAlertController.js`

Route order is deliberately significant here (specific paths registered before `/:id` — noted in the file's own comments) to avoid Express matching `/unread/count` as an `:id` parameter.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/unread/count` | admin, senior-teacher, sports-director, driver, guardian | Unread alert count |
| POST | `/mark-all-read` | (same) | Mark all as read |
| GET | `/active` | (same) | Active alerts only |
| GET | `/statistics` | admin, senior-teacher, sports-director | Alert stats |
| GET | `/` | admin, driver, guardian | All alerts, filterable |
| PATCH | `/:id/read` | admin, driver, guardian | Mark one alert read |
| GET | `/:id` | admin, senior-teacher, sports-director, driver, guardian | One alert |
| PATCH | `/:id/resolve` | admin, driver | Resolve an alert |
| PATCH | `/:id/dismiss` | admin, driver | Dismiss an alert |

### 6.10 `/api/messages` — `routes/messages.js` → `messagesController.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations` | List current user's conversations |
| POST | `/conversations/private/:userId` | Get-or-create a 1:1 conversation |
| POST | `/conversations/route` | Create a route-based group channel |
| GET | `/conversations/available-routes` | Routes eligible for a new channel |
| GET | `/conversations/:conversationId/messages` | Message history |
| POST | `/conversations/:conversationId/messages` | Send a message (multipart, supports attachments) |
| PUT | `/conversations/:conversationId/read` | Mark conversation read |
| DELETE | `/messages/:messageId` | Delete a message |
| DELETE | `/conversations/:conversationId/leave` | Leave a conversation |
| GET | `/messages/:messageId/attachments` | List a message's attachments |
| GET | `/attachments/:attachmentId/download` | Download an attachment |
| GET | `/conversations/route-channels` | Guardian's route-based channels |
| GET | `/driver/routes` | Driver's routes (for channel creation) |
| GET | `/driver/routes/:routeId/guardians` | Guardians on a given route |

### 6.11 `/api/notifications` — `routes/notifications.js` → `notificationController.js`

| Method | Path | Purpose |
|---|---|---|
| GET | `/my-notifications` | Current user's notifications |
| PATCH | `/:id/read` | Mark one as read |
| PATCH | `/mark-all-read` | Mark all as read |

### 6.12 `/api/announcements` — `routes/announcements.js` → `announcementsController.js`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/create-announcement` | admin | Create |
| PATCH | `/update-announcement/:id` | admin | Update |
| GET | `/get-all-announcements` | any | List |
| GET | `/get-announcement/:id` | any | Get one |
| DELETE | `/delete-announcement/:id` | admin | Delete |

### 6.13 `/api/push-tokens` — `routes/pushnotifications.js` → `pushNotificationsController.js`

Whole-file JWT required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/all-push-tokens` | List tokens (admin use) |
| DELETE | `/unregister-push-token` | Remove current device's token |
| POST | `/register-push-token` | Register current device's Expo push token |

### 6.14 `/api/auditlogs` — `routes/auditlogs.js` → `auditLogsController.js`

All admin-only.

| Method | Path | Purpose |
|---|---|---|
| GET | `/all-logs` | List all audit logs |
| GET | `/logs-statistics` | Aggregate stats |
| GET | `/search-logs` | Search/filter |
| GET | `/export-logs` | Export |
| GET | `/user/:userId` | One user's audit trail |
| GET | `/entity/:entity/:entityId` | One entity's history |
| GET | `/audit-log/:id` | One log entry |
| DELETE | `/audit-logs-cleanup` | Purge old logs |

---

## 7. Real-Time Layer

### 7.1 Socket.io (`socket/socketHandler.js`)

Connection setup is room-based. Key rooms a client can join:

| Event (client → server) | Room joined | Purpose |
|---|---|---|
| `join-user` | `user-{userId}` | Personal notification channel |
| `join-role` | `role-{roleId}` | Role-wide broadcasts |
| `join-admin` | `admin-room` | Admin dashboard broadcasts |
| `join-conversation` / `leave-conversation` | `conversation-{id}` | Chat |
| `join-discussion` / `leave-discussion` | `discussion-{id}` | (Discussion feature — no dedicated route file was found for this; likely handled entirely via sockets, or a planned/partial feature) |
| `join-vehicle-tracking` / `leave-vehicle-tracking` | `vehicle-tracking` | Global live-tracking feed |
| `join-vehicle` / `leave-vehicle` | `vehicle-{id}` | Track one specific vehicle |
| `join-driver` / `leave-driver` | `driver-{id}` | Driver-targeted events |

Driver-initiated events broadcast to guardians (via `services/vehicleNotificationService.js`):

`vehicle-started`, `vehicle-location-update`, `vehicle-stop-arrival`, `vehicle-departure`, `vehicle-delayed`, `vehicle-eta-update`, `vehicle-route-update`, `driver-sos`, `trip-ended`, `driver-assigned`, `route-assigned`

Chat-related: `typing` → `user-typing`, `mark-read` → `message-read`

Voice/video call signalling: `call-vehicley`, `accept-call` → `call-accepted`, `reject-call` → `call-rejected`, `end-call` → `call-ended`, plus `register-peer-id` → `peer-id-registered` (bridges a user's socket connection to their PeerJS peer ID for call routing)

### 7.2 PeerJS (`socket/peerHandler.js`)

A standalone PeerJS signalling server is mounted at `/peerjs-server` (via `ExpressPeerServer`), used for WebRTC voice/video calls between drivers and guardians. `proxied`/`debug` flags are environment-aware (stricter in production).

---

## 8. Background Jobs & Services

- **`jobs/trackingCleanupJob.js`** — `node-cron`-scheduled job (starts on server boot), purges old `vehicletracking` rows via `services/trackingCleanupService.js` to keep the table from growing unbounded.
- **`services/vehicleMonitoringService.js`, `services/studentTrackingService.js`** — class-based services (each exported as a singleton instance) supporting the tracking controllers.
- **`services/notificationService.js`** — generic notification creation/delivery (`createNotification`, `notifyUser`, `notifyMultipleUsers`, `notifyRole`, `notifyGuardiansOnVehicle`, etc.), used across almost every other feature area.
- **`services/pushNotificationService.js`** — wraps `expo-server-sdk` to actually deliver push notifications to registered device tokens.
- **`services/messageNotificationService.js`, `services/announcementsNotificationService.js`, `services/vehicleNotificationService.js`** — feature-specific notification message builders, layered on top of `notificationService.js`.
- **`services/notificationMessages.js`** — centralized notification copy/templates by category (assignments, announcements, vehicle alerts, messaging, procurement, guardian requests).

---

## 9. Subscription System — Two Parallel Implementations

This codebase currently contains **two separate, unconnected subscription mechanisms** for guardians. This is worth resolving deliberately rather than leaving both in place.

### 9.1 Simple flag-based system (on `guardians` table)

- Columns: `guardians.isSubscribed` (boolean), `guardians.subscriptionPlan` (enum: basic/family/premium), `guardians.subscriptionExpiresAt` (date)
- Endpoint: `POST /api/users/subscribe` (`userController.subscribeGuardian`) — sets `isSubscribed = true`, a fixed 30-day expiry, and the chosen plan name. No payment reference, no plan pricing lookup, no renewal/cancellation flow.
- This is what the guardian mobile app currently gates on: `App.js`'s navigator checks `guardianProfile?.isSubscribed` and routes to `SubscriptionScreen` until it's `true`.
- **This is the only one of the two systems currently wired up end-to-end.**

### 9.2 Full plan-based system (`subscriptionplans` + `usersubscriptions`)

- Proper relational design: a `subscriptionplans` table (name, price, duration, active flag) and a `usersubscriptions` table tracking actual subscription periods per guardian, with `status` (`active`/`expired`/`cancelled`/`pending_payment`), `startDate`/`endDate`, `paymentReference`, `paymentMethod`, `amountPaid`, `currency`, `autoRenew`, `cancelledAt`.
- Controller: `controllers/subscriptionController.js`, exporting `getPlans`, `getMySubscription`, `subscribePlan`, `cancelSubscription`, `requireSubscription` (a reusable Express middleware), and `expireSubscriptions` (an expiry-sweeping function, presumably meant to run as a scheduled job like `trackingCleanupJob`).
- **This entire controller is currently dead code — it is never `require`'d anywhere in the project, and there is no `routes/subscriptions.js` mounting it in `index.js`.** None of its endpoints are reachable.
- It also contains two bugs that would surface immediately if wired up:
  - `module.exports` exports `getMySubscription`, but the function is actually defined as `getMySubscrition` (typo) — this throws a `ReferenceError` the moment the file is `require`'d, since `getMySubscription` doesn't exist in scope.
  - `subscribePlan` looks up the requested plan via `UserSubscription.findOne({ where: { id: planId, isActive: true } })` — this queries the wrong model; it should query `SubscriptionPlan`, not `UserSubscription` (which also has no `isActive` column).

### 9.3 Recommendation

Decide which system is the intended long-term design — the plan-based system (§9.2) is clearly the more complete, production-ready design (real pricing, payment tracking, renewal/cancellation), but needs the typo and model-lookup bugs fixed and an actual route file created and mounted before it can replace the simpler flag-based system currently in use. Migrating the mobile app's gating logic (`App.js`, `SubscriptionScreen.js`) to call the plan-based endpoints instead of `/api/users/subscribe` would be the natural next step once §9.2 is fixed and wired up.

---

## 10. Known Issues

| # | Issue | Status |
|---|---|---|
| 1 | `userController.subscribeGuardian` was defined after `module.exports`, so it was never exported | **Fixed** during this documentation pass |
| 2 | `routes/user.js`'s `/subscribe` route was registered after `module.exports = router`, so it never actually mounted (and would have crashed Express on startup once the controller export was fixed, since the handler resolved to `undefined`) | **Fixed** during this documentation pass |
| 3 | `subscriptionController.js` has a typo (`getMySubscrition` vs. exported `getMySubscription`) that throws immediately on `require` | **Not fixed** — file is currently unused, so the bug is dormant; see §9.3 |
| 4 | `subscriptionController.subscribePlan` queries the wrong model (`UserSubscription` instead of `SubscriptionPlan`) when validating a plan ID | **Not fixed** — same as above |
| 5 | The entire plan-based subscription system (§9.2) is unreachable — no route file mounts it | **Not fixed** — needs a decision on §9.3 first |
| 6 | `OTPVerificationScreen` (mobile guardian app) doesn't navigate anywhere after a successful email verification, and `verifyEmailVerification` doesn't set `isAuthenticated` — a newly-verified user has no automatic path forward and must back out to the login screen manually | **Not fixed** — frontend issue, flagged for awareness |
| 7 | Two vehicle-tracking endpoints (`POST /record-location`, `GET /public/track/:vehicleId`) are intentionally unauthenticated | Confirm this is deliberate given they handle live location data |
| 8 | `.env` contains `JWT_SECRET`/`JWT_REFRESH_SECRET`, but the actual token signing mechanism found in `config/passport.js`/`authHelpers.js` uses an RS256 public/private key pair — worth confirming whether those two env vars are legacy/unused | Needs verification against `utils/authHelpers.js` internals |
| 9 | `join-discussion`/`leave-discussion` socket events exist with no corresponding REST routes or controller found anywhere in the backend | Likely an in-progress or planned feature |

---

## 11. Guardian Mobile App — Subscription Gate (Frontend Integration)

For reference, the guardian React Native app's navigation flow (`App.js`) currently gates access as follows:

```
Not authenticated → Login / Signup / OTP screens
       ↓ (login)
Authenticated, no guardian profile → SetProfileScreen
       ↓
Profile set, no students → FindDriverScreen
       ↓
Has students, not subscribed → SubscriptionScreen  ← gates on guardians.isSubscribed
       ↓
Subscribed → MainTabs (full app)
```

`SubscriptionScreen` calls `POST /api/users/subscribe` (via a `subscribeGuardian` thunk in `UserSlice.js`) with a chosen plan name (`basic`/`family`/`premium`), and the backend sets the three flag columns described in §9.1.

---

*Document generated from a review of the `backend/` source on 2026-08-27. Reflects the codebase as of that date; re-verify sections after significant changes, particularly §9 (subscriptions) and §10 (known issues) once resolved.*
