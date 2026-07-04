import api from "./client";
import type { Invite, Me } from "./types";
import { getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/tokens";

export async function login(username: string, password: string) {
  const { data } = await api.post<{ access: string; refresh: string }>(
    "/auth/token/",
    { username, password }
  );
  setAccessToken(data.access);
  await setRefreshToken(data.refresh);
  return data;
}

export async function refreshSession() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("no session");
  const { data } = await api.post<{ access: string }>("/auth/token/refresh/", {
    refresh,
  });
  setAccessToken(data.access);
  return data;
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/auth/me/");
  return data;
}

export async function checkInvite(token: string) {
  const { data } = await api.get(`/auth/invite/check/${token}/`);
  return data;
}

export async function signup(token: string, username: string, password: string) {
  const { data } = await api.post("/auth/signup/", { token, username, password });
  return data;
}

export async function createInvite(): Promise<Invite> {
  const { data } = await api.post<Invite>("/auth/invite/");
  return data;
}

export async function listInvites(): Promise<Invite[]> {
  const { data } = await api.get<Invite[]>("/auth/invite/");
  return data;
}
