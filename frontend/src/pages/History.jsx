import { useEffect, useState } from "react";
import {
  addHistory,
  deleteHistory,
  listHistory,
  listHistoryNextPage,
} from "../api/history.js";
import { listSeries } from "../api/series.js";
import PageHeader from "../components/PageHeader.jsx";
import ReadingStats from "../components/ReadingStats.jsx";
import { errorMessage } from "../lib/errors.js";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function History() {
  const [entries, setEntries] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [allSeries, setAllSeries] = useState([]);
  const [filterSeries, setFilterSeries] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    seriesId: "",
    volumeNumber: "",
    rentedAt: todayISODate(),
  });
  const [error, setError] = useState("");
  // 履歴の追加・削除時にこの値を変えて統計セクションを再取得させる
  const [statsToken, setStatsToken] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const data = await listHistory(filterSeries || undefined);
      setEntries(data.results);
      setNextUrl(data.next);
      setTotalCount(data.count);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const data = await listHistoryNextPage(nextUrl);
      setEntries((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
  }, [filterSeries]);

  useEffect(() => {
    listSeries().then(setAllSeries).catch(() => {});
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await addHistory({
        seriesId: Number(form.seriesId),
        volumeNumber: Number(form.volumeNumber),
        rentedAt: new Date(form.rentedAt).toISOString(),
      });
      setShowForm(false);
      setForm({ seriesId: "", volumeNumber: "", rentedAt: todayISODate() });
      setStatsToken((t) => t + 1);
      // 追加された巻が rented_at 順のどこに入るか分からないので全件リロード
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        "この履歴を削除しますか？（読まずに返却した場合など）巻数が再計算されます。"
      )
    ) {
      return;
    }
    await deleteHistory(id);
    // ロード済みの items を保ったまま、削除分だけ取り除く（pagination 位置を維持）
    setEntries((prev) => prev.filter((h) => h.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
    setStatsToken((t) => t + 1);
  }

  return (
    <div className="space-y-4 p-4 md:mx-auto md:max-w-2xl md:p-8">
      <PageHeader
        eyebrow={`これまでに ${totalCount}巻`}
        title="履歴"
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white active:bg-brand-strong"
          >
            {showForm ? "閉じる" : "＋ 追加"}
          </button>
        }
      />

      <ReadingStats reloadToken={statsToken} />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-card bg-card p-4 shadow-card"
        >
          {error && (
            <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">
              {error}
            </p>
          )}
          <select
            required
            value={form.seriesId}
            onChange={(e) => setForm({ ...form, seriesId: e.target.value })}
            className="input"
          >
            <option value="">シリーズを選択</option>
            {allSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            required
            placeholder="巻数"
            value={form.volumeNumber}
            onChange={(e) => setForm({ ...form, volumeNumber: e.target.value })}
            className="input"
          />
          <input
            type="date"
            required
            value={form.rentedAt}
            onChange={(e) => setForm({ ...form, rentedAt: e.target.value })}
            className="input"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-brand py-2.5 text-sm font-bold text-white active:bg-brand-strong"
          >
            履歴に追加
          </button>
        </form>
      )}

      {/* フィルタ */}
      <div className="flex items-center gap-2">
        <span
          className={`chip ${
            filterSeries ? "bg-card text-ink-muted shadow-sm" : "bg-ink text-white"
          }`}
        >
          すべて
        </span>
        <div className="relative">
          <select
            value={filterSeries}
            onChange={(e) => setFilterSeries(e.target.value)}
            className="chip appearance-none bg-card pr-8 text-ink-muted shadow-sm"
          >
            <option value="">シリーズで絞る</option>
            {allSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
            ▾
          </span>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          履歴がありません。
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-card bg-card shadow-card">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">
                    {entry.series_title}{" "}
                    <span className="text-brand">{entry.volume_number}巻</span>
                  </div>
                  <div className="text-[11px] text-ink-faint">
                    {new Date(entry.rented_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs font-semibold text-rose-500"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          {nextUrl && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="block w-full py-1 text-center text-sm font-bold text-brand disabled:opacity-50"
            >
              {loadingMore
                ? "読み込み中…"
                : `もっと読み込む（残り ${totalCount - entries.length}件）`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
