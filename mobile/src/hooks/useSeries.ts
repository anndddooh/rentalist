import { useQuery } from "@tanstack/react-query";
import { getSeries, listSeries } from "@/api/series";
import type { SeriesStatus } from "@/api/types";

export function seriesListKey(status: SeriesStatus, shop?: number | null) {
  return shop ? ["series", status, { shop }] : ["series", status];
}

export function useSeriesList(status: SeriesStatus, shop?: number | null) {
  return useQuery({
    queryKey: seriesListKey(status, shop),
    queryFn: () => listSeries({ status, shop: shop ?? undefined }),
  });
}

/** 全ステータスのシリーズ一覧（履歴フィルタ・手動追加のシリーズ選択用） */
export function useSeriesListAll() {
  return useQuery({
    queryKey: ["series", "all"],
    queryFn: () => listSeries(),
  });
}

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: ["series", "detail", id],
    queryFn: () => getSeries(id),
    enabled: Number.isFinite(id),
  });
}
