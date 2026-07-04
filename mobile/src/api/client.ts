import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "@/lib/env";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "@/lib/tokens";

// frontend/src/api/client.js の移植。
// 相違点: refresh は SecureStore ミラー (lib/tokens)、
// セッション失効時は window.location ではなくハンドラ経由で通知する。

let onSessionExpired: (() => void) | null = null;

/** refresh 失敗（セッション失効）時に呼ばれるハンドラを登録する（AuthProvider が設定） */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 並行 401 で refresh が多重発火しないよう単一飛行にする
let refreshRequest: Promise<AxiosResponse<{ access: string }>> | null = null;

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
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
        await clearTokens();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
