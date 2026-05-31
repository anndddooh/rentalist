import { useEffect, useState } from "react";
import { getCover } from "../api/series.js";
import CoverImage from "./CoverImage.jsx";

/**
 * 指定シリーズ・指定巻の表紙を表示する。
 * initialUrl があればそれを使い、無ければ遅延取得（取得後サーバ側でキャッシュ）。
 *
 * refetchVolume を指定すると、initialUrl（1巻フォールバック）で即表示しつつ、
 * 裏で当該巻の実表紙を取りに行く。本表紙が取れたときだけ差し替える
 * （発売前の仮表紙 provisional は差し替えず、発売後に拾えるよう毎回試行する）。
 * マウント時に走るので「別画面からの遷移・リロード」が再取得トリガーになる。
 */
export default function SeriesCover({
  seriesId,
  volume,
  initialUrl = null,
  refetchVolume = null,
  alt,
  className,
}) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    let active = true;
    // initialUrl が無ければ当該巻を遅延取得（従来動作。取得時サーバ側でキャッシュ）。
    if (!initialUrl) {
      getCover(seriesId, volume)
        .then((cover) => {
          if (active) setUrl(cover.resolved_url);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }

    // initialUrl あり: まずそれを表示。
    setUrl(initialUrl);
    // フォールバック表示中（refetchVolume 指定）なら裏で実表紙を取りに行く。
    if (refetchVolume != null) {
      getCover(seriesId, refetchVolume)
        .then((cover) => {
          // 本表紙が取れたときだけ差し替える。仮表紙(provisional)や取得失敗は
          // フォールバックのまま据え置き、次回マウント時に再試行する。
          if (active && cover.resolved_url && !cover.provisional) {
            setUrl(cover.resolved_url);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [seriesId, volume, initialUrl, refetchVolume]);

  return <CoverImage url={url} alt={alt} className={className} />;
}
