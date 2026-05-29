import api from "./client.js";

/**
 * /history/ の初期ページを取得する。DRF のページネーション形を
 * そのまま返す: { count, next, previous, results }。
 * 後続ページは listHistoryNextPage(next) で取る。
 */
export async function listHistory(seriesId) {
  const params = seriesId ? { series_id: seriesId } : {};
  const { data } = await api.get("/history/", { params });
  return data;
}

/**
 * DRF が返す絶対 URL の next を辿って次ページを取得する。
 * axios は absolute URL を渡すと baseURL を無視するためそのまま使える。
 */
export async function listHistoryNextPage(nextUrl) {
  const { data } = await api.get(nextUrl);
  return data;
}

export async function addHistory({ seriesId, volumeNumber, rentedAt }) {
  const { data } = await api.post("/history/", {
    series_id: seriesId,
    volume_number: volumeNumber,
    rented_at: rentedAt,
  });
  return data;
}

export async function deleteHistory(id) {
  await api.delete(`/history/${id}/`);
}

export async function getReadingStats() {
  const { data } = await api.get("/history/stats/");
  return data;
}

export async function bulkAddHistory(seriesId, toVolume) {
  const { data } = await api.post(`/series/${seriesId}/bulk_add_history/`, {
    to_volume: toVolume,
  });
  return data;
}
