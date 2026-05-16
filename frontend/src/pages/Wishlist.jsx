import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries, updateSeries } from "../api/series.js";
import { listShops } from "../api/shops.js";
import ShopStatusEditor from "../components/ShopStatusEditor.jsx";
import StarRating from "../components/StarRating.jsx";

export default function Wishlist() {
  const [series, setSeries] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
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
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-bold text-slate-700">
        いつか読みたい（Wishlist）
      </h1>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Wishlist は空です。＋からシリーズを追加できます。
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <div key={s.id} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  to={`/series/${s.id}`}
                  className="font-bold text-slate-800"
                >
                  {s.title}
                </Link>
                {s.author && (
                  <div className="text-xs text-slate-500">{s.author}</div>
                )}
                <StarRating value={s.favorite_score} size="text-sm" />
              </div>
              <button
                onClick={() => startReading(s.id)}
                className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white"
              >
                読み始める
              </button>
            </div>
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="mt-2 text-xs text-brand underline"
            >
              {expanded === s.id ? "貸出状況を閉じる" : "ショップ別の貸出状況"}
            </button>
            {expanded === s.id && (
              <div className="mt-2 border-t border-slate-100 pt-2">
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
