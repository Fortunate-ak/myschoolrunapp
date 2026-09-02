import { io } from "socket.io-client";

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

let socket = null;
let isDisconnecting = false;

let currentUserId = null;
let currentVehicleId = null; // was referenced as vehicleId in scope bugs
let currentDriverId = null;

let watchdogInterval = null;
let lastPing = Date.now();

export const initSocket = () => {
  if (socket?.connected && !isDisconnecting) {
    console.log("[Socket] Already connected");
    return socket;
  }

  if (isDisconnecting) {
    console.log("[Socket] Disconnecting, skipping init");
    return null;
  }

  console.log("[Socket] Initializing connection to:", SOCKET_URL);

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 2000,
    timeout: 30000,
    path: "/socket.io",
    forceNew: false,
    withCredentials: true,
  });

  socket.on("connect", () => {
    if (isDisconnecting) return;
    lastPing = Date.now();

    // Always join the global vehicle-tracking room on (re)connect
    socket.emit("join-vehicle-tracking");
    console.log("[Socket] Joined vehicle-tracking room");

    // Re-join any rooms that were active before disconnect
    if (currentUserId) {
      socket.emit("join-user", currentUserId);
      console.log("[Socket] 🔁 Rejoined user room:", currentUserId);
    }

    if (currentDriverId) {
      socket.emit("join-driver", currentDriverId);
      console.log("[Socket] 🔁 Rejoined driver room:", currentDriverId);
    }

    if (currentVehicleId) {
      socket.emit("join-vehicle", currentVehicleId);
      console.log("[Socket] 🔁 Rejoined vehicle room:", currentVehicleId);
    }
  });

  socket.on("connected", (data) => {
    console.log("[Socket] Server confirmed connection:", data);
    lastPing = Date.now();
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] ❌ Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.warn("[Socket] Disconnected:", reason);
    if (reason === "io server disconnect") {
      setTimeout(() => {
        if (socket && !isDisconnecting) {
          socket.connect();
        }
      }, 1000);
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    if (!isDisconnecting) {
      console.log("[Socket] Reconnected after", attemptNumber, "attempts");
    }
  });

  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`[Socket] 🔄 Reconnect attempt ${attempt}`);
  });

  socket.io.on("reconnect_failed", () => {
    console.warn("[Socket] 🚨 Reconnect failed completely");
  });

  // All watchdog events — any of these firing means the connection is alive
  const watchdogEvents = [
    "vehicle-location-update",
    "vehicle-arrival",
    "vehicle-departure",
    "vehicle-eta-update",
    "new-notification",
    "new-announcement",
    "vehicle-alert",
    "guardian-request",
    "route-stop-request",
    "new-message",
    "vehicle-started",
    "vehicle-stop-arrival",
    "trip-ended",
    "user-typing",
  ];

  watchdogEvents.forEach((ev) => {
    socket.on(ev, () => {
      lastPing = Date.now();
    });
  });

  startWatchdog();

  return socket;
};

// ── Watchdog ──────────────────────────────────────────────────────────────────
const startWatchdog = () => {
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (!socket || isDisconnecting) return;
    if (socket.io._reconnecting) return;
    if (!socket.connected && Date.now() - lastPing > 60000) {
      console.warn("[Socket] ⚠️ No activity for 60s, forcing reconnect");
      forceReconnect();
    }
  }, 30000);
};

const stopWatchdog = () => {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
};

// ── Room management ───────────────────────────────────────────────────────────
export const joinUserRoom = (userId) => {
  if (!socket || isDisconnecting) return;
  currentUserId = userId;
  const join = () => socket.emit("join-user", userId);
  socket.connected ? join() : socket.once("connect", join);
};

export const leaveUserRoom = () => {
  if (!socket || isDisconnecting) return;
  if (currentUserId && socket.connected) {
    socket.emit("leave-user", currentUserId); // FIX: was referencing out-of-scope userId
  }
  currentUserId = null;
};

export const joinDriverRoom = (driverId) => {
  if (!socket || isDisconnecting) return;
  currentDriverId = driverId;
  const join = () => socket.emit("join-driver", driverId);
  socket.connected ? join() : socket.once("connect", join);
};

export const leaveDriverRoom = () => {
  if (!socket || isDisconnecting) return;
  if (currentDriverId && socket.connected) {
    socket.emit("leave-driver", currentDriverId);
  }
  currentDriverId = null;
};

export const joinVehicleRoom = (vehicleId) => {
  if (!socket || isDisconnecting) return;
  currentVehicleId = vehicleId;
  const join = () => socket.emit("join-vehicle", vehicleId);
  socket.connected ? join() : socket.once("connect", join);
};

export const leaveVehicleRoom = () => {
  if (!socket || isDisconnecting) return;
  if (currentVehicleId && socket.connected) {
    socket.emit("leave-vehicle", currentVehicleId); // FIX: was out-of-scope vehicleId
  }
  currentVehicleId = null;
};

// ── Listener helpers ──────────────────────────────────────────────────────────
const makeListeners = (event, label) => ({
  on: (cb) => {
    if (socket && !isDisconnecting) {
      socket.on(event, cb);
      console.log(`[Socket] Registered ${label} listener`);
    }
    return cb;
  },
  off: (cb) => {
    if (socket && !isDisconnecting) {
      cb ? socket.off(event, cb) : socket.off(event);
      console.log(`[Socket] Removed ${label} listener`);
    }
  },
});

const _vehicleLocationUpdate = makeListeners(
  "vehicle-location-update",
  "vehicle-location-update",
);
const _vehicleArrival = makeListeners("vehicle-arrival", "vehicle-arrival");
const _vehicleDeparture = makeListeners(
  "vehicle-departure",
  "vehicle-departure",
);
const _vehicleEtaUpdate = makeListeners(
  "vehicle-eta-update",
  "vehicle-eta-update",
);
const _newAnnouncement = makeListeners("new-announcement", "new-announcement");
const _newNotification = makeListeners("new-notification", "new-notification");
const _vehicleAlert = makeListeners("vehicle-alert", "vehicle-alert");
const _vehicleStarted = makeListeners("vehicle-started", "vehicle-started");
const _vehicleStopArrival = makeListeners(
  "vehicle-stop-arrival",
  "vehicle-stop-arrival",
);
const _vehicleApproaching = makeListeners(
  "vehicle-approaching-stop",
  "vehicle-approaching-stop",
);
const _vehicleDelayed = makeListeners("vehicle-delayed", "vehicle-delayed");
const _tripEnded = makeListeners("trip-ended", "trip-ended");
const _driverAssigned = makeListeners("driver-assigned", "driver-assigned");
const _routeAssigned = makeListeners("route-assigned", "route-assigned");
const _userTyping = makeListeners("user-typing", "user-typing");
const _messageRead = makeListeners("message-read", "message-read");
const _newMessage = makeListeners("new-message", "new-message");
const _driverSOS = makeListeners("driver-sos", "driver-sos");

// Exported listener pairs
export const onVehicleLocationUpdate = (cb) => _vehicleLocationUpdate.on(cb);
export const offVehicleLocationUpdate = (cb) => _vehicleLocationUpdate.off(cb);

export const onVehicleArrival = (cb) => _vehicleArrival.on(cb);
export const offVehicleArrival = (cb) => _vehicleArrival.off(cb);

export const onVehicleDeparture = (cb) => _vehicleDeparture.on(cb);
export const offVehicleDeparture = (cb) => _vehicleDeparture.off(cb);

export const onVehicleEtaUpdate = (cb) => _vehicleEtaUpdate.on(cb);
export const offVehicleEtaUpdate = (cb) => _vehicleEtaUpdate.off(cb);

export const onNewAnnouncement = (cb) => _newAnnouncement.on(cb);
export const offNewAnnouncement = (cb) => _newAnnouncement.off(cb);

export const onNewNotification = (cb) => _newNotification.on(cb);
export const offNewNotification = (cb) => _newNotification.off(cb);

export const onVehicleAlert = (cb) => _vehicleAlert.on(cb);
export const offVehicleAlert = (cb) => _vehicleAlert.off(cb);

export const onVehicleStarted = (cb) => _vehicleStarted.on(cb);
export const offVehicleStarted = (cb) => _vehicleStarted.off(cb);

export const onVehicleStopArrival = (cb) => _vehicleStopArrival.on(cb);
export const offVehicleStopArrival = (cb) => _vehicleStopArrival.off(cb);

export const onVehicleApproachingStop = (cb) => _vehicleApproaching.on(cb);
export const offVehicleApproachingStop = (cb) => _vehicleApproaching.off(cb);

export const onVehicleDelayed = (cb) => _vehicleDelayed.on(cb);
export const offVehicleDelayed = (cb) => _vehicleDelayed.off(cb);

export const onTripEnded = (cb) => _tripEnded.on(cb);
export const offTripEnded = (cb) => _tripEnded.off(cb);

export const onDriverAssigned = (cb) => _driverAssigned.on(cb);
export const offDriverAssigned = (cb) => _driverAssigned.off(cb);

export const onRouteAssigned = (cb) => _routeAssigned.on(cb);
export const offRouteAssigned = (cb) => _routeAssigned.off(cb);

export const onUserTyping = (cb) => _userTyping.on(cb);
export const offUserTyping = (cb) => _userTyping.off(cb);

export const onMessageRead = (cb) => _messageRead.on(cb);
export const offMessageRead = (cb) => _messageRead.off(cb);

export const onNewMessage = (cb) => _newMessage.on(cb);
export const offNewMessage = (cb) => _newMessage.off(cb);

export const onDriverSOS = (cb) => _driverSOS.on(cb);
export const offDriverSOS = (cb) => _driverSOS.off(cb);

// ── Driver emit helpers ───────────────────────────────────────────────────────
export const emitDriverEvent = (event, data) => {
  if (!socket || !socket.connected || isDisconnecting) {
    console.warn(`[Socket] Cannot emit ${event} — not connected`);
    return false;
  }
  socket.emit(event, data);
  console.log(`[Socket] Emitted ${event}:`, data);
  return true;
};

/**
 * Primary location broadcast.
 * Matches backend handler: socket.on("vehicle-location-update")
 * Backend re-broadcasts to vehicle-${vehicleId} room and vehicle-tracking room.
 * Guardians receive "vehicle-location-update" on their side.
 *
 * payload shape:
 * {
 *   vehicleId, latitude, longitude, speed (m/s),
 *   heading, routeId, timestamp, accuracy?
 * }
 */
export const emitLocationUpdate = (locationData) =>
  emitDriverEvent("vehicle-location-update", locationData);

/**
 * Driver-side alias — same backend event.
 * Named differently in the old code but points to same backend listener.
 */
export const emitDriverLocationUpdate = (locationData) =>
  emitDriverEvent("vehicle-location-update", locationData);

export const emitVehicleStarted = (vehicleId, routeId, location) =>
  emitDriverEvent("vehicle-started", {
    vehicleId,
    routeId,
    location,
    timestamp: new Date(),
  });

export const emitVehicleStopped = (vehicleId, routeId) =>
  emitDriverEvent("bus-stopped", { vehicleId, routeId, timestamp: new Date() });

export const emitStopArrival = (
  vehicleId,
  routeId,
  stopId,
  stopName,
  stopIndex,
) =>
  emitDriverEvent("vehicle-stop-arrival", {
    vehicleId,
    routeId,
    stopId,
    stopName,
    stopIndex,
    timestamp: new Date(),
  });

export const emitStopDeparture = (vehicleId, routeId, stopId, stopName) =>
  emitDriverEvent("vehicle-departure", {
    vehicleId,
    routeId,
    stopId,
    stopName,
    timestamp: new Date(),
  });

export const emitApproachingStop = (
  vehicleId,
  routeId,
  stopId,
  stopName,
  etaMinutes,
) =>
  emitDriverEvent("vehicle-approaching-stop", {
    vehicleId,
    routeId,
    stopId,
    stopName,
    etaMinutes,
    timestamp: new Date(),
  });

export const emitETAUpdate = (vehicleId, routeId, stopId, etaMinutes) =>
  emitDriverEvent("vehicle-eta-update", {
    vehicleId,
    routeId,
    stopId,
    etaMinutes,
    timestamp: new Date(),
  });

export const emitTripEnded = (
  vehicleId,
  routeId,
  finalLocation,
  completedStops,
  totalStops,
) =>
  emitDriverEvent("trip-ended", {
    vehicleId,
    routeId,
    finalLocation,
    completedStops,
    totalStops,
    timestamp: new Date(),
  });

export const emitVehicleDelayed = (
  vehicleId,
  routeId,
  stopId,
  delayMinutes,
  location,
) =>
  emitDriverEvent("vehicle-delayed", {
    vehicleId,
    routeId,
    stopId,
    delayMinutes,
    location,
    timestamp: new Date(),
  });

export const emitSOS = (
  vehicleId,
  location,
  driverName,
  driverPhone,
  reason = "emergency",
) =>
  emitDriverEvent("driver-sos", {
    vehicleId,
    location,
    driverName,
    driverPhone,
    reason,
    timestamp: new Date(),
  });

// ── Messaging helpers ─────────────────────────────────────────────────────────
export const joinConversation = (conversationId) => {
  if (socket?.connected) socket.emit("join-conversation", conversationId);
};

export const leaveConversation = (conversationId) => {
  if (socket?.connected) socket.emit("leave-conversation", conversationId);
};

export const sendTyping = (conversationId, isTyping) => {
  if (socket?.connected) socket.emit("typing", { conversationId, isTyping });
};

export const markMessageRead = (conversationId, messageId) => {
  if (socket?.connected)
    socket.emit("mark-read", { conversationId, messageId });
};

// ── General utils ─────────────────────────────────────────────────────────────
export const offEvent = (event, cb) => {
  if (!socket || isDisconnecting) return;
  cb ? socket.off(event, cb) : socket.off(event);
};

export const forceReconnect = () => {
  if (!socket || isDisconnecting) return;
  console.log("[Socket] ⚡ Force reconnecting...");
  stopWatchdog();
  socket.disconnect();
  setTimeout(() => {
    if (!socket || isDisconnecting) {
      startWatchdog();
      return;
    }
    lastPing = Date.now();
    socket.connect();
    startWatchdog();
  }, 2000);
};

export const isSocketHealthy = () =>
  !!(socket && socket.connected && !isDisconnecting); // FIX: was missing return

export const disconnectSocket = () => {
  if (!socket) return;
  isDisconnecting = true;
  stopWatchdog();
  currentUserId = null;
  currentVehicleId = null; // FIX: was currentBusId (undeclared variable)
  currentDriverId = null;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  console.log("[Socket] Disconnected");
  setTimeout(() => {
    isDisconnecting = false;
  }, 500);
};

export const getSocket = () => socket;
