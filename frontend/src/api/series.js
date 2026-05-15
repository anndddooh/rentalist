import api from "./client.js";

export async function listSeries({ status, shop } = {}) {
  const params = {};
  if (status) params.status = status;
  if (shop) params.shop = shop;
  const { data } = await api.get("/series/", { params });
  return data.results ?? data;
}

export async function getSeries(id) {
  const { data } = await api.get(`/series/${id}/`);
  return data;
}

export async function createSeries(payload) {
  const { data } = await api.post("/series/", payload);
  return data;
}

export async function updateSeries(id, payload) {
  const { data } = await api.patch(`/series/${id}/`, payload);
  return data;
}

export async function deleteSeries(id) {
  await api.delete(`/series/${id}/`);
}

export async function searchSeries(q) {
  const { data } = await api.get("/series/search/", { params: { q } });
  return data;
}

export async function getCover(seriesId, volume) {
  const { data } = await api.get(`/series/${seriesId}/cover/`, {
    params: { volume },
  });
  return data;
}

export async function setCover(seriesId, { volumeNumber, imageUrl, imageFile }) {
  if (imageFile) {
    const form = new FormData();
    form.append("volume_number", volumeNumber);
    form.append("image_file", imageFile);
    const { data } = await api.put(`/series/${seriesId}/cover/`, form);
    return data;
  }
  const { data } = await api.put(`/series/${seriesId}/cover/`, {
    volume_number: volumeNumber,
    image_url: imageUrl,
  });
  return data;
}

export async function setAvailability(seriesId, shopId, status) {
  const { data } = await api.put(`/series/${seriesId}/availability/`, {
    shop_id: shopId,
    status,
  });
  return data;
}
