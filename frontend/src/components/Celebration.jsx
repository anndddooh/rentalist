import { useMemo } from "react";

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

/**
 * シリーズを読破（最終巻まで到達）したときのお祝い演出。
 * titles に読破したシリーズ名を渡す。
 */
export default function Celebration({ titles = [], onClose }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.2 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 9,
      })),
    []
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="confetti"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="pop-in mx-6 rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-2 text-xl font-bold text-brand">読破おめでとう！</h2>
        <ul className="mt-3 space-y-1">
          {titles.map((title) => (
            <li key={title} className="font-bold text-slate-700">
              {title}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">最終巻まで読み終えました 🏆</p>
        <button
          onClick={onClose}
          className="mt-4 rounded-full bg-brand px-8 py-2 text-sm font-semibold text-white"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
