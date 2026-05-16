import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSeries, searchSeries } from "../api/series.js";
import CoverImage from "../components/CoverImage.jsx";
import StarRating from "../components/StarRating.jsx";
import { errorMessage } from "../lib/errors.js";

const EMPTY_FORM = {
  title: "",
  author: "",
  author_kana: "",
  publisher: "",
  magazine_label: "",
  total_volumes: "",
  favorite_score: 3,
  status: "active",
};

export default function AddSeries() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      setCandidates(await searchSeries(query));
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(c) {
    setForm((prev) => ({
      ...prev,
      title: c.series_name || c.title,
      author: c.author || "",
      author_kana: c.author_kana || "",
      publisher: c.publisher || "",
    }));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        ...form,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      };
      await createSeries(payload);
      navigate(form.status === "wishlist" ? "/wishlist" : "/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="space-y-4 p-3 md:mx-auto md:max-w-2xl">
      <h1 className="text-lg font-bold text-slate-700">シリーズを追加</h1>

      <form
        onSubmit={handleSearch}
        className="flex gap-2 rounded-lg bg-white p-3 shadow-sm"
      >
        <input
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="タイトルで検索（楽天ブックス）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          検索
        </button>
      </form>

      {searching && (
        <p className="text-center text-sm text-slate-400">検索中…</p>
      )}

      {searched && !searching && candidates.length === 0 && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
          候補が見つかりませんでした。下のフォームに手動で入力してください。
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="space-y-2">
          {candidates.map((c, i) => (
            <li key={`${c.isbn}-${i}`}>
              <button
                onClick={() => pickCandidate(c)}
                className="flex w-full gap-3 rounded-lg bg-white p-2 text-left shadow-sm"
              >
                <CoverImage
                  url={c.cover_url}
                  alt={c.title}
                  className="h-20 w-14"
                />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.author}</div>
                  <div className="text-xs text-slate-400">{c.publisher}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-lg bg-white p-3 shadow-sm"
      >
        <p className="text-sm font-semibold text-slate-600">
          シリーズ情報（検索候補を選ぶと自動入力されます）
        </p>
        {error && (
          <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
            {error}
          </p>
        )}
        <Labeled label="タイトル *">
          <input
            required
            className="input"
            {...field("title")}
            placeholder="例: ONE PIECE"
          />
        </Labeled>
        <Labeled label="作者名">
          <input className="input" {...field("author")} />
        </Labeled>
        <Labeled label="作者ふりがな">
          <input className="input" {...field("author_kana")} />
        </Labeled>
        <Labeled label="出版社名">
          <input className="input" {...field("publisher")} />
        </Labeled>
        <Labeled label="掲載誌・レーベル">
          <input
            className="input"
            {...field("magazine_label")}
            placeholder="例: 週刊少年ジャンプ / ジャンプコミックス"
          />
        </Labeled>
        <Labeled label="全巻数（完結作品のみ・任意）">
          <input
            type="number"
            min="1"
            className="input"
            {...field("total_volumes")}
          />
        </Labeled>
        <Labeled label="お気に入り度">
          <StarRating
            value={form.favorite_score}
            onChange={(n) => setForm({ ...form, favorite_score: n })}
            size="text-xl"
          />
        </Labeled>
        <Labeled label="登録先">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="status"
                checked={form.status === "active"}
                onChange={() => setForm({ ...form, status: "active" })}
              />
              進行中
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="status"
                checked={form.status === "wishlist"}
                onChange={() => setForm({ ...form, status: "wishlist" })}
              />
              いつか読みたい
            </label>
          </div>
        </Labeled>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-brand py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "登録中…" : "このシリーズを登録"}
        </button>
      </form>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
