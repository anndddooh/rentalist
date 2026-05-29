import api from "./client.js";

export async function listHistory(seriesId) {
  const params = seriesId ? { series_id: seriesId } : {};
  const { data } = await api.get("/history/", { params });
  return data.results ?? data;
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
