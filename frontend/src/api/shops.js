import api from "./client.js";

export async function listShops() {
  const { data } = await api.get("/shops/");
  return data.results ?? data;
}

export async function createShop(payload) {
  const { data } = await api.post("/shops/", payload);
  return data;
}

export async function updateShop(id, payload) {
  const { data } = await api.patch(`/shops/${id}/`, payload);
  return data;
}

export async function deleteShop(id) {
  await api.delete(`/shops/${id}/`);
}
