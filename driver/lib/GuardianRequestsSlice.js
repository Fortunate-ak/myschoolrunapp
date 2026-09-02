import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  requests: null,
  isLoading: false,
  error: null,
};

export const approveRequest = createAsyncThunk(
  "guardianRequests/approveRequest",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(
        `/guardian-requests/approve-request/${id}`,
      );
      return response.data.request;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to approve request ",
      );
    }
  },
);

export const rejectRequest = createAsyncThunk(
  "guardianRequests/rejectRequest",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(
        `/guardian-requests/reject-request/${id}`,
      );
      return response.data.request;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to reject request ",
      );
    }
  },
);

export const getAllRequests = createAsyncThunk(
  "guardianRequests/getAllRequests",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/guardian-requests/all-driver-requests");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch requests",
      );
    }
  },
);

const requestSlice = createSlice({
  name: "guardianRequests",
  initialState,
  reducers: {
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(approveRequest.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(approveRequest.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.isLoading = false;
      })
      .addCase(approveRequest.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(rejectRequest.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(rejectRequest.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.isLoading = false;
      })
      .addCase(rejectRequest.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(getAllRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(getAllRequests.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.isLoading = false;
      })

      .addCase(getAllRequests.rejected, (state, action) => {
        state.error = action.payload;
        state.isLoading = false;
      });
  },
});

export const { reset } = requestSlice.actions;
export default requestSlice.reducer;
