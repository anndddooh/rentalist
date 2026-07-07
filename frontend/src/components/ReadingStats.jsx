import { useEffect, useMemo, useState } from "react";
import { getReadingStats } from "../api/history.js";

// "2025-03" や "2025" を短いラベルに整形する
function shortLabel(period, unit) {
  if (unit === "yearly") return `${period}`;
  const [, m] = period.split("-");
  return `${Number(m)}月`;
}

// 欠けている期間を 0 件で埋めて推移を連続させる
function fillGaps(data, unit) {
  if (data.length === 0) return [];
  const counts = new Map(data.map((d) => [d.period, d.count]));
  const out = [];
  if (unit === "yearly") {
    const start = Number(data[0].period);
    const end = Number(data[data.length - 1].period);
    for (let y = start; y <= end; y += 1) {
      const p = String(y);
      out.push({ period: p, count: counts.get(p) || 0 });
    }
  } else {
    let [y, m] = data[0].period.split("-").map(Number);
    const [ey, em] = data[data.length - 1].period.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      const p = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ period: p, count: counts.get(p) || 0 });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return out;
}

/**
 * 履歴ページ上部の読書統計カード（濃色 bg-ink）。
 * 直近の期間を縦棒グラフで表示し、最新期間だけをハイライトする。
 * reloadToken が変わると（履歴の追加・削除時）再取得する。
 */
export default function ReadingStats({ reloadToken = 0 }) {
  const [stats, setStats] = useState(null);
  const [unit, setUnit] = useState("monthly");

  useEffect(() => {
    getReadingStats()
      .then(setStats)
      .catch(() => {});
  }, [reloadToken]);

  // 欠損補完して直近の期間だけ取り出す
  const series = useMemo(() => {
    if (!stats) return [];
    const filled = fillGaps(stats[unit] || [], unit);
    return filled.slice(-6);
  }, [stats, unit]);

  if (!stats) return null;

  const current = series.length > 0 ? series[series.length - 1].count : 0;
  const max = Math.max(1, ...series.map((d) => d.count));

  return (
    <div className="rounded-card bg-ink p-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            {unit === "monthly" ? "今月読んだ巻数" : "今年読んだ巻数"}
          </div>
          <div className="text-[34px] font-extrabold leading-tight tracking-tight">
            {current}
            <span className="ml-1 text-sm font-semibold text-white/50">巻</span>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-white/10 p-1">
          {[
            ["monthly", "月"],
            ["yearly", "年"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setUnit(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                unit === key ? "bg-white text-ink" : "text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {stats.total === 0 ? (
        <p className="mt-3 text-xs text-white/50">
          読破記録が増えると、ここに推移が表示されます。
        </p>
      ) : (
        <div className="mt-3 flex h-16 items-end gap-1.5">
          {series.map((d, i) => {
            const isLast = i === series.length - 1;
            const h = Math.max(6, (d.count / max) * 100);
            return (
              <div
                key={d.period}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={`w-full rounded-t-md ${
                    isLast ? "bg-brand" : "bg-white/20"
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span
                  className={`text-[10px] ${
                    isLast ? "font-bold text-white" : "text-white/50"
                  }`}
                >
                  {shortLabel(d.period, unit)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
