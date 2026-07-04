import api from "./client";
import type {
  AvailabilityStatus,
  Paginated,
  RakutenCandidate,
  Series,
  SeriesStatus,
  VolumeCover,
} from "./types";

export async function listSeries(
  { status, shop }: { status?: SeriesStatus; shop?: number | string } = {}
): Promise<Series[]> {
  const params: Record<string, string | number> = {};
  if (status) params.status = status;
  if (shop) params.shop = shop;
  const { data } = await api.get<Paginated<Series> | Series[]>("/series/", {
    params,
  });
  return Array.isArray(data) ? data : data.results;
}

export async function getSeries(id: number): Promise<Series> {
  const { data } = await api.get<Series>(`/series/${id}/`);
  return data;
}

export type SeriesPayload = Partial<
  Pick<
    Series,
    | "title"
    | "author"
    | "author_kana"
    | "publisher"
    | "magazine_label"
    | "status"
    | "total_volumes"
    | "favorite_score"
  >
> & { cover_url?: string | null };

export async function createSeries(payload: SeriesPayload): Promise<Series> {
  const { data } = await api.post<Series>("/series/", payload);
  return data;
}

export async function updateSeries(
  id: number,
  payload: SeriesPayload
): Promise<Series> {
  const { data } = await api.patch<Series>(`/series/${id}/`, payload);
  return data;
}

export async function deleteSeries(id: number): Promise<void> {
  await api.delete(`/series/${id}/`);
}

export async function searchSeries(q: string): Promise<RakutenCandidate[]> {
  const { data } = await api.get<RakutenCandidate[]>("/series/search/", {
    params: { q },
  });
  return data;
}

export async function getCover(
  seriesId: number,
  volume: number
): Promise<VolumeCover> {
  const { data } = await api.get<VolumeCover>(`/series/${seriesId}/cover/`, {
    params: { volume },
  });
  return data;
}

/** RN の FormData 用ファイル参照（expo-image-picker の asset から作る） */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

export async function setCover(
  seriesId: number,
  {
    volumeNumber,
    imageUrl,
    imageFile,
  }: { volumeNumber: number; imageUrl?: string; imageFile?: UploadFile }
): Promise<VolumeCover> {
  if (imageFile) {
    const form = new FormData();
    form.append("volume_number", String(volumeNumber));
    // RN の FormData は {uri, name, type} を受ける。Content-Type ヘッダは
    // 手動設定しない（boundary が欠落して 400 になるため）。
    form.append("image_file", imageFile as unknown as Blob);
    const { data } = await api.put<VolumeCover>(
      `/series/${seriesId}/cover/`,
      form
    );
    return data;
  }
  const { data } = await api.put<VolumeCover>(`/series/${seriesId}/cover/`, {
    volume_number: volumeNumber,
    image_url: imageUrl,
  });
  return data;
}

export async function setAvailability(
  seriesId: number,
  shopId: number,
  status: AvailabilityStatus
) {
  const { data } = await api.put(`/series/${seriesId}/availability/`, {
    shop_id: shopId,
    status,
  });
  return data;
}

export async function bulkAddHistory(seriesId: number, toVolume: number) {
  const { data } = await api.post(`/series/${seriesId}/bulk_add_history/`, {
    to_volume: toVolume,
  });
  return data;
}
