import { useEffect, useMemo, useState } from "react";
import { getReadingStats } from "../api/history.js";

// "2025-03" や "2025" を表示用ラベルに整形する
function periodLabel(period, unit) {
  if (unit === "yearly") return `${period}年`;
  const [y, m] = period.split("-");
  return `${y}/${Number(m)}`;
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

// 期間ごとの巻数を横棒で表示
function PeriodBars({ data, unit }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
      {data.map((d) => (
        <div key={d.period} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-right text-slate-500">
            {periodLabel(d.period, unit)}
          </span>
          <div className="h-4 flex-1 rounded bg-slate-100">
            <div
              className="h-full rounded bg-brand"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-7 shrink-0 text-right font-semibold text-slate-600">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// 累計の推移を SVG の面グラフで表示
function CumulativeChart({ data }) {
  const W = 320;
  const H = 90;
  const pad = 6;
  const max = Math.max(1, ...data.map((d) => d.cumulative));
  const n = data.length;
  const x = (i) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const line = data.map((d, i) => `${x(i)},${y(d.cumulative)}`).join(" ");
  const area = `${x(0)},${H - pad} ${line} ${x(n - 1)},${H - pad}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <polygon points={area} fill="#ede9fe" />
      <polyline points={line} fill="none" stroke="#5b21b6" strokeWidth="2" />
    </svg>
  );
}

/**
 * 履歴ページに埋め込む読書統計セクション。
 * reloadToken が変わると（履歴の追加・削除時）再取得する。
 */
export default function ReadingStats({ reloadToken = 0 }) {
  const [stats, setStats] = useState(null);
  const [unit, setUnit] = useState("monthly");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    getReadingStats()
      .then(setStats)
      .catch(() => {});
  }, [reloadToken]);

  // 欠損補完＋累計を計算（unit 切替・データ変更で再計算）
  const series = useMemo(() => {
    if (!stats) return [];
    const filled = fillGaps(stats[unit] || [], unit);
    let running = 0;
    return filled.map((d) => {
      running += d.count;
      return { ...d, cumulative: running };
    });
  }, [stats, unit]);

  if (!stats) return null;

  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-sm font-bold text-slate-700">📊 読書統計</span>
        <span className="text-xs text-slate-400">
          {open ? "閉じる ▲" : "開く ▼"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {stats.total === 0 ? (
            <p className="text-xs text-slate-400">
              読破記録が増えると、ここに統計が表示されます。
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  これまでに読んだ巻数{" "}
                  <span className="text-lg font-bold text-brand">
                    {stats.total}
                  </span>{" "}
                  巻
                </p>
                <div className="flex gap-1">
                  {[
                    ["monthly", "月"],
                    ["yearly", "年"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setUnit(key)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        unit === key
                          ? "bg-brand text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  {unit === "monthly" ? "月" : "年"}ごとの読んだ巻数
                </p>
                <PeriodBars data={series} unit={unit} />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  累計の推移
                </p>
                <CumulativeChart data={series} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
