import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  driverProfile: null,
  profile: null,
  drivers: [],
  vehicles: null,
  isLoading: false,
  error: null,
  success: null,
};

export const setDriverProfile = createAsyncThunk(
  "users/setDriverProfile",
  async (profileData, thunkAPI) => {
    try {
      const formData = new FormData();
      const textFields = [
        "idNumber",
        "licenseNumber",
        "gender",
        "carMake",
        "carModel",
        "registrationNumber",
        "capacity",
        "lastServiceDate",
        "nextServiceDate",
        "insuranceExpiry",
      ];

      textFields.forEach((key) => {
        if (
          profileData[key] !== null &&
          profileData[key] !== undefined &&
          profileData[key] !== ""
        ) {
          formData.append(key, String(profileData[key]));
        }
      });

      if (profileData.profileImage) {
        const imageAsset = profileData.profileImage;
        // Check if it's a URI from expo-image-picker
        if (imageAsset.uri) {
          formData.append("profileImage", {
            uri: imageAsset.uri,
            type: imageAsset.type || "image/jpeg",
            name: imageAsset.fileName || "profile.jpg",
          });
        } else {
          // It might be a base64 string or URL
          formData.append("profileImage", imageAsset);
        }
      }

      if (profileData.vehicleImage) {
        const imageAsset = profileData.vehicleImage;
        if (imageAsset.uri) {
          formData.append("vehicleImage", {
            uri: imageAsset.uri,
            type: imageAsset.type || "image/jpeg",
            name: imageAsset.fileName || "vehicle.jpg",
          });
        } else {
          formData.append("vehicleImage", imageAsset);
        }
      }
      const response = await api.post("/users/create-driver-profile", formData);
      return response.data;
    } catch (error) {
      console.error(error);
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to set driver profile",
      );
    }
  },
);

export const getAllDrivers = createAsyncThunk(
  "users/getAllDrivers",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/users/all-drivers");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch drivers",
      );
    }
  },
);

export const updateDriver = createAsyncThunk(
  "users/updateDriver",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await api.patch(`/users/update-driver/${id}`, data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update driver",
      );
    }
  },
);

export const deactivateDriver = createAsyncThunk(
  "users/deactivateDriver",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(`/users/driver/${id}/deactivate`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to deactivate driver",
      );
    }
  },
);

export const getDriverProfile = createAsyncThunk(
  "users/getDriverProfile",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/users/my-profile");
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch driver profile",
      );
    }
  },
);

export const activateDriver = createAsyncThunk(
  "users/activateDriver",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(`/users/driver/${id}/activate`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to activate driver",
      );
    }
  },
);

export const driverSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    reset: () => initialState,
    clearDriverprofile: (state) => {
      state.driverProfile = null;
    },
    clearDriverSuccess: (state) => {
      state.success = null;
    },
    clearDriverError: (state) => {
      state.error = null;
    },
    updateLocalDriverProfile: (state, action) => {
      const { field, value } = action.payload;
      if (state.driverProfile) {
        state.driverProfile[field] = value;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setDriverProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(setDriverProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.driverProfile = action.payload;
        console.log("driver profile response:", action.payload);
      })
      .addCase(setDriverProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Add to extraReducers in UserSlice.js
    builder
      .addCase(getDriverProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getDriverProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.driverProfile = action.payload.roleDetails || null;
        state.error = null;
      })
      .addCase(getDriverProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.driverProfile = null;
        // Don't set error for 404 - it just means no profile exists
        if (action.payload !== "Driver profile not found") {
          state.error = action.payload;
        }
      });

    builder
      .addCase(getAllDrivers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllDrivers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.drivers = action.payload;
      })
      .addCase(getAllDrivers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(updateDriver.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDriver.fulfilled, (state, action) => {
        state.isLoading = false;

        // Update in drivers list
        const index = state.drivers.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.drivers[index] = action.payload;
        }

        // Update current profile if it's the same driver
        if (state.driverProfile?.id === action.payload.id) {
          state.driverProfile = action.payload;
        }

        state.error = null;
      })
      .addCase(updateDriver.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(deactivateDriver.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deactivateDriver.fulfilled, (state, action) => {
        state.isLoading = false;

        // Update in drivers list
        const index = state.drivers.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.drivers[index] = action.payload;
        }

        // Update current profile if it's the same driver
        if (state.driverProfile?.id === action.payload.id) {
          state.driverProfile = action.payload;
        }

        state.error = null;
      })
      .addCase(deactivateDriver.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(activateDriver.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(activateDriver.fulfilled, (state, action) => {
        state.isLoading = false;

        // Update in drivers list
        const index = state.drivers.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.drivers[index] = action.payload;
        }

        // Update current profile if it's the same driver
        if (state.driverProfile?.id === action.payload.id) {
          state.driverProfile = action.payload;
        }
      })
      .addCase(activateDriver.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  reset,
  clearDriverError,
  clearDriverSuccess,
  clearDriverprofile,
} = driverSlice.actions;
export default driverSlice.reducer;
