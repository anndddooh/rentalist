import api from "./client";
import type { CartItem, CheckoutResult, Paginated } from "./types";

export async function listCart(): Promise<CartItem[]> {
  const { data } = await api.get<Paginated<CartItem> | CartItem[]>("/cart/");
  return Array.isArray(data) ? data : data.results;
}

export async function addToCart(seriesId: number): Promise<CartItem> {
  const { data } = await api.post<CartItem>("/cart/", { series_id: seriesId });
  return data;
}

export async function removeFromCart(itemId: number): Promise<void> {
  await api.delete(`/cart/${itemId}/`);
}

export async function clearCart() {
  const { data } = await api.post("/cart/clear/", {});
  return data;
}

export async function checkout(): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>("/cart/checkout/", {});
  return data;
}
