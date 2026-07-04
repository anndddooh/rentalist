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

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: ["series", "detail", id],
    queryFn: () => getSeries(id),
    enabled: Number.isFinite(id),
  });
}
