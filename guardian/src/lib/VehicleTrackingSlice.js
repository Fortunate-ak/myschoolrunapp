import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

/**
 * Real-time tracking is keyed by vehicleId rather than a single set of
 * "current" fields. A guardian can have children on different buses at the
 * same time, so we need to hold live state for every vehicle they're
 * subscribed to, not just one.
 *
 * shape of state.vehicles[vehicleId]:
 * {
 *   vehicleId, routeId,
 *   latitude, longitude, speed, heading, accuracy,
 *   currentStopId, currentStopIndex, nextStopId,
 *   tripStatus: "idle" | "active" | "ended",
 *   tripStartedAt,
 *   completedStopIndexes: [],
 *   etaMinutes,
 *   delay: null | { delayMinutes, reason, ... },
 *   alert: null | {...},
 *   sos: null | {...},
 *   routeUpdate: null | {...},
 *   isStale: boolean,
 *   lastUpdate,
 * }
 */

const emptyVehicleState = (vehicleId) => ({
  vehicleId,
  routeId: null,
  latitude: null,
  longitude: null,
  speed: 0,
  heading: 0,
  accuracy: 0,
  currentStopId: null,
  currentStopIndex: null,
  nextStopId: null,
  tripStatus: "idle",
  tripStartedAt: null,
  completedStopIndexes: [],
  etaMinutes: null,
  delay: null,
  alert: null,
  sos: null,
  routeUpdate: null,
  isStale: false,
  lastUpdate: null,
});

// Stable reference returned by selectors when a vehicle has no entry yet —
// avoids a fresh [] literal on every call, which would break useSelector's
// default reference-equality check and cause render loops in consumers.
const EMPTY_STOPS = [];

const initialState = {
  // REST-fetched data
  activeVehicles: [],
  trackingHistory: [],

  // Real-time state, one entry per vehicleId currently being tracked
  vehicles: {},

  isLoading: false,
  error: null,
  lastUpdate: null,
};

function getOrCreateVehicle(state, vehicleId) {
  if (!vehicleId) return null;
  if (!state.vehicles[vehicleId]) {
    state.vehicles[vehicleId] = emptyVehicleState(vehicleId);
  }
  return state.vehicles[vehicleId];
}

// ── Async thunks ──────────────────────────────────────────────────────────────
export const recordLocationUpdate = createAsyncThunk(
  "vehicleTracking/recordLocationUpdate",
  async (data, thunkAPI) => {
    try {
      const response = await api.post(
        "/vehicle-tracking/record-location",
        data,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to record location",
      );
    }
  },
);

export const getCurrentVehicleLocation = createAsyncThunk(
  "vehicleTracking/getCurrentVehicleLocation",
  async (vehicleId, thunkAPI) => {
    try {
      const response = await api.get(
        `/vehicle-tracking/current-location/${vehicleId}`,
      );
      return { vehicleId, ...response.data };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicle location",
      );
    }
  },
);

export const getAllActiveVehicleLocations = createAsyncThunk(
  "vehicleTracking/getAllActiveVehicleLocations",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicle-tracking/active-vehicles");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch active vehicles",
      );
    }
  },
);

export const getVehicleTrackingHistory = createAsyncThunk(
  "vehicleTracking/getVehicleTrackingHistory",
  async ({ vehicleId, params }, thunkAPI) => {
    try {
      const config = params ? { params } : {};
      const response = await api.get(
        `/vehicle-tracking/tracking-history/${vehicleId}`,
        config,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch tracking history",
      );
    }
  },
);

export const getETAToStop = createAsyncThunk(
  "vehicleTracking/getETAToStop",
  async ({ vehicleId, stopId }, thunkAPI) => {
    try {
      const response = await api.get(
        `/vehicle-tracking/eta/${vehicleId}/${stopId}`,
      );
      return { vehicleId, ...response.data };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to calculate ETA",
      );
    }
  },
);

export const checkVehicleDelay = createAsyncThunk(
  "vehicleTracking/checkVehicleDelay",
  async ({ vehicleId, routeId }, thunkAPI) => {
    try {
      const response = await api.get(
        `/vehicle-tracking/check-delay/${vehicleId}/${routeId}`,
      );
      return { vehicleId, ...response.data };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to check delay",
      );
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const vehicleTrackingSlice = createSlice({
  name: "vehicleTracking",
  initialState,
  reducers: {
    reset: () => initialState,

    clearTrackingHistory: (state) => {
      state.trackingHistory = [];
    },

    /**
     * Drop all real-time state for a vehicle, e.g. when a guardian removes a
     * student / unsubscribes from a route.
     */
    resetVehicle: (state, action) => {
      delete state.vehicles[action.payload];
    },

    /**
     * setVehicleLocation
     * Dispatched by useSocket.js on every "vehicle-location-update" event.
     * Payload matches the socket payload emitted by
     * vehicleTrackingController.recordLocationUpdate:
     * { vehicleId, routeId, latitude, longitude, speed, heading, accuracy,
     *   currentStopId, currentStopIndex, nextStopId, timestamp }
     */
    setVehicleLocation: (state, action) => {
      const loc = action.payload;
      const v = getOrCreateVehicle(state, loc.vehicleId);
      if (!v) return;

      v.latitude = loc.latitude;
      v.longitude = loc.longitude;
      v.speed = loc.speed ?? 0;
      v.heading = loc.heading ?? 0;
      v.accuracy = loc.accuracy ?? 0;
      if (loc.routeId) v.routeId = loc.routeId;
      if (loc.currentStopId !== undefined) v.currentStopId = loc.currentStopId;
      if (loc.currentStopIndex !== undefined && loc.currentStopIndex !== null)
        v.currentStopIndex = loc.currentStopIndex;
      if (loc.nextStopId !== undefined) v.nextStopId = loc.nextStopId;
      v.isStale = false;
      v.lastUpdate = loc.timestamp ?? new Date().toISOString();
      state.lastUpdate = v.lastUpdate;
    },

    /**
     * setTripStatus
     * Payload: { vehicleId, status: "idle" | "active" | "ended" }
     */
    setTripStatus: (state, action) => {
      const { vehicleId, status } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;

      v.tripStatus = status;
      if (status === "active") v.tripStartedAt = new Date().toISOString();
      if (status === "idle") {
        v.completedStopIndexes = [];
        v.currentStopIndex = null;
      }
    },

    /**
     * setCurrentStopIndex
     * Payload: { vehicleId, stopIndex, stopId }
     */
    setCurrentStopIndex: (state, action) => {
      const { vehicleId, stopIndex, stopId } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;

      if (stopId !== undefined) v.currentStopId = stopId;
      if (typeof stopIndex === "number") {
        v.currentStopIndex = stopIndex;
        if (!v.completedStopIndexes.includes(stopIndex)) {
          v.completedStopIndexes.push(stopIndex);
        }
      }
    },

    /**
     * setEtaMinutes
     * Payload: { vehicleId, etaMinutes }
     */
    setEtaMinutes: (state, action) => {
      const { vehicleId, etaMinutes } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;
      v.etaMinutes = etaMinutes;
    },

    /**
     * setVehicleDelayed
     * Payload: { vehicleId, routeId, stopId, delayMinutes, location, ... }
     */
    setVehicleDelayed: (state, action) => {
      const { vehicleId } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;
      v.delay = action.payload;
    },

    /**
     * setVehicleAlert
     * Payload: full VehicleAlert record { vehicleId, alertType, severity, ... }
     */
    setVehicleAlert: (state, action) => {
      const { vehicleId } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;
      v.alert = action.payload;
    },

    /**
     * setDriverSOS
     * Payload: { vehicleId, routeId, location, driverName, driverPhone, ... }
     */
    setDriverSOS: (state, action) => {
      const { vehicleId } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (v) v.sos = action.payload;
    },

    /**
     * setRouteUpdate
     * Payload: { vehicleId, route, timestamp }
     */
    setRouteUpdate: (state, action) => {
      const { vehicleId } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;
      v.routeUpdate = action.payload;
      if (action.payload.routeId) v.routeId = action.payload.routeId;
    },

    markStopCompleted: (state, action) => {
      // action.payload = { vehicleId, stopIndex }
      const { vehicleId, stopIndex } = action.payload;
      const v = getOrCreateVehicle(state, vehicleId);
      if (!v) return;
      if (!v.completedStopIndexes.includes(stopIndex)) {
        v.completedStopIndexes.push(stopIndex);
      }
    },

    resetTrip: (state, action) => {
      const vehicleId = action.payload;
      const v = state.vehicles[vehicleId];
      if (!v) return;
      v.tripStatus = "idle";
      v.tripStartedAt = null;
      v.completedStopIndexes = [];
      v.currentStopIndex = null;
      v.etaMinutes = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(recordLocationUpdate.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(recordLocationUpdate.fulfilled, (s) => {
        s.isLoading = false;
        s.lastUpdate = new Date().toISOString();
      })
      .addCase(recordLocationUpdate.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload;
      });

    builder
      .addCase(getCurrentVehicleLocation.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(getCurrentVehicleLocation.fulfilled, (s, a) => {
        s.isLoading = false;
        const tracking = a.payload?.tracking;
        const vehicleId = a.payload?.vehicleId;
        if (tracking && vehicleId) {
          const v = getOrCreateVehicle(s, vehicleId);
          v.latitude = tracking.latitude;
          v.longitude = tracking.longitude;
          v.speed = tracking.speed ?? 0;
          v.routeId = tracking.routeId ?? v.routeId;
          v.currentStopId = tracking.currentStopId ?? v.currentStopId;
          v.isStale = a.payload?.isStale ?? false;
          v.lastUpdate = tracking.timestamp;
        }
      })
      .addCase(getCurrentVehicleLocation.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload;
      });

    builder
      .addCase(getAllActiveVehicleLocations.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(getAllActiveVehicleLocations.fulfilled, (s, a) => {
        s.isLoading = false;
        s.activeVehicles = a.payload?.vehicles ?? [];
      })
      .addCase(getAllActiveVehicleLocations.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload;
      });

    builder
      .addCase(getVehicleTrackingHistory.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(getVehicleTrackingHistory.fulfilled, (s, a) => {
        s.isLoading = false;
        s.trackingHistory = a.payload?.history ?? [];
      })
      .addCase(getVehicleTrackingHistory.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload;
      });

    builder.addCase(getETAToStop.fulfilled, (s, a) => {
      const { vehicleId, etaMinutes } = a.payload || {};
      if (vehicleId && etaMinutes != null) {
        const v = getOrCreateVehicle(s, vehicleId);
        v.etaMinutes = etaMinutes;
      }
    });
  },
});

export const {
  reset,
  clearTrackingHistory,
  resetVehicle,
  setVehicleLocation,
  setTripStatus,
  setCurrentStopIndex,
  setEtaMinutes,
  setVehicleDelayed,
  setVehicleAlert,
  setDriverSOS,
  setRouteUpdate,
  markStopCompleted,
  resetTrip,
} = vehicleTrackingSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
// All per-vehicle selectors are curried: useSelector(selectVehicle(vehicleId))
export const selectVehicle = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId] || null;

export const selectVehicleLocation = (vehicleId) => (s) => {
  const v = s.vehicletracking.vehicles[vehicleId];
  if (!v || v.latitude == null) return null;
  return { latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy };
};

export const selectVehicleSpeed = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.speed ?? 0;

export const selectVehicleHeading = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.heading ?? 0;

export const selectTripStatus = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.tripStatus ?? "idle";

export const selectCompletedStops = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.completedStopIndexes ?? EMPTY_STOPS;

export const selectEtaMinutes = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.etaMinutes ?? null;

export const selectVehicleAlert = (vehicleId) => (s) =>
  s.vehicletracking.vehicles[vehicleId]?.alert ?? null;

export const selectTrackedVehicleIds = (s) =>
  Object.keys(s.vehicletracking.vehicles);

export const selectLastUpdate = (s) => s.vehicletracking.lastUpdate;
export const selectActiveVehicles = (s) => s.vehicletracking.activeVehicles;

export default vehicleTrackingSlice.reducer;
