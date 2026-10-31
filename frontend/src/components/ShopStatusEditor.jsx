import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { changeAvailability, subscribeAvailability } from "../lib/availabilitySync.js";
import { errorMessage } from "../lib/errors.js";
import { AVAILABILITY } from "./SeriesCard.jsx";

const EMPTY = {};

const CYCLE = {
  unknown: "available",
  available: "unavailable",
  unavailable: "unknown",
};

/**
 * シリーズのショップ別貸出状況を編集する。
 * statusMap は { [shopId]: "available"|"unavailable" }（不在は未確認）。
 * 送信は lib/availabilitySync.js が担い、押した瞬間に表示を切り替える。
 */
export default function ShopStatusEditor({ seriesId, shops, statusMap = EMPTY }) {
  const [local, setLocal] = useState(statusMap);
  const toast = useToast();

  // 親が再取得したら追従する（以前は初回の値を持ち続けていた）
  useEffect(() => setLocal(statusMap), [statusMap]);

  useEffect(
    () =>
      subscribeAvailability((sid, shopId, status) => {
        if (sid !== seriesId) return;
        setLocal((prev) => {
          const updated = { ...prev };
          if (status === "unknown") delete updated[shopId];
          else updated[shopId] = status;
          return updated;
        });
      }),
    [seriesId]
  );

  function cycle(shopId) {
    const current = local[shopId] || "unknown";
    changeAvailability(seriesId, shopId, current, CYCLE[current], {
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  if (shops.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        ショップが未登録です。設定画面から登録できます。
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {shops.map((shop) => {
        const status = local[shop.id] || "unknown";
        const meta = AVAILABILITY[status];
        return (
          <li key={shop.id} className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">{shop.name}</span>
            <button
              onClick={() => cycle(shop.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}
            >
              {meta.label} ⇄
            </button>
          </li>
        );
      })}
    </ul>
  );
}
