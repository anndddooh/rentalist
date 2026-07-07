import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries, updateSeries } from "../api/series.js";
import { listShops } from "../api/shops.js";
import PageHeader, { RoundButton } from "../components/PageHeader.jsx";
import SeriesCover from "../components/SeriesCover.jsx";
import ShopStatusEditor from "../components/ShopStatusEditor.jsx";
import StarRating from "../components/StarRating.jsx";

export default function Wishlist() {
  const [series, setSeries] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setSeries(await listSeries({ status: "wishlist" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    listShops().then(setShops).catch(() => {});
  }, []);

  async function startReading(id) {
    await updateSeries(id, { status: "active" });
    load();
  }

  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader
        eyebrow={`いつか読みたい ${series.length}作品`}
        title="読みたい"
        actions={
          <RoundButton to="/add" icon="plus" label="シリーズを追加" strokeWidth={2.4} />
        }
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          読みたいリストは空です。右上の＋からシリーズを追加できます。
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
                    onClick={() => startReading(s.id)}
                    className="mt-auto w-full rounded-full border-[1.5px] border-brand py-2 text-center text-sm font-bold text-brand"
                  >
                    読み始める
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
