import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  routes: [],
  vehicles: [],
  currentRoute: null,
  driverRoutes: [],
  routeSchedule: null,
  // The route the driver picked on RouteSelectionScreen. HomeScreen is
  // freshly mounted (not navigated to with params) after that screen swaps
  // out, so this is the only way the choice reaches it — HomeScreen reads
  // this instead of always falling back to driverRoutes[0].
  selectedRouteId: null,
  isLoading: false,
  error: null,
};

const createRoutePayload = (data) => {
  const formatTime = (timeString) => {
    if (!timeString) return undefined;

    if (timeString.split(":").length === 2) {
      return `${timeString}:00`;
    }
    return timeString;
  };

  const payload = {
    routeName: data.routeName,
    vehicleId: data.vehicleId,
    routeType: data.routeType || "both",
    startTime: formatTime(data.startTime),
    estimatedEndTime: formatTime(data.estimatedEndTime),
    activeDays: data.activeDays || [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ],
    totalDistance: data.totalDistance
      ? parseFloat(data.totalDistance)
      : undefined,
    estimatedDuration: data.estimatedDuration
      ? parseInt(data.estimatedDuration)
      : undefined,
  };

  if (data.stops && data.stops.length > 0) {
    payload.stops = data.stops.map((stop, index) => ({
      stopName: stop.stopName,
      stopOrder: stop.stopOrder || index + 1,
      location: {
        latitude: stop.location?.latitude
          ? Number(stop.location.latitude)
          : null,
        longitude: stop.location?.longitude
          ? Number(stop.location.longitude)
          : null,
        address: stop.location?.address || null,
      },

      scheduledPickupTime: stop.scheduledPickupTime
        ? stop.scheduledPickupTime.includes(":") &&
          stop.scheduledPickupTime.split(":").length === 2
          ? `${stop.scheduledPickupTime}:00`
          : stop.scheduledPickupTime
        : null,
      scheduledDropoffTime: stop.scheduledDropoffTime
        ? stop.scheduledDropoffTime.includes(":") &&
          stop.scheduledDropoffTime.split(":").length === 2
          ? `${stop.scheduledDropoffTime}:00`
          : stop.scheduledDropoffTime
        : null,
      estimatedWaitTime: stop.estimatedWaitTime || 2,
    }));
  }

  return payload;
};

export const createVehicleRoute = createAsyncThunk(
  "vehicleRoute/createVehicleRoute",
  async (data, thunkAPI) => {
    try {
      const payload = createRoutePayload(data);
      const response = await api.post(
        "/vehicleroutes/create-vehicle-route",
        payload,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to create vehicle route",
      );
    }
  },
);

export const updateVehicleRoute = createAsyncThunk(
  "vehicleRoute/updateVehicleRoute",
  async ({ id, ...updates }, thunkAPI) => {
    try {
      const payload = createRoutePayload(updates);
      const response = await api.patch(
        `/vehicleroutes/update-vehicle-route/${id}`,
        payload,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update vehicle route",
      );
    }
  },
);

// Matches the getAllVehicles controller — returns vehicles with their
// driver (+ driver's user), and their routes (which carry .stops).
// NOTE: endpoint path assumed as "/vehicles/all-vehicles" following this
// codebase's "/{resource}/all-{resource}" convention — confirm against
// your actual vehicles route file and adjust if it differs.
export const getAllVehicles = createAsyncThunk(
  "vehicleRoute/getAllVehicles",
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

export const getAllVehicleRoutes = createAsyncThunk(
  "vehicleRoute/getAllVehicleRoutes",
  async (params, thunkAPI) => {
    try {
      const config = params ? { params } : {};
      const response = await api.get(
        "/vehicleroutes/all-vehicle-routes",
        config,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicle routes",
      );
    }
  },
);

export const getVehicleRouteById = createAsyncThunk(
  "vehicleRoute/getVehicleRouteById",
  async (id, thunkAPI) => {
    try {
      const response = await api.get(`/vehicleroutes/vehicle-route/${id}`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch vehicle route",
      );
    }
  },
);

export const getVehicleRoutesForDriver = createAsyncThunk(
  "vehicleRoute/getVehicleRoutesForDriver",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/vehicleroutes/vehicle-driver-route");
      console.log(response.data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch driver routes",
      );
    }
  },
);

export const addStopToRoute = createAsyncThunk(
  "vehicleRoute/addStopToRoute",
  async ({ routeId, stopData }, thunkAPI) => {
    try {
      const response = await api.patch(
        `/vehicleroutes/add-stop-to-route/${routeId}`,
        stopData,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to add stop to route",
      );
    }
  },
);

export const updateVehicleStop = createAsyncThunk(
  "vehicleRoute/updateVehicleStop",
  async ({ stopId, ...updates }, thunkAPI) => {
    try {
      const response = await api.patch(
        `/vehicleroutes/update-vehicle-stop/${stopId}`,
        updates,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update vehicle stop",
      );
    }
  },
);

export const deleteStopFromRoute = createAsyncThunk(
  "vehicleRoute/deleteStopFromRoute",
  async (stopId, thunkAPI) => {
    try {
      const response = await api.delete(
        `/vehicleroutes/delete-vehicle-stop/${stopId}`,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to delete vehicle stop",
      );
    }
  },
);

export const deleteRoute = createAsyncThunk(
  "vehicleRoute/deleteRoute",
  async (id, thunkAPI) => {
    try {
      const response = await api.delete(`/vehicleroutes/delete-route/${id}`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to delete vehicle stop",
      );
    }
  },
);

export const reorderRouteStops = createAsyncThunk(
  "vehicleRoute/reorderRouteStops",
  async ({ routeId, stopOrder }, thunkAPI) => {
    try {
      const response = await api.patch(
        `/vehicleroutes/reorder-vehicle-stops/${routeId}`,
        { stopOrder },
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to reorder stops",
      );
    }
  },
);

export const getRouteScheduleForToday = createAsyncThunk(
  "vehicleRoute/getRouteScheduleForToday",
  async (routeId, thunkAPI) => {
    try {
      const response = await api.get(
        `/vehicleroutes/route-schedule/${routeId}`,
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch route schedule",
      );
    }
  },
);

const vehichleSlice = createSlice({
  name: "vehicleRoute",
  initialState,
  reducers: {
    reset: () => initialState,
    clearCurrentRoute: (state) => {
      state.currentRoute = null;
    },
    clearDriverRoutes: (state) => {
      state.driverRoutes = [];
      state.driverAssignedVehicle = null;
    },
    clearRouteSchedule: (state) => {
      state.routeSchedule = null;
    },
    setSelectedRouteId: (state, action) => {
      state.selectedRouteId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createVehicleRoute.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createVehicleRoute.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routes.push(action.payload.route);
        // App.js derives `hasRoutes` from driverRoutes, so this needs to be
        // updated too, or the app won't know a route now exists until the
        // next getVehicleRoutesForDriver() fetch.
        state.driverRoutes.push(action.payload.route);
      })
      .addCase(createVehicleRoute.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(updateVehicleRoute.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateVehicleRoute.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.routes.findIndex(
          (route) => route.id === action.payload.route.id,
        );
        if (index !== -1) {
          state.routes[index] = action.payload.route;
        }
        if (state.currentRoute?.id === action.payload.route.id) {
          state.currentRoute = action.payload.route;
        }
        // Also update in driverRoutes if present
        const driverIndex = state.driverRoutes.findIndex(
          (route) => route.id === action.payload.route.id,
        );
        if (driverIndex !== -1) {
          state.driverRoutes[driverIndex] = action.payload.route;
        }
      })
      .addCase(updateVehicleRoute.rejected, (state, action) => {
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
        // Controller returns the vehicles array directly (not wrapped).
        state.vehicles = action.payload;
      })
      .addCase(getAllVehicles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getAllVehicleRoutes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllVehicleRoutes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routes = action.payload.routes;
      })
      .addCase(getAllVehicleRoutes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(deleteRoute.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteRoute.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routes = action.payload.routes;
      })
      .addCase(deleteRoute.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getVehicleRouteById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getVehicleRouteById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentRoute = action.payload;
      })
      .addCase(getVehicleRouteById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      .addCase(getVehicleRoutesForDriver.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getVehicleRoutesForDriver.fulfilled, (state, action) => {
        state.isLoading = false;
        state.driverRoutes = action.payload.routes;
        state.driverAssignedVehicle = action.payload.vehicle;
      })
      .addCase(getVehicleRoutesForDriver.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Add Stop to Route
    builder.addCase(addStopToRoute.fulfilled, (state, action) => {
      // Update the route in the list if it exists
      const index = state.routes.findIndex(
        (route) => route.id === action.payload.route.id,
      );
      if (index !== -1) {
        state.routes[index] = {
          ...state.routes[index],
          stops: action.payload.route.stops,
          totalDistance: action.payload.route.totalDistance,
          estimatedDuration: action.payload.route.estimatedDuration,
        };
      }
      // Update current route if it's the same
      if (state.currentRoute?.id === action.payload.route.id) {
        state.currentRoute = {
          ...state.currentRoute,
          stops: action.payload.route.stops,
          totalDistance: action.payload.route.totalDistance,
          estimatedDuration: action.payload.route.estimatedDuration,
        };
      }
      // Update driver routes if present
      const driverIndex = state.driverRoutes.findIndex(
        (route) => route.id === action.payload.route.id,
      );
      if (driverIndex !== -1) {
        state.driverRoutes[driverIndex] = {
          ...state.driverRoutes[driverIndex],
          stops: action.payload.route.stops,
          totalDistance: action.payload.route.totalDistance,
          estimatedDuration: action.payload.route.estimatedDuration,
        };
      }
    });

    // Update Vehicle Stop
    builder.addCase(updateVehicleStop.fulfilled, (state, action) => {
      const updateStopsInRoute = (route) => {
        const stopIndex = route.stops.findIndex(
          (stop) => stop.id === action.payload.stop.id,
        );
        if (stopIndex !== -1) {
          const newStops = [...route.stops];
          newStops[stopIndex] = action.payload.stop;
          return { ...route, stops: newStops };
        }
        return route;
      };

      // Update in routes list
      state.routes = state.routes.map((route) => updateStopsInRoute(route));

      // Update current route
      if (state.currentRoute) {
        state.currentRoute = updateStopsInRoute(state.currentRoute);
      }

      // Update driver routes
      state.driverRoutes = state.driverRoutes.map((route) =>
        updateStopsInRoute(route),
      );
    });

    // Delete Stop from Route
    builder.addCase(deleteStopFromRoute.fulfilled, (state, action) => {
      const index = state.routes.findIndex(
        (route) => route.id === action.payload.route.id,
      );
      if (index !== -1) {
        state.routes[index] = {
          ...state.routes[index],
          stops: action.payload.route.stops,
        };
      }
      if (state.currentRoute?.id === action.payload.route.id) {
        state.currentRoute = {
          ...state.currentRoute,
          stops: action.payload.route.stops,
        };
      }
      const driverIndex = state.driverRoutes.findIndex(
        (route) => route.id === action.payload.route.id,
      );
      if (driverIndex !== -1) {
        state.driverRoutes[driverIndex] = {
          ...state.driverRoutes[driverIndex],
          stops: action.payload.route.stops,
        };
      }
    });

    // Reorder Route Stops
    builder.addCase(reorderRouteStops.fulfilled, (state, action) => {
      const updateStops = (route) => {
        if (state.currentRoute?.id === route.id) {
          return { ...route, stops: action.payload.stops };
        }
        return route;
      };

      state.routes = state.routes.map((route) => updateStops(route));
      if (state.currentRoute) {
        state.currentRoute = {
          ...state.currentRoute,
          stops: action.payload.stops,
        };
      }
      state.driverRoutes = state.driverRoutes.map((route) =>
        updateStops(route),
      );
    });

    builder
      .addCase(getRouteScheduleForToday.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getRouteScheduleForToday.fulfilled, (state, action) => {
        state.isLoading = false;
        state.routeSchedule = action.payload;
      })
      .addCase(getRouteScheduleForToday.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  reset,
  clearCurrentRoute,
  clearDriverRoutes,
  clearRouteSchedule,
  setSelectedRouteId,
} = vehichleSlice.actions;
export default vehichleSlice.reducer;
