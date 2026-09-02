import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  // REST-fetched data
  locations: [],
  activeVehicles: [],
  currentVehicleLocation: null,
  trackingHistory: [],

  // Real-time driver state — updated directly by useSocketRedux every 2s
  currentDriverLocation: null, // { latitude, longitude, accuracy }
  currentSpeed: 0, // m/s — multiply by 3.6 for km/h in UI
  currentHeading: 0, // degrees 0-360
  currentRouteId: null,
  currentVehicleId: null,

  // Trip lifecycle
  tripStatus: "idle", // "idle" | "active" | "ended"
  tripStartedAt: null,
  completedStopIndexes: [], // stopIndex values from vehicle-stop-arrival events

  isLoading: false,
  error: null,
  lastUpdate: null,
};

// ── Async thunks (unchanged from your original) ───────────────────────────────
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
      return response.data;
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
      return response.data;
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
      return response.data;
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
    clearCurrentLocation: (state) => {
      state.currentVehicleLocation = null;
    },
    clearTrackingHistory: (state) => {
      state.trackingHistory = [];
    },
    updateLastUpdate: (state) => {
      state.lastUpdate = new Date().toISOString();
    },

    /**
     * addRealTimeLocation
     * Called by useSocketRedux on every location update (both from the driver's
     * own GPS and from inbound socket echoes).
     *
     * Payload: {
     *   vehicleId, latitude, longitude, speed, heading, accuracy,
     *   routeId?, timestamp
     * }
     */
    addRealTimeLocation: (state, action) => {
      const loc = action.payload;

      // Always update the driver's own current position fields
      state.currentDriverLocation = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy ?? 0,
      };
      state.currentSpeed = loc.speed ?? 0;
      state.currentHeading = loc.heading ?? 0;
      if (loc.vehicleId) state.currentVehicleId = loc.vehicleId;
      if (loc.routeId) state.currentRouteId = loc.routeId;
      state.lastUpdate = new Date().toISOString();

      // Also push to the rolling locations log (keep last 100 entries)
      state.locations = [
        loc,
        ...state.locations
          .filter((l) => l.vehicleId !== loc.vehicleId)
          .slice(0, 99),
      ];

      // Update the matching active vehicle entry
      const idx = state.activeVehicles.findIndex(
        (v) => v.vehicle?.id === loc.vehicleId,
      );
      if (idx !== -1) {
        state.activeVehicles[idx].latestTracking = loc;
        state.activeVehicles[idx].isOnline = true;
      }
    },

    // Trip lifecycle synchronised reducers
    setTripStatus: (state, action) => {
      state.tripStatus = action.payload; // "idle" | "active" | "ended"
      if (action.payload === "active")
        state.tripStartedAt = new Date().toISOString();
      if (action.payload === "idle") state.completedStopIndexes = [];
    },

    markStopCompleted: (state, action) => {
      // action.payload = stopIndex number
      if (!state.completedStopIndexes.includes(action.payload)) {
        state.completedStopIndexes.push(action.payload);
      }
    },

    resetTrip: (state) => {
      state.tripStatus = "idle";
      state.tripStartedAt = null;
      state.completedStopIndexes = [];
      state.currentDriverLocation = null;
      state.currentSpeed = 0;
      state.currentHeading = 0;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(recordLocationUpdate.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(recordLocationUpdate.fulfilled, (s, a) => {
        s.isLoading = false;
        if (a.payload?.tracking) s.locations.unshift(a.payload.tracking);
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
        s.currentVehicleLocation = a.payload?.tracking ?? null;
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
  },
});

export const {
  reset,
  clearCurrentLocation,
  clearTrackingHistory,
  updateLastUpdate,
  addRealTimeLocation,
  setTripStatus,
  markStopCompleted,
  resetTrip,
} = vehicleTrackingSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectDriverLocation = (s) =>
  s.vehicletracking.currentDriverLocation;
export const selectDriverSpeed = (s) => s.vehicletracking.currentSpeed;
export const selectDriverHeading = (s) => s.vehicletracking.currentHeading;
export const selectTripStatus = (s) => s.vehicletracking.tripStatus;
export const selectCompletedStops = (s) =>
  s.vehicletracking.completedStopIndexes;
export const selectLastUpdate = (s) => s.vehicletracking.lastUpdate;
export const selectActiveVehicles = (s) => s.vehicletracking.activeVehicles;

export default vehicleTrackingSlice.reducer;
