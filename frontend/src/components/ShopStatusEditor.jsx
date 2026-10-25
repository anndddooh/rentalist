import { useState } from "react";
import { setAvailability } from "../api/series.js";
import { useToast } from "../context/ToastContext.jsx";
import { errorMessage } from "../lib/errors.js";
import { AVAILABILITY } from "./SeriesCard.jsx";

const CYCLE = {
  unknown: "available",
  available: "unavailable",
  unavailable: "unknown",
};

/**
 * シリーズのショップ別貸出状況を編集する。
 * statusMap は { [shopId]: "available"|"unavailable" }（不在は未確認）。
 */
export default function ShopStatusEditor({ seriesId, shops, statusMap = {} }) {
  const [local, setLocal] = useState(statusMap);
  const toast = useToast();

  async function cycle(shopId) {
    const current = local[shopId] || "unknown";
    const next = CYCLE[current];
    try {
      await setAvailability(seriesId, shopId, next);
      setLocal((prev) => {
        const updated = { ...prev };
        if (next === "unknown") delete updated[shopId];
        else updated[shopId] = next;
        return updated;
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
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
