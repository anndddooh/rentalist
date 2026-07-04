import api from "./client";
import type { Paginated, RentalShop } from "./types";

export async function listShops(): Promise<RentalShop[]> {
  const { data } = await api.get<Paginated<RentalShop> | RentalShop[]>(
    "/shops/"
  );
  return Array.isArray(data) ? data : data.results;
}

export async function createShop(payload: {
  name: string;
  memo?: string;
}): Promise<RentalShop> {
  const { data } = await api.post<RentalShop>("/shops/", payload);
  return data;
}

export async function updateShop(
  id: number,
  payload: { name?: string; memo?: string }
): Promise<RentalShop> {
  const { data } = await api.patch<RentalShop>(`/shops/${id}/`, payload);
  return data;
}

export async function deleteShop(id: number): Promise<void> {
  await api.delete(`/shops/${id}/`);
}
