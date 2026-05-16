import api from "./client.js";

export async function listCart() {
  const { data } = await api.get("/cart/");
  return data.results ?? data;
}

export async function addToCart(seriesId) {
  const { data } = await api.post("/cart/", { series_id: seriesId });
  return data;
}

export async function removeFromCart(itemId) {
  await api.delete(`/cart/${itemId}/`);
}

export async function clearCart() {
  const { data } = await api.post("/cart/clear/", {});
  return data;
}

export async function checkout() {
  const { data } = await api.post("/cart/checkout/", {});
  return data;
}
