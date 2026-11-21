import axios from "axios";
import { GUEST_MODE } from "../config";
import { isAuthRejection } from "../utils/errors";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Without a timeout a hung server leaves spinners running forever.
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch (refreshErr) {
          // Offline or server error while refreshing says nothing about the tokens.
          // Keep them and reject with the refresh failure itself (a network/server error), NOT the
          // original 401, so callers don't mistake "couldn't check" for "login is invalid".
          if (!isAuthRejection(refreshErr)) return Promise.reject(refreshErr);
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (GUEST_MODE) {
            try {
              // Session died (e.g. expired refresh token) — start a fresh guest
              // identity instead of bouncing to a login page meant to be skipped.
              const { data } = await axios.post(`${BASE_URL}/auth/guest`);
              localStorage.setItem("access_token", data.access_token);
              localStorage.setItem("refresh_token", data.refresh_token);
              original.headers.Authorization = `Bearer ${data.access_token}`;
              return api(original);
            } catch {
              // Could not start a fresh guest session (server down). Surface the error; don't redirect to a login page that guest mode hides.
              return Promise.reject(error);
            }
          } else {
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);
