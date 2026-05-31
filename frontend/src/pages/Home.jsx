import { useCallback, useEffect, useState } from "react";
import { addToCart } from "../api/cart.js";
import { listSeries, setAvailability } from "../api/series.js";
import { listShops } from "../api/shops.js";
import SeriesCard from "../components/SeriesCard.jsx";
import { useCart } from "../context/CartContext.jsx";
import { errorMessage } from "../lib/errors.js";

// 貸出状況バッジをタップしたときの遷移順
const STATUS_CYCLE = {
  unknown: "available",
  available: "unavailable",
  unavailable: "unknown",
};

const STATUS_FILTERS = [
  { key: "available", label: "あり" },
  { key: "unknown", label: "未確認" },
  { key: "unavailable", label: "なし" },
];

export default function Home() {
  const [series, setSeries] = useState([]);
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [filters, setFilters] = useState({
    available: true,
    unknown: true,
    unavailable: false,
  });
  // 直前に貸出状況を切替えたカードはフィルタを無視して残す。
  // 「貸出なし」フィルタ OFF のまま「あり→なし」にサイクルしてもカードが消えない。
  const [stickyIds, setStickyIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const { refreshCart } = useCart();

  // loading は初回のみ true。レンタル等の再取得ではグリッドを保持し、
  // 一覧をアンマウントしない（スクロール位置が飛ぶのを防ぐ）。
  const load = useCallback(async () => {
    try {
      const data = await listSeries({
        status: "active",
        shop: shopId || undefined,
      });
      setSeries(data);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    listShops().then(setShops).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  }

  async function handleRent(target) {
    try {
      await addToCart(target.id);
      flash(`「${target.title}」をカートに追加しました`);
      refreshCart();
      load();
    } catch (err) {
      flash(errorMessage(err));
    }
  }

  async function handleCycleAvailability(target) {
    const current = target.availability_status || "unknown";
    const next = STATUS_CYCLE[current];
    // 楽観更新: 先にローカル state を書き換えてバッジ色を即時反映。
    // sticky に積んで、フィルタ外のステータスへ切替えてもカードが消えないようにする。
    setSeries((prev) =>
      prev.map((s) =>
        s.id === target.id ? { ...s, availability_status: next } : s
      )
    );
    setStickyIds((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(target.id);
      return nextSet;
    });
    try {
      await setAvailability(target.id, Number(shopId), next);
    } catch (err) {
      // 失敗時はロールバック
      setSeries((prev) =>
        prev.map((s) =>
          s.id === target.id ? { ...s, availability_status: current } : s
        )
      );
      flash(errorMessage(err));
    }
  }

  function toggleFilter(key) {
    // ユーザーが明示的にフィルタを操作したら sticky をリセット
    setStickyIds(new Set());
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleShopChange(value) {
    setStickyIds(new Set());
    setShopId(value);
  }

  const shopMode = Boolean(shopId);
  const visibleSeries = shopMode
    ? series.filter(
        (s) =>
          filters[s.availability_status || "unknown"] || stickyIds.has(s.id)
      )
    : series;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-lg bg-white p-3 shadow-sm md:max-w-sm">
        <label className="text-xs font-semibold text-slate-500">
          ショップで絞り込み
        </label>
        <select
          value={shopId}
          onChange={(e) => handleShopChange(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">絞り込みなし（全シリーズ）</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>

        {shopMode && (
          <div className="mt-2 flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filters[f.key]
                    ? "bg-brand text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : visibleSeries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          進行中のシリーズがありません。右下の＋から追加できます。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleSeries.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              shopMode={shopMode}
              onRent={handleRent}
              onCycleAvailability={handleCycleAvailability}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
