import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  vehicles: [],
  currentVehicle: null,
  drivervehicles: [],
  isLoading: false,
  error: null,
};

const createVehicleFormData = (data) => {
  const formData = new FormData();

  // Required fields
  formData.append("carMake", data.carMake);
  formData.append("carModel", data.carModel);
  formData.append("registrationNumber", data.registrationNumber);
  formData.append("capacity", data.capacity.toString());

  // Optional fields
  if (data.status) {
    formData.append("status", data.status);
  }

  if (data.lastServiceDate) {
    formData.append(
      "lastServiceDate",
      new Date(data.lastServiceDate).toISOString(),
    );
  }

  if (data.nextServiceDate) {
    formData.append(
      "nextServiceDate",
      new Date(data.nextServiceDate).toISOString(),
    );
  }

  if (data.insuranceExpiry) {
    formData.append(
      "insuranceExpiry",
      new Date(data.insuranceExpiry).toISOString(),
    );
  }

  if (data.assignedDriverId) {
    formData.append("assignedDriverId", data.assignedDriverId);
  }

  // React Native has no global `File` class — `data.image instanceof File`
  // was always false here, so a picked image was silently never appended.
  // React Native's fetch/FormData wants { uri, name, type } objects instead.
  if (data.image?.uri) {
    formData.append("image", {
      uri: data.image.uri,
      name: data.image.name || "vehicle.jpg",
      type: data.image.type || data.image.mimeType || "image/jpeg",
    });
  }

  return formData;
};

const createUpdateVehicleFormData = (data) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (key === "image") {
        // Same React Native caveat as createVehicleFormData: no global
        // File class, so RN gives us a { uri, name, type } object, not a
        // File/Blob. A plain string means it's an existing image path we're
        // leaving untouched (no new image picked).
        if (typeof value === "string") {
          formData.append("image", value);
        } else if (value?.uri) {
          formData.append("image", {
            uri: value.uri,
            name: value.name || "vehicle.jpg",
            type: value.type || value.mimeType || "image/jpeg",
          });
        }
      } else if (key === "capacity") {
        formData.append(key, value.toString());
      } else if (key === "isActive") {
        formData.append(key, value.toString());
      } else if (
        key === "lastServiceDate" ||
        key === "nextServiceDate" ||
        key === "insuranceExpiry"
      ) {
        if (value) {
          formData.append(key, new Date(value).toISOString());
        }
      } else {
        formData.append(key, value);
      }
    }
  });

  return formData;
};

export const createVehicle = createAsyncThunk(
  "vehicle/createVehicle",
  async (data, thunkAPI) => {
    try {
      const formData = createVehicleFormData(data);
      const response = await api.post("/vehicles/add-vehicle", formData);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to create vehicle",
      );
    }
  },
);

export const updateVehicle = createAsyncThunk(
  "vehicle/updateVehicle",
  async ({ id, ...updates }, thunkAPI) => {
    try {
      const formData = createUpdateVehicleFormData(updates);
      const response = await api.patch(
        `/vehicles/update-vehicle/${id}`,
        formData,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update vehicle",
      );
    }
  },
);

export const getAllVehicles = createAsyncThunk(
  "vehicle/getAllVehicles",
  async (params, thunkAPI) => {
    try {
      const config = params ? { params } : {};
      const response = await api.get("/vehicles/all-vehicles", config);
      return response.data.vehicles || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicles",
      );
    }
  },
);

export const getVehicleById = createAsyncThunk(
  "vehicle/getVehicleById",
  async (id, thunkAPI) => {
    try {
      const response = await api.get(`/vehicles/vehicle/${id}`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicle",
      );
    }
  },
);

export const updateVehicleLocation = createAsyncThunk(
  "vehicle/updateVehicleLocation",
  async ({ id, location }, thunkAPI) => {
    try {
      const response = await api.patch(
        `/vehicles/vehicle/${id}/location`,
        location,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update vehicle location",
      );
    }
  },
);

export const getAvailableVehicles = createAsyncThunk(
  "vehicle/getAvailableVehicles",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicles/available-vehicles");
      return response.data.vehicles || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch available vehicles",
      );
    }
  },
);

export const getVehicleStatistics = createAsyncThunk(
  "vehicle/getVehicleStatistics",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicles/vehicle-statistics");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicle statistics",
      );
    }
  },
);

export const getDriverVehicles = createAsyncThunk(
  "vehicle/getDriverVehicles",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicles/driver-vehicles");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to get vehicles for driver",
      );
    }
  },
);

const vehicleSlice = createSlice({
  name: "vehicle",
  initialState,
  reducers: {
    reset: () => initialState,
    clearCurrentVehicle: (state) => {
      state.currentVehicle = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createVehicle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createVehicle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.vehicles.push(action.payload);
      })
      .addCase(createVehicle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getDriverVehicles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getDriverVehicles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.drivervehicles = action.payload || [];
      })
      .addCase(getDriverVehicles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(updateVehicle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateVehicle.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.vehicles.findIndex(
          (vehicle) => vehicle.id === action.payload.id,
        );
        if (index !== -1) {
          state.vehicles[index] = action.payload;
        }
        if (state.currentVehicle?.id === action.payload.id) {
          state.currentVehicle = action.payload;
        }
      })
      .addCase(updateVehicle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getAllVehicles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllVehicles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.vehicles = action.payload;
      })
      .addCase(getAllVehicles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getVehicleById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getVehicleById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentVehicle = action.payload;
      })
      .addCase(getVehicleById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getAvailableVehicles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAvailableVehicles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.vehicles = action.payload;
      })
      .addCase(getAvailableVehicles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getVehicleStatistics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getVehicleStatistics.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(getVehicleStatistics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { reset, clearCurrentVehicle } = vehicleSlice.actions;
export default vehicleSlice.reducer;
