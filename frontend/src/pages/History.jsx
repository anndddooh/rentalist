import { useEffect, useState } from "react";
import {
  addHistory,
  deleteHistory,
  listHistory,
  listHistoryNextPage,
} from "../api/history.js";
import { listSeries } from "../api/series.js";
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
    <div className="space-y-3 p-3 md:mx-auto md:max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-700">レンタル履歴</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white"
        >
          {showForm ? "閉じる" : "+ 追加"}
        </button>
      </div>

      <ReadingStats reloadToken={statsToken} />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-lg bg-white p-3 shadow-sm"
        >
          {error && (
            <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
              {error}
            </p>
          )}
          <select
            required
            value={form.seriesId}
            onChange={(e) => setForm({ ...form, seriesId: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
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
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            required
            value={form.rentedAt}
            onChange={(e) => setForm({ ...form, rentedAt: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded bg-brand py-2 text-sm font-semibold text-white"
          >
            履歴に追加
          </button>
        </form>
      )}

      <select
        value={filterSeries}
        onChange={(e) => setFilterSeries(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">すべてのシリーズ</option>
        {allSeries.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          履歴がありません。
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            全 {totalCount}件{entries.length < totalCount ? `（${entries.length}件表示中）` : ""}
          </p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
              >
                <div className="text-sm">
                  <span className="font-semibold">{entry.series_title}</span>{" "}
                  <span className="text-brand">{entry.volume_number}巻</span>
                  <div className="text-xs text-slate-400">
                    {new Date(entry.rented_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs text-rose-500 underline"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
          {nextUrl && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
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
