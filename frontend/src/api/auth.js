import api, {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
} from "./client.js";

export async function login(username, password) {
  const { data } = await api.post("/auth/token/", { username, password });
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  return data;
}

export async function refreshSession() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("no session");
  const { data } = await api.post("/auth/token/refresh/", { refresh });
  setAccessToken(data.access);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  return data;
}

export async function checkInvite(token) {
  const { data } = await api.get(`/auth/invite/check/${token}/`);
  return data;
}

export async function signup(token, username, password) {
  const { data } = await api.post("/auth/signup/", { token, username, password });
  return data;
}

export async function createInvite() {
  const { data } = await api.post("/auth/invite/");
  return data;
}

export async function listInvites() {
  const { data } = await api.get("/auth/invite/");
  return data;
}
