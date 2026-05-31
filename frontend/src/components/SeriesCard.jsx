import { Link } from "react-router-dom";
import SeriesCover from "./SeriesCover.jsx";
import StarRating from "./StarRating.jsx";

export const AVAILABILITY = {
  available: { label: "貸出あり", cls: "bg-emerald-100 text-emerald-700" },
  unavailable: { label: "貸出なし", cls: "bg-slate-200 text-slate-500" },
  unknown: { label: "未確認", cls: "bg-amber-100 text-amber-700" },
};

/**
 * ホームのシリーズカード。
 * - モバイル: 表紙が左・情報が右の横並び
 * - デスクトップ (md+): 表紙を主役にした縦長ポスター
 * shopMode=true のとき手掛かり情報と貸出状況バッジを展開表示する。
 */
export default function SeriesCard({
  series,
  shopMode = false,
  onRent,
  onCycleAvailability,
}) {
  const avail = AVAILABILITY[series.availability_status] || AVAILABILITY.unknown;

  return (
    <div className="flex gap-3 rounded-lg bg-white p-3 shadow-sm md:flex-col md:gap-2">
      <Link
        to={`/series/${series.id}`}
        className="relative shrink-0 md:w-full"
      >
        <SeriesCover
          seriesId={series.id}
          volume={series.next_volume}
          initialUrl={series.next_cover_url}
          refetchVolume={
            series.next_cover_is_fallback ? series.next_volume : null
          }
          alt={series.title}
          className="h-28 w-20 md:h-auto md:w-full md:aspect-[2/3]"
        />
        <span className="absolute left-1 top-1 rounded bg-brand/90 px-1.5 py-0.5 text-xs font-bold text-white md:left-2 md:top-2 md:text-sm">
          次 {series.next_volume}巻
        </span>
      </Link>
      <div className="flex flex-1 flex-col">
        <Link
          to={`/series/${series.id}`}
          className="font-bold leading-tight text-slate-800 md:text-lg"
        >
          {series.title}
        </Link>
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
  );
}
