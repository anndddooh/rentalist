import Constants from "expo-constants";

type Extra = {
  appEnv: "development" | "staging" | "production";
  apiBaseUrl: string | null;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const APP_ENV = extra.appEnv ?? "development";

/**
 * API ベース URL の解決順（優先度高い順）:
 * 1. EXPO_PUBLIC_API_URL … 明示上書き。dev client で staging/ローカルを切替える用途
 *    （.env.local や `EXPO_PUBLIC_API_URL=... expo start` で指定）
 * 2. extra.apiBaseUrl が「文字列」のとき … staging/production ビルドで焼き込まれる値
 *    ※ dev client では extra.apiBaseUrl が null 以外のオブジェクトになることがあり、
 *      素の `?? ` だと誤ってそれを使ってしまうため typeof で厳密にガードする
 * 3. development 既定 … Metro の hostUri から Mac の LAN IP を導出し :8000（ローカル Django）
 */
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.length > 0) {
    return extra.apiBaseUrl;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:8000`;
}

export const API_BASE_URL = resolveBaseUrl();

/** web (frontend/src/api/client.js) と同じく `${BASE}/api` を API ルートとする */
export const API_BASE = `${API_BASE_URL}/api`;
