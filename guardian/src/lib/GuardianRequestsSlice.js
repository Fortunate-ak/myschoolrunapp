import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../utils/axiosInstance";

const initialState = {
  requests: null,
  isLoading: false,
  error: null,
};

// ── EDITED ───────────────────────────────────────────────────────────────
// Previously rejected with a plain string (error.response?.data?.message),
// which lost the backend's { code: "SUBSCRIPTION_REQUIRED" } flag used by
// FindDriverScreen to redirect to the Subscription screen instead of
// showing a generic error toast. Now rejects with an object carrying both
// the message and the code (code is undefined for any other kind of
// failure, which is harmless).
export const sendRequest = createAsyncThunk(
  "guardianRequests/sendRequest",
  async (requestData, thunkAPI) => {
    try {
      const response = await api.post(
        `/guardian-requests/create-request`,
        requestData,
      );
      return response.data.request;
    } catch (error) {
      console.error(error);
      return thunkAPI.rejectWithValue({
        message: error.response?.data?.message || "Failed to send request",
        code: error.response?.data?.code,
      });
    }
  },
);

export const cancelRequest = createAsyncThunk(
  "guardianRequests/cancelRequest",
  async (id, thunkAPI) => {
    try {
      const response = await api.patch(
        `/guardian-requests/cancel-request/${id}`,
      );
      return response.data;
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
      const response = await api.get(
        "/guardian-requests/all-guardian-requests",
      );
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
      .addCase(sendRequest.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendRequest.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.isLoading = false;
      })
      .addCase(sendRequest.rejected, (state, action) => {
        // action.payload is now { message, code } rather than a bare
        // string — anything reading state.guardianRequests.error as plain
        // text (e.g. a <Text>{error}</Text>) should read error.message
        // instead. FindDriverScreen doesn't read from here; it uses the
        // thrown/unwrapped error directly in its try/catch.
        state.error = action.payload;
        state.isLoading = false;
      });

    builder
      .addCase(cancelRequest.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelRequest.fulfilled, (state, action) => {
        state.requests = action.payload;
        state.isLoading = false;
      })
      .addCase(cancelRequest.rejected, (state, action) => {
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