import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  guardianProfile: null,
  profile: null,
  guardians: [],
  drivers: [],
  students: [],
  isLoading: false,
  error: null,
  success: null,
};

export const setGuardianProfile = createAsyncThunk(
  "users/setGuardianProfile",
  async (profileData, thunkAPI) => {
    try {
      const response = await api.post(
        "/users/create-guardian-profile",
        profileData,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to set guardian profile",
      );
    }
  },
);

export const getAllGuardians = createAsyncThunk(
  "users/getAllGuardians",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/users/all-guardians");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch guardians",
      );
    }
  },
);

export const getAllVehicles = createAsyncThunk(
  "users/getAllVehicles",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicles/all-vehicles");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicles",
      );
    }
  },
);

export const updateGuardian = createAsyncThunk(
  "users/updateGuardian",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await api.patch(`/users/update-guardian/${id}`, data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update guardian",
      );
    }
  },
);

export const deactivateGuardian = createAsyncThunk(
  "users/deactivateGuardian",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(`/users/guardian/${id}/deactivate`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to deactivate guardian",
      );
    }
  },
);

export const getGuardianProfile = createAsyncThunk(
  "users/getGuardianProfile",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/users/my-profile");
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch guardian profile",
      );
    }
  },
);

export const activateGuardian = createAsyncThunk(
  "users/activateGuardian",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(`/users/guardian/${id}/activate`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to activate guardian",
      );
    }
  },
);

export const getGuardianStudents = createAsyncThunk(
  "users/getGuardianStudents",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/users/guardian-students");
      console.dir(response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch students",
      );
    }
  },
);

// Post-login "add another student" — calls userController.addStudentToGuardian.
// NOTE: verify this path against your actual routes file (userRoutes.js) —
// I'm inferring it from the naming convention of your other /users routes
// ("create-guardian-profile", "my-profile", "guardian-students"). Adjust the
// string below if your router registers addStudentToGuardian under a
// different path.
export const addStudentToGuardian = createAsyncThunk(
  "users/addStudentToGuardian",
  async (studentData, thunkAPI) => {
    try {
      const response = await api.post("/users/add-student", studentData);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to add student",
      );
    }
  },
);

export const guardianSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    reset: () => initialState,
    clearGuardianprofile: (state) => {
      state.guardianProfile = null;
    },
    clearGuardianSuccess: (state) => {
      state.success = null;
    },
    clearGuardianError: (state) => {
      state.error = null;
    },
    updateLocalGuardianProfile: (state, action) => {
      const { field, value } = action.payload;
      if (state.guardianProfile) {
        state.guardianProfile[field] = value;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setGuardianProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(setGuardianProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.guardianProfile = action.payload;
      })
      .addCase(setGuardianProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getGuardianProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getGuardianProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.guardianProfile = action.payload.roleDetails || null;
        state.error = null;
      })
      .addCase(getGuardianProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.guardianProfile = null;
        if (action.payload !== "Guardian profile not found") {
          state.error = action.payload;
        }
      });

    builder
      .addCase(getAllGuardians.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllGuardians.fulfilled, (state, action) => {
        state.isLoading = false;
        state.guardians = action.payload;
      })
      .addCase(getAllGuardians.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getGuardianStudents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getGuardianStudents.fulfilled, (state, action) => {
        state.isLoading = false;
        state.students = action.payload.students || [];
      })
      .addCase(getGuardianStudents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Push the newly-added student straight into guardianProfile.students so
    // every screen reading guardianProfile.students (App.js routing,
    // StudentsScreen, RequestsScreen, GuardianRoutesScreen) sees it
    // immediately, without waiting on a getGuardianProfile refetch.
    builder
      .addCase(addStudentToGuardian.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addStudentToGuardian.fulfilled, (state, action) => {
        state.isLoading = false;
        const newStudent = action.payload.student;
        if (state.guardianProfile) {
          if (!Array.isArray(state.guardianProfile.students)) {
            state.guardianProfile.students = [];
          }
          state.guardianProfile.students.push(newStudent);
        }
      })
      .addCase(addStudentToGuardian.rejected, (state, action) => {
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
        state.drivers = action.payload;
      })
      .addCase(getAllVehicles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(updateGuardian.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateGuardian.fulfilled, (state, action) => {
        state.isLoading = false;

        const index = state.guardians.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.guardians[index] = action.payload;
        }

        if (state.guardianProfile?.id === action.payload.id) {
          state.guardianProfile = action.payload;
        }

        state.error = null;
      })
      .addCase(updateGuardian.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(deactivateGuardian.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deactivateGuardian.fulfilled, (state, action) => {
        state.isLoading = false;

        const index = state.guardians.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.guardians[index] = action.payload;
        }

        if (state.guardianProfile?.id === action.payload.id) {
          state.guardianProfile = action.payload;
        }

        state.error = null;
      })
      .addCase(deactivateGuardian.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(activateGuardian.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(activateGuardian.fulfilled, (state, action) => {
        state.isLoading = false;

        const index = state.guardians.findIndex(
          (d) => d.id === action.payload.id,
        );
        if (index !== -1) {
          state.guardians[index] = action.payload;
        }

        if (state.guardianProfile?.id === action.payload.id) {
          state.guardianProfile = action.payload;
        }
      })
      .addCase(activateGuardian.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
      builder
  .addCase(subscribeGuardian.pending, (state) => {
    state.isLoading = true;
    state.error = null;
  })
  .addCase(subscribeGuardian.fulfilled, (state, action) => {
    state.isLoading = false;
    state.guardianProfile = action.payload;
  })
  .addCase(subscribeGuardian.rejected, (state, action) => {
    state.isLoading = false;
    state.error = action.payload;
  });
  },
});

export const {
  reset,
  clearGuardianError,
  clearGuardianSuccess,
  clearGuardianprofile,
  updateLocalGuardianProfile,
} = guardianSlice.actions;
export default guardianSlice.reducer;
export const subscribeGuardian = createAsyncThunk(
  "users/subscribeGuardian",
  async (plan, thunkAPI) => {
    try {
      const response = await api.post("/users/subscribe", { plan });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to subscribe",
      );
    }
  },
);