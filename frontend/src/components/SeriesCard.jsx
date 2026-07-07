import { Link } from "react-router-dom";
import SeriesCover from "./SeriesCover.jsx";

export const AVAILABILITY = {
  available: { label: "貸出あり", cls: "bg-emerald-100 text-emerald-700" },
  unavailable: { label: "貸出なし", cls: "bg-inset text-ink-faint" },
  unknown: { label: "未確認", cls: "bg-amber-100 text-amber-700" },
};

/**
 * ホームのシリーズカード。
 * - モバイル: 表紙が左・情報が右の横並び
 * - デスクトップ (md+): 表紙を主役にした縦長ポスター
 * shopMode=true のとき貸出状況バッジ（切替可）を表示する。
 */
export default function SeriesCard({
  series,
  shopMode = false,
  onRent,
  onCycleAvailability,
}) {
  const avail = AVAILABILITY[series.availability_status] || AVAILABILITY.unknown;
  const readCount =
    series.current_volume ?? Math.max(0, (series.next_volume || 1) - 1);

  return (
    <div className="flex gap-3.5 rounded-card bg-card p-3.5 shadow-card md:flex-col md:gap-3">
      <Link to={`/series/${series.id}`} className="relative shrink-0 md:w-full">
        <SeriesCover
          seriesId={series.id}
          volume={series.next_volume}
          initialUrl={series.next_cover_url}
          refetchVolume={
            series.next_cover_is_fallback ? series.next_volume : null
          }
          alt={series.title}
          className="h-28 w-20 rounded-[10px] md:aspect-[2/3] md:h-auto md:w-full md:rounded-xl"
        />
        {/* デスクトップ: 表紙上に濃ピルで次巻を表示 */}
        <span className="absolute left-2.5 top-2.5 hidden rounded-full bg-ink/85 px-3 py-1 text-xs font-bold text-white md:inline-block">
          次は {series.next_volume}巻
        </span>
      </Link>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/series/${series.id}`}
            className="font-bold leading-tight text-ink md:text-base"
          >
            {series.title}
          </Link>
          {shopMode && (
            <button
              onClick={() => onCycleAvailability(series)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${avail.cls}`}
            >
              {avail.label} ⇄
            </button>
          )}
        </div>

        {series.author && (
          <div className="mt-0.5 text-xs text-ink-muted">
            {series.author}
            {series.author_kana && (
              <span className="text-ink-faint">（{series.author_kana}）</span>
            )}
          </div>
        )}
        {(series.publisher || series.magazine_label) && (
          <div className="mt-px text-[11px] text-ink-faint">
            {[series.publisher, series.magazine_label]
              .filter(Boolean)
              .join(" ・ ")}
          </div>
        )}

        {/* モバイル: 次巻チップ＋読了/★ */}
        <div className="mt-1.5 flex items-center gap-1.5 md:hidden">
          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-text">
            次は {series.next_volume}巻
          </span>
          {!shopMode && (
            <span className="text-[11px] text-ink-muted">
              読了 {readCount} ・ ★{series.favorite_score || 0}
            </span>
          )}
        </div>

        {/* デスクトップ: メタ情報を1行に */}
        <div className="mt-1 hidden text-xs text-ink-muted md:block">
          読了 {readCount}巻 ・ ★{series.favorite_score || 0}
          {series.cart_count > 0 && ` ・ カート×${series.cart_count}`}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            onClick={() => onRent(series)}
            className="flex-1 rounded-full bg-brand py-2 text-center text-sm font-bold text-white active:bg-brand-strong"
          >
            レンタル
          </button>
          {series.cart_count > 0 && (
            <span className="text-xs font-semibold text-ink-muted md:hidden">
              カート×{series.cart_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
