import api from "./client";
import type { Paginated, ReadingStats, RentalHistoryItem } from "./types";

/**
 * /history/ の初期ページを取得する。DRF のページネーション形のまま返す。
 * 後続ページは listHistoryNextPage(next) で取る（絶対 URL は baseURL を無視する）。
 */
export async function listHistory(
  seriesId?: number
): Promise<Paginated<RentalHistoryItem>> {
  const params = seriesId ? { series_id: seriesId } : {};
  const { data } = await api.get<Paginated<RentalHistoryItem>>("/history/", {
    params,
  });
  return data;
}

export async function listHistoryNextPage(
  nextUrl: string
): Promise<Paginated<RentalHistoryItem>> {
  const { data } = await api.get<Paginated<RentalHistoryItem>>(nextUrl);
  return data;
}

export async function addHistory({
  seriesId,
  volumeNumber,
  rentedAt,
}: {
  seriesId: number;
  volumeNumber: number;
  rentedAt: string;
}): Promise<RentalHistoryItem> {
  const { data } = await api.post<RentalHistoryItem>("/history/", {
    series_id: seriesId,
    volume_number: volumeNumber,
    rented_at: rentedAt,
  });
  return data;
}

export async function deleteHistory(id: number): Promise<void> {
  await api.delete(`/history/${id}/`);
}

export async function getReadingStats(): Promise<ReadingStats> {
  const { data } = await api.get<ReadingStats>("/history/stats/");
  return data;
}
