import { useEffect, useState } from "react";
import { addHistory, deleteHistory, listHistory } from "../api/history.js";
import { listSeries } from "../api/series.js";
import { errorMessage } from "../lib/errors.js";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function History() {
  const [entries, setEntries] = useState([]);
  const [allSeries, setAllSeries] = useState([]);
  const [filterSeries, setFilterSeries] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    seriesId: "",
    volumeNumber: "",
    rentedAt: todayISODate(),
  });
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setEntries(await listHistory(filterSeries || undefined));
    } finally {
      setLoading(false);
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
    load();
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-700">レンタル履歴</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white"
        >
          {showForm ? "閉じる" : "+ 追加"}
        </button>
      </div>

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
      )}
    </div>
  );
}
