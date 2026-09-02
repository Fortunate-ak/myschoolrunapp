/**
 * utils/socket.js — Guardian App
 *
 * Architecture
 * ────────────
 * This is the guardian-side mirror of the driver's socket.js.
 * The same backend (socketHandler.js) serves both apps over the same
 * socket.io server.  The key difference is what *rooms* each app joins:
 *
 *   Driver app joins:
 *     join-user, join-driver, join-vehicle, join-vehicle-tracking
 *
 *   Guardian app joins:
 *     join-user            → personal notifications & messages
 *     join-vehicle <id>    → real-time tracking of the child's vehicle
 *     join-vehicle-tracking→ global tracking room (all active vehicles)
 *
 * The guardian NEVER emits driver events (vehicle-location-update,
 * vehicle-started, etc.). It only listens to them.
 *
 * Events received (from backend re-broadcast of driver emits):
 *   vehicle-location-update   → driver GPS every ~2 s
 *   vehicle-started           → trip started
 *   vehicle-stop-arrival      → driver arrived at a stop
 *   vehicle-approaching-stop  → ~arriving soon, with etaMinutes
 *   vehicle-departure         → driver left a stop
 *   vehicle-eta-update        → ETA to next stop updated
 *   vehicle-delayed           → trip running late
 *   vehicle-alert             → speed / safety alert
 *   trip-ended                → trip finished
 *   driver-sos                → emergency alert
 *   new-notification          → push-style in-app notification
 *   new-announcement          → broadcast from admin/school
 *   new-message               → incoming chat message
 *   user-typing               → typing indicator in chat
 *   message-read              → read receipt in chat
 *   guardian-request-update   → status update on a join request
 *
 * Guardian emits (outbound from guardian to server):
 *   join-user, join-vehicle, leave-vehicle
 *   join-conversation, leave-conversation, typing, mark-read
 */

import { io } from "socket.io-client";

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

// ── Module-level singleton state ──────────────────────────────────────────────
let socket = null;
let isDisconnecting = false;

// Rooms the guardian is currently in — restored after reconnect
let currentUserId = null;
let currentVehicleIds = new Set(); // guardians can track multiple children's vehicles

let watchdogInterval = null;
let lastPing = Date.now();

// ── Init ──────────────────────────────────────────────────────────────────────
export const initGuardianSocket = () => {
  if (socket?.connected && !isDisconnecting) {
    console.log("[GuardianSocket] Already connected");
    return socket;
  }

  if (isDisconnecting) {
    console.log("[GuardianSocket] Disconnecting, skipping init");
    return null;
  }

  console.log("[GuardianSocket] Initialising connection to:", SOCKET_URL);

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 2000,
    timeout: 30000,
    path: "/socket.io",
    forceNew: false,
    withCredentials: true, // sends HttpOnly session cookie — same as driver app
  });

  // ── Connection lifecycle ──────────────────────────────────────────────────
  socket.on("connect", () => {
    if (isDisconnecting) return;
    lastPing = Date.now();

    console.log("[GuardianSocket] Connected:", socket.id);

    // Always join the global tracking room so we receive all vehicle updates
    socket.emit("join-vehicle-tracking");

    // Rejoin personal room
    if (currentUserId) {
      socket.emit("join-user", currentUserId);
      console.log("[GuardianSocket] 🔁 Rejoined user room:", currentUserId);
    }

    // Rejoin any vehicle rooms (one per child being tracked)
    for (const vehicleId of currentVehicleIds) {
      socket.emit("join-vehicle", vehicleId);
      console.log("[GuardianSocket] 🔁 Rejoined vehicle room:", vehicleId);
    }
  });

  socket.on("connected", (data) => {
    console.log("[GuardianSocket] Server confirmed:", data);
    lastPing = Date.now();
  });

  socket.on("connect_error", (err) => {
    console.warn("[GuardianSocket] ❌ Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("[GuardianSocket] Disconnected:", reason);
    // The server closed the connection intentionally (e.g. logout on server side)
    if (reason === "io server disconnect") {
      setTimeout(() => {
        if (socket && !isDisconnecting) socket.connect();
      }, 1000);
    }
  });

  socket.on("reconnect", (n) => {
    if (!isDisconnecting)
      console.log("[GuardianSocket] Reconnected after", n, "attempts");
  });

  socket.io.on("reconnect_attempt", (n) => {
    console.log(`[GuardianSocket] 🔄 Reconnect attempt ${n}`);
  });

  socket.io.on("reconnect_failed", () => {
    console.warn("[GuardianSocket] 🚨 All reconnect attempts exhausted");
  });

  // ── Watchdog events — any of these firing keeps the connection alive ──────
  const watchdogEvents = [
    "vehicle-location-update",
    "vehicle-started",
    "vehicle-stop-arrival",
    "vehicle-approaching-stop",
    "vehicle-departure",
    "vehicle-eta-update",
    "vehicle-delayed",
    "vehicle-alert",
    "trip-ended",
    "driver-sos",
    "new-notification",
    "new-announcement",
    "new-message",
    "user-typing",
    "message-read",
    "guardian-request-update",
  ];

  watchdogEvents.forEach((ev) => {
    socket.on(ev, () => {
      lastPing = Date.now();
    });
  });

  _startWatchdog();

  return socket;
};

// ── Watchdog ──────────────────────────────────────────────────────────────────
const _startWatchdog = () => {
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (!socket || isDisconnecting) return;
    if (socket.io._reconnecting) return;
    if (!socket.connected && Date.now() - lastPing > 60_000) {
      console.warn(
        "[GuardianSocket] ⚠️ No activity for 60 s — forcing reconnect",
      );
      forceReconnect();
    }
  }, 30_000);
};

const _stopWatchdog = () => {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
};

// ── Room helpers ──────────────────────────────────────────────────────────────

/** Join the guardian's personal notification / message room. */
export const joinUserRoom = (userId) => {
  if (!socket || isDisconnecting) return;
  currentUserId = userId;
  const join = () => socket.emit("join-user", userId);
  socket.connected ? join() : socket.once("connect", join);
};

export const leaveUserRoom = () => {
  if (!socket || isDisconnecting) return;
  if (currentUserId && socket.connected)
    socket.emit("leave-user", currentUserId);
  currentUserId = null;
};

/**
 * Subscribe to a specific vehicle's real-time updates.
 * Call this for every child the guardian is tracking (one per child's vehicle).
 */
export const joinVehicleRoom = (vehicleId) => {
  if (!socket || isDisconnecting || !vehicleId) return;
  currentVehicleIds.add(vehicleId);
  const join = () => {
    socket.emit("join-vehicle", vehicleId);
    console.log("[GuardianSocket] Joined vehicle room:", vehicleId);
  };
  socket.connected ? join() : socket.once("connect", join);
};

/** Unsubscribe from a specific vehicle (e.g. child got off the bus). */
export const leaveVehicleRoom = (vehicleId) => {
  if (!socket || isDisconnecting || !vehicleId) return;
  currentVehicleIds.delete(vehicleId);
  if (socket.connected) {
    socket.emit("leave-vehicle", vehicleId);
    console.log("[GuardianSocket] Left vehicle room:", vehicleId);
  }
};

/** Leave ALL vehicle rooms at once (e.g. on logout). */
export const leaveAllVehicleRooms = () => {
  if (!socket || isDisconnecting) return;
  for (const vehicleId of currentVehicleIds) {
    if (socket.connected) socket.emit("leave-vehicle", vehicleId);
  }
  currentVehicleIds.clear();
};

// ── Listener factory ──────────────────────────────────────────────────────────
// Identical pattern to driver socket.js so consumers look the same.
const _makeListeners = (event, label) => ({
  on: (cb) => {
    if (socket && !isDisconnecting) {
      socket.on(event, cb);
      console.log(`[GuardianSocket] Registered ${label} listener`);
    }
    return cb;
  },
  off: (cb) => {
    if (socket && !isDisconnecting) {
      cb ? socket.off(event, cb) : socket.off(event);
      console.log(`[GuardianSocket] Removed ${label} listener`);
    }
  },
});

// ── Inbound tracking events (driver → server → guardian) ─────────────────────
const _locationUpdate = _makeListeners(
  "vehicle-location-update",
  "vehicle-location-update",
);
const _vehicleStarted = _makeListeners("vehicle-started", "vehicle-started");
const _stopArrival = _makeListeners(
  "vehicle-stop-arrival",
  "vehicle-stop-arrival",
);
const _approachingStop = _makeListeners(
  "vehicle-approaching-stop",
  "vehicle-approaching-stop",
);
const _departure = _makeListeners("vehicle-departure", "vehicle-departure");
const _etaUpdate = _makeListeners("vehicle-eta-update", "vehicle-eta-update");
const _delayed = _makeListeners("vehicle-delayed", "vehicle-delayed");
const _vehicleAlert = _makeListeners("vehicle-alert", "vehicle-alert");
const _tripEnded = _makeListeners("trip-ended", "trip-ended");
const _driverSOS = _makeListeners("driver-sos", "driver-sos");
const _routeUpdate = _makeListeners(
  "vehicle-route-update",
  "vehicle-route-update",
);

// ── Inbound notification / messaging events ───────────────────────────────────
const _newNotification = _makeListeners("new-notification", "new-notification");
const _newAnnouncement = _makeListeners("new-announcement", "new-announcement");
const _newMessage = _makeListeners("new-message", "new-message");
const _userTyping = _makeListeners("user-typing", "user-typing");
const _messageRead = _makeListeners("message-read", "message-read");

// ── Guardian-specific inbound events ─────────────────────────────────────────
// Backend emits these when a guardian's route-join request is processed.
const _guardianRequestUpdate = _makeListeners(
  "guardian-request-update",
  "guardian-request-update",
);

// ── Exported listener pairs ───────────────────────────────────────────────────

// Tracking
export const onVehicleLocationUpdate = (cb) => _locationUpdate.on(cb);
export const offVehicleLocationUpdate = (cb) => _locationUpdate.off(cb);

export const onVehicleStarted = (cb) => _vehicleStarted.on(cb);
export const offVehicleStarted = (cb) => _vehicleStarted.off(cb);

export const onVehicleStopArrival = (cb) => _stopArrival.on(cb);
export const offVehicleStopArrival = (cb) => _stopArrival.off(cb);

export const onVehicleApproachingStop = (cb) => _approachingStop.on(cb);
export const offVehicleApproachingStop = (cb) => _approachingStop.off(cb);

export const onVehicleDeparture = (cb) => _departure.on(cb);
export const offVehicleDeparture = (cb) => _departure.off(cb);

export const onVehicleEtaUpdate = (cb) => _etaUpdate.on(cb);
export const offVehicleEtaUpdate = (cb) => _etaUpdate.off(cb);

export const onVehicleDelayed = (cb) => _delayed.on(cb);
export const offVehicleDelayed = (cb) => _delayed.off(cb);

export const onVehicleAlert = (cb) => _vehicleAlert.on(cb);
export const offVehicleAlert = (cb) => _vehicleAlert.off(cb);

export const onTripEnded = (cb) => _tripEnded.on(cb);
export const offTripEnded = (cb) => _tripEnded.off(cb);

export const onDriverSOS = (cb) => _driverSOS.on(cb);
export const offDriverSOS = (cb) => _driverSOS.off(cb);

export const onVehicleRouteUpdate = (cb) => _routeUpdate.on(cb);
export const offVehicleRouteUpdate = (cb) => _routeUpdate.off(cb);

// Notifications / messaging
export const onNewNotification = (cb) => _newNotification.on(cb);
export const offNewNotification = (cb) => _newNotification.off(cb);

export const onNewAnnouncement = (cb) => _newAnnouncement.on(cb);
export const offNewAnnouncement = (cb) => _newAnnouncement.off(cb);

export const onNewMessage = (cb) => _newMessage.on(cb);
export const offNewMessage = (cb) => _newMessage.off(cb);

export const onUserTyping = (cb) => _userTyping.on(cb);
export const offUserTyping = (cb) => _userTyping.off(cb);

export const onMessageRead = (cb) => _messageRead.on(cb);
export const offMessageRead = (cb) => _messageRead.off(cb);

// Guardian-specific
export const onGuardianRequestUpdate = (cb) => _guardianRequestUpdate.on(cb);
export const offGuardianRequestUpdate = (cb) => _guardianRequestUpdate.off(cb);

// ── Guardian outbound emits ───────────────────────────────────────────────────
// Guardians ONLY emit messaging / conversation events.
// They NEVER emit vehicle/driver events — those come from the driver app.

const _guardianEmit = (event, data) => {
  if (!socket || !socket.connected || isDisconnecting) {
    console.warn(`[GuardianSocket] Cannot emit ${event} — not connected`);
    return false;
  }
  socket.emit(event, data);
  return true;
};

/** Join a chat conversation room. */
export const joinConversation = (conversationId) =>
  _guardianEmit("join-conversation", conversationId);

/** Leave a chat conversation room. */
export const leaveConversation = (conversationId) =>
  _guardianEmit("leave-conversation", conversationId);

/**
 * Send typing indicator.
 * Backend re-emits as "user-typing" to the conversation room.
 */
export const sendTyping = (conversationId, isTyping) =>
  _guardianEmit("typing", { conversationId, isTyping });

/**
 * Mark a message as read.
 * Backend re-emits as "message-read" to the conversation room.
 */
export const markMessageRead = (conversationId, messageId) =>
  _guardianEmit("mark-read", { conversationId, messageId });

// ── General utilities ─────────────────────────────────────────────────────────

export const offEvent = (event, cb) => {
  if (!socket || isDisconnecting) return;
  cb ? socket.off(event, cb) : socket.off(event);
};

export const forceReconnect = () => {
  if (!socket || isDisconnecting) return;
  console.log("[GuardianSocket] ⚡ Force reconnecting…");
  _stopWatchdog();
  socket.disconnect();
  setTimeout(() => {
    if (!socket || isDisconnecting) {
      _startWatchdog();
      return;
    }
    lastPing = Date.now();
    socket.connect();
    _startWatchdog();
  }, 2000);
};

/** Returns true only if the socket is open and healthy. */
export const isSocketHealthy = () =>
  !!(socket && socket.connected && !isDisconnecting);

/** Disconnect cleanly (call on logout). */
export const disconnectGuardianSocket = () => {
  if (!socket) return;
  isDisconnecting = true;
  _stopWatchdog();
  currentUserId = null;
  currentVehicleIds.clear();
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  console.log("[GuardianSocket] Disconnected and cleaned up");
  setTimeout(() => {
    isDisconnecting = false;
  }, 500);
};

/** Raw socket access (use sparingly — prefer the typed helpers above). */
export const getSocket = () => socket;
