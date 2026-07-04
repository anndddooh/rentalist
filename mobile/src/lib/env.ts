import Constants from "expo-constants";

type Extra = { appEnv: "development" | "staging" | "production"; apiBaseUrl: string | null };

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const APP_ENV = extra.appEnv ?? "development";

/**
 * development のときの API ベース URL を導出する。
 * - EXPO_PUBLIC_API_URL があれば最優先（Expo Go のままステージング等へ接続する用途）
 * - なければ Metro の hostUri（例 "192.168.1.10:8081"）から Mac の LAN IP を取り、
 *   ローカル Django（:8000）に向ける
 */
function devBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:8000`;
}

export const API_BASE_URL = extra.apiBaseUrl ?? devBaseUrl();

/** web (frontend/src/api/client.js) と同じく `${BASE}/api` を API ルートとする */
export const API_BASE = `${API_BASE_URL}/api`;
