import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  emergencyRides: [],
  currentRide: null,
  availableDrivers: [],
  selectedDriver: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  success: null,
};

// ─── Thunks ────────────────────────────────────────────────────────────────────

/**
 * Request an emergency ride
 * POST /emergency-rides/request
 */
export const requestEmergencyRide = createAsyncThunk(
  "emergencyRides/requestEmergencyRide",
  async (rideData, thunkAPI) => {
    try {
      const response = await api.post("/emergency-rides/request", rideData);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to request emergency ride",
      );
    }
  },
);

/**
 * Get available drivers for an emergency ride
 * GET /emergency-rides/:id/available-drivers
 */
export const getAvailableDrivers = createAsyncThunk(
  "emergencyRides/getAvailableDrivers",
  async (rideId, thunkAPI) => {
    try {
      const response = await api.get(
        `/emergency-rides/${rideId}/available-drivers`,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch available drivers",
      );
    }
  },
);

/**
 * Select a driver for the emergency ride
 * POST /emergency-rides/:id/select-driver
 */
export const selectDriverForRide = createAsyncThunk(
  "emergencyRides/selectDriver",
  async ({ rideId, driverId }, thunkAPI) => {
    try {
      const response = await api.post(
        `/emergency-rides/${rideId}/select-driver`,
        { driverId },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to select driver",
      );
    }
  },
);

/**
 * Cancel an emergency ride
 * POST /emergency-rides/:id/cancel
 */
export const cancelEmergencyRide = createAsyncThunk(
  "emergencyRides/cancel",
  async (rideId, thunkAPI) => {
    try {
      const response = await api.post(`/emergency-rides/${rideId}/cancel`, {});
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to cancel emergency ride",
      );
    }
  },
);

/**
 * Rate the emergency ride driver
 * POST /emergency-rides/:id/rate
 */
export const rateEmergencyDriver = createAsyncThunk(
  "emergencyRides/rate",
  async ({ rideId, rating, comment }, thunkAPI) => {
    try {
      const response = await api.post(`/emergency-rides/${rideId}/rate`, {
        rating,
        comment,
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to rate driver",
      );
    }
  },
);

// ─── Slice ─────────────────────────────────────────────────────────────────────

const emergencyRideSlice = createSlice({
  name: "emergencyRides",
  initialState,
  reducers: {
    // Clear current ride after navigation away
    clearCurrentRide: (state) => {
      state.currentRide = null;
      state.availableDrivers = [];
      state.selectedDriver = null;
    },
    // Clear errors
    clearError: (state) => {
      state.error = null;
      state.success = null;
    },
    // Set selected driver locally (for UI before submission)
    setSelectedDriver: (state, action) => {
      state.selectedDriver = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ── Request Emergency Ride ────────────────────────────────────────────
    builder
      .addCase(requestEmergencyRide.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(requestEmergencyRide.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentRide = action.payload;
        state.success = "Emergency ride requested successfully";
      })
      .addCase(requestEmergencyRide.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });

    // ── Get Available Drivers ─────────────────────────────────────────────
    builder
      .addCase(getAvailableDrivers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAvailableDrivers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.availableDrivers = action.payload;
      })
      .addCase(getAvailableDrivers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.availableDrivers = [];
      });

    // ── Select Driver ─────────────────────────────────────────────────────
    builder
      .addCase(selectDriverForRide.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(selectDriverForRide.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentRide = action.payload;
        state.selectedDriver = action.payload.driver || null;
        state.success = "Driver selected successfully";
      })
      .addCase(selectDriverForRide.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });

    // ── Cancel Ride ───────────────────────────────────────────────────────
    builder
      .addCase(cancelEmergencyRide.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(cancelEmergencyRide.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentRide = action.payload;
        state.success = "Emergency ride cancelled";
      })
      .addCase(cancelEmergencyRide.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });

    // ── Rate Driver ───────────────────────────────────────────────────────
    builder
      .addCase(rateEmergencyDriver.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(rateEmergencyDriver.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentRide = action.payload;
        state.success = "Driver rated successfully";
      })
      .addCase(rateEmergencyDriver.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentRide, clearError, setSelectedDriver } =
  emergencyRideSlice.actions;

export default emergencyRideSlice.reducer;
