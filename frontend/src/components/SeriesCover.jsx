import { useEffect, useState } from "react";
import { getCover } from "../api/series.js";
import CoverImage from "./CoverImage.jsx";

/**
 * 指定シリーズ・指定巻の表紙を表示する。
 * initialUrl があればそれを使い、無ければ遅延取得（取得後サーバ側でキャッシュ）。
 */
export default function SeriesCover({
  seriesId,
  volume,
  initialUrl = null,
  alt,
  className,
}) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    let active = true;
    if (initialUrl) {
      setUrl(initialUrl);
      return undefined;
    }
    getCover(seriesId, volume)
      .then((cover) => {
        if (active) setUrl(cover.resolved_url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [seriesId, volume, initialUrl]);

  return <CoverImage url={url} alt={alt} className={className} />;
}
