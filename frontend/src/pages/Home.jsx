import { useCallback, useEffect, useState } from "react";
import { addToCart } from "../api/cart.js";
import { listSeries, setAvailability } from "../api/series.js";
import { listShops } from "../api/shops.js";
import PageHeader, { RoundButton } from "../components/PageHeader.jsx";
import SeriesCard from "../components/SeriesCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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
  const { cartCount, refreshCart } = useCart();
  const { user } = useAuth();

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
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader
        eyebrow={`こんにちは、${user?.username ?? ""}さん`}
        title="つづきを借りる"
        actions={
          <>
            <RoundButton to="/add" icon="plus" label="シリーズを追加" strokeWidth={2.4} />
            <RoundButton to="/cart" icon="cart" label="カート" badge={cartCount} />
          </>
        }
      />

      {/* ショップ切替チップ列 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <button
          onClick={() => handleShopChange("")}
          className={`chip shrink-0 ${
            !shopMode
              ? "bg-ink text-white"
              : "bg-card text-ink-muted shadow-sm"
          }`}
        >
          すべて
        </button>
        {shops.map((shop) => (
          <button
            key={shop.id}
            onClick={() => handleShopChange(String(shop.id))}
            className={`chip shrink-0 ${
              String(shop.id) === shopId
                ? "bg-brand text-white"
                : "bg-card text-ink-muted shadow-sm"
            }`}
          >
            {shop.name}
          </button>
        ))}
      </div>

      {shopMode && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-ink-faint">在庫:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                filters[f.key]
                  ? "bg-ink text-white"
                  : "bg-card text-ink-faint shadow-sm"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : visibleSeries.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          進行中のシリーズがありません。右上の＋から追加できます。
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
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
