import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const REFRESH_KEY = "rentalist_refresh";

// access token はメモリ、refresh token は localStorage に保持する
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}
export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}
export function hasSession() {
  return Boolean(getRefreshToken());
}

export const API_BASE = `${BASE}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshRequest = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retry && getRefreshToken()) {
      original._retry = true;
      try {
        if (!refreshRequest) {
          refreshRequest = axios.post(`${API_BASE}/auth/token/refresh/`, {
            refresh: getRefreshToken(),
          });
        }
        const { data } = await refreshRequest;
        refreshRequest = null;
        setAccessToken(data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (refreshError) {
        refreshRequest = null;
        clearTokens();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
