import axios from "axios";

const BASE_URL = "https://38ktx0q1-5007.inc1.devtunnels.ms/api";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedRequests = [];
let isLoggingOut = false;
let isLoggingOutPromise = null;

export const resetLoggingOut = () => {
  isLoggingOut = false;
  isLoggingOutPromise = null;
};

api.interceptors.request.use((config) => {
  if (config.url?.includes("/logout")) {
    isLoggingOut = true;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (isLoggingOut) {
      return Promise.reject(error);
    }

    const isLoginRequest = originalRequest.url?.includes("/login");

    const shouldSkipRefresh =
      originalRequest.url?.includes("/logout") ||
      originalRequest.url?.includes("/refresh-token") ||
      originalRequest.url?.includes("/login");

    if (isLoginRequest) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !shouldSkipRefresh &&
      !originalRequest._retry
    ) {
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedRequests.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        failedRequests.forEach((pending) => pending.resolve());
        failedRequests = [];

        return api(originalRequest);
      } catch (error) {
        failedRequests.forEach((pending) => pending.reject(error));
        failedRequests = [];

        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 423) {
      const { message, remainingMinutes } = error.response.data;
      error.lockedMessage =
        message || `Account locked for ${remainingMinutes} minutes`;
      return Promise.reject(error);
    }

    if (error.response?.status === 429) {
      const { message, waitSeconds } = error.response.data;
      error.rateLimitMessage = message || `Please wait ${waitSeconds} seconds`;
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
