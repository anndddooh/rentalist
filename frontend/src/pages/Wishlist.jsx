import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listSeries, updateSeries } from "../api/series.js";
import { listShops } from "../api/shops.js";
import PageHeader, { RoundButton } from "../components/PageHeader.jsx";
import SeriesCover from "../components/SeriesCover.jsx";
import ShopStatusEditor from "../components/ShopStatusEditor.jsx";
import StarRating from "../components/StarRating.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { overlayPending } from "../lib/availabilitySync.js";
import { errorMessage } from "../lib/errors.js";

// 「いつか読みたい」と「中断」（読むのをやめた進行中シリーズ）を切り替えて表示する
const TABS = {
  wishlist: {
    label: "いつか読みたい",
    action: "読み始める",
    done: (title) => `「${title}」を読み始めました`,
    empty: "読みたいリストは空です。右上の＋からシリーズを追加できます。",
  },
  dropped: {
    label: "中断",
    action: "再開する",
    done: (title) => `「${title}」を再開しました`,
    empty: "中断中のシリーズはありません。シリーズ詳細のステータスで「中断」にできます。",
  },
};

export default function Wishlist() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "dropped" ? "dropped" : "wishlist";
  const [lists, setLists] = useState({ wishlist: [], dropped: [] });
  const series = lists[tab];
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const toast = useToast();

  async function load() {
    try {
      const startedAt = Date.now();
      const [wishlist, dropped] = await Promise.all([
        listSeries({ status: "wishlist" }),
        listSeries({ status: "dropped" }),
      ]);
      setLists({
        wishlist: overlayPending(wishlist, startedAt),
        dropped: overlayPending(dropped, startedAt),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    listShops().then(setShops).catch(() => {});
  }, []);

  async function startReading(target) {
    setStartingId(target.id);
    try {
      await updateSeries(target.id, { status: "active" });
      toast.success(TABS[tab].done(target.title));
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader
        eyebrow={`${TABS[tab].label} ${series.length}作品`}
        title="読みたい"
        actions={
          <RoundButton to="/add" icon="plus" label="シリーズを追加" strokeWidth={2.4} />
        }
      />

      <div className="flex rounded-full bg-inset p-1 md:max-w-sm">
        {Object.entries(TABS).map(([key, t]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams(key === "dropped" ? { tab: key } : {}, { replace: true })}
            className={`flex-1 rounded-full py-2 text-center text-[13px] font-bold ${
              tab === key ? "bg-card text-brand shadow-sm" : "text-ink-muted"
            }`}
          >
            {t.label}
            {!loading && <span className="ml-1 text-[11px] opacity-70">{lists[key].length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          {TABS[tab].empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <div key={s.id} className="rounded-card bg-card p-3.5 shadow-card">
              <div className="flex gap-3.5">
                <Link to={`/series/${s.id}`} className="shrink-0">
                  <SeriesCover
                    seriesId={s.id}
                    volume={1}
                    initialUrl={s.first_volume_cover_url}
                    alt={s.title}
                    className="h-28 w-20 rounded-[10px]"
                  />
                </Link>
                <div className="flex flex-1 flex-col min-w-0">
                  <Link
                    to={`/series/${s.id}`}
                    className="font-bold leading-tight text-ink"
                  >
                    {s.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    {s.author && <span>{s.author}</span>}
                    {s.author && <span className="text-ink-faint">・</span>}
                    <StarRating value={s.favorite_score} size="text-sm" />
                  </div>
                  <button
                    onClick={() => startReading(s)}
                    disabled={startingId === s.id}
                    className="mt-auto w-full rounded-full border-[1.5px] border-brand py-2 text-center text-sm font-bold text-brand active:bg-brand-soft disabled:opacity-50"
                  >
                    {startingId === s.id ? "更新中…" : TABS[tab].action}
                  </button>
                </div>
              </div>

              {shops.length > 0 && (
                <div className="mt-3 border-t border-line pt-2.5">
                  <ShopStatusEditor
                    seriesId={s.id}
                    shops={shops}
                    statusMap={s.availability_map}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
