import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "rentalist_refresh";

// web (frontend/src/api/client.js) と同じ方針: access はメモリのみ。
// refresh は localStorage の代わりに Keychain (expo-secure-store) に保持し、
// 起動時に loadRefreshToken() で一度だけメモリへミラーする（以後は同期参照）。
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function loadRefreshToken(): Promise<string | null> {
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return refreshToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function setRefreshToken(token: string): Promise<void> {
  refreshToken = token;
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function hasSession(): boolean {
  return Boolean(refreshToken);
}
