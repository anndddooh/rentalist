import { useQuery } from "@tanstack/react-query";
import { getCover } from "@/api/series";
import CoverImage from "./CoverImage";

/**
 * 指定シリーズ・指定巻の表紙（frontend/src/components/SeriesCover.jsx の移植）。
 * - initialUrl が無ければ当該巻を遅延取得（サーバ側でキャッシュされる）
 * - initialUrl あり + refetchVolume 指定（1巻フォールバック表示中）なら、
 *   まず initialUrl を出しつつ裏で実表紙を取り、本表紙が取れたときだけ差し替える。
 *   発売前の仮表紙 (provisional) は差し替えず、次回表示時に再試行する。
 */
export default function SeriesCover({
  seriesId,
  volume,
  initialUrl = null,
  refetchVolume = null,
  className,
}: {
  seriesId: number;
  volume: number;
  initialUrl?: string | null;
  refetchVolume?: number | null;
  className?: string;
}) {
  const fetchVolume = initialUrl ? refetchVolume : volume;
  const { data } = useQuery({
    queryKey: ["cover", seriesId, fetchVolume],
    queryFn: () => getCover(seriesId, fetchVolume as number),
    enabled: fetchVolume != null,
    // web はマウント毎に再試行する挙動なので、キャッシュを新鮮扱いしない
    staleTime: 0,
  });

  let url: string | null;
  if (initialUrl) {
    const fetched =
      data?.resolved_url && !data.provisional ? data.resolved_url : null;
    url = fetched ?? initialUrl;
  } else {
    url = data?.resolved_url ?? null;
  }

  return <CoverImage url={url} className={className} />;
}
