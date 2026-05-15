import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCover } from "../api/series.js";
import CoverImage from "./CoverImage.jsx";
import StarRating from "./StarRating.jsx";

export const AVAILABILITY = {
  available: { label: "貸出あり", cls: "bg-emerald-100 text-emerald-700" },
  unavailable: { label: "貸出なし", cls: "bg-slate-200 text-slate-500" },
  unknown: { label: "未確認", cls: "bg-amber-100 text-amber-700" },
};

/**
 * ホームのシリーズカード。shopMode=true のとき手掛かり情報と
 * 貸出状況バッジを展開表示する（適応表示）。
 */
export default function SeriesCard({
  series,
  shopMode = false,
  onRent,
  onCycleAvailability,
}) {
  const [coverUrl, setCoverUrl] = useState(series.next_cover_url);

  useEffect(() => {
    let active = true;
    if (series.next_cover_url) {
      setCoverUrl(series.next_cover_url);
    } else {
      getCover(series.id, series.next_volume)
        .then((cover) => {
          if (active) setCoverUrl(cover.resolved_url);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [series.id, series.next_volume, series.next_cover_url]);

  const avail = AVAILABILITY[series.availability_status] || AVAILABILITY.unknown;

  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Link to={`/series/${series.id}`}>
          <CoverImage url={coverUrl} alt={series.title} className="h-28 w-20" />
        </Link>
        <div className="flex flex-1 flex-col">
          <Link
            to={`/series/${series.id}`}
            className="font-bold leading-tight text-slate-800"
          >
            {series.title}
          </Link>
          <div className="mt-1 text-sm text-slate-500">
            次の巻:{" "}
            <span className="font-semibold text-brand">
              {series.next_volume}巻
            </span>
          </div>
          <StarRating value={series.favorite_score} size="text-sm" />

          {shopMode && (
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              {series.author && (
                <div>
                  作者: {series.author}
                  {series.author_kana && `（${series.author_kana}）`}
                </div>
              )}
              {series.publisher && <div>出版社: {series.publisher}</div>}
              {series.magazine_label && (
                <div>掲載誌・レーベル: {series.magazine_label}</div>
              )}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={() => onRent(series)}
              className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white active:bg-brand-dark"
            >
              レンタル
              {series.cart_count > 0 && ` (カート${series.cart_count})`}
            </button>
            {shopMode && (
              <button
                onClick={() => onCycleAvailability(series)}
                className={`rounded px-2 py-1 text-xs font-semibold ${avail.cls}`}
              >
                {avail.label} ⇄
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
