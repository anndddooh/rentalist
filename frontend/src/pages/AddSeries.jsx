import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSeries, searchSeries } from "../api/series.js";
import { bulkAddHistory } from "../api/history.js";
import CoverImage from "../components/CoverImage.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader, { RoundButton } from "../components/PageHeader.jsx";
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
  read_up_to: "",
};

// 「ONE PIECE 114」のような末尾の巻数表記を取り除いてシリーズ名にする
function cleanSeriesTitle(rawTitle) {
  return (rawTitle || "")
    .replace(/[\s　（(]+第?\s*\d+\s*巻?\s*[）)]?\s*$/, "")
    .trim();
}

export default function AddSeries() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedIndex, setSelectedIndex] = useState(null);
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

  function pickCandidate(candidate, index) {
    setForm((prev) => ({
      ...prev,
      title: cleanSeriesTitle(candidate.title),
      author: candidate.author || "",
      author_kana: candidate.author_kana || "",
      publisher: candidate.publisher || "",
      magazine_label: candidate.series_name || prev.magazine_label,
    }));
    setSelectedIndex(index);
    setError("");
    // フォームへスクロールして「反映された」ことを分かるようにする
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // read_up_to は別 API で処理するので payload からは外す
      const { read_up_to, ...rest } = form;
      const payload = {
        ...rest,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      };
      const created = await createSeries(payload);

      const readUpTo = Number(read_up_to);
      if (Number.isInteger(readUpTo) && readUpTo >= 1) {
        try {
          await bulkAddHistory(created.id, readUpTo);
        } catch (bulkErr) {
          // シリーズは作れたが履歴投入で失敗。alert で確実にユーザに伝えてから
          // 詳細に遷移して再試行可能にする（setError では navigate で消えるため）。
          window.alert(
            "シリーズは作成されましたが、履歴の一括追加に失敗しました。シリーズ詳細から再試行してください。"
          );
          navigate(`/series/${created.id}`);
          return;
        }
      }
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
    <div className="space-y-4 p-4 md:mx-auto md:max-w-2xl md:p-8">
      <PageHeader
        leading={
          <RoundButton
            onClick={() => navigate(-1)}
            icon="arrowLeft"
            label="戻る"
            variant="ink"
            strokeWidth={2.2}
          />
        }
        title="シリーズを追加"
      />

      <form
        onSubmit={handleSearch}
        className="flex items-center gap-2.5 rounded-full bg-card py-1.5 pl-4 pr-1.5 shadow-card"
      >
        <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
        <input
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          placeholder="タイトルで検索（楽天ブックス）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white active:bg-brand-strong"
        >
          検索
        </button>
      </form>
      <p className="text-center text-xs text-ink-faint">
        楽天ブックスから検索。タップでフォームに反映されます。
      </p>

      {searching && (
        <p className="text-center text-sm text-ink-faint">検索中…</p>
      )}

      {searched && !searching && candidates.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          候補が見つかりませんでした。下のフォームに手動で入力してください。
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="space-y-2">
          {candidates.map((c, i) => {
            const selected = selectedIndex === i;
            return (
              <li key={`${c.isbn}-${i}`}>
                <button
                  onClick={() => pickCandidate(c, i)}
                  className={`flex w-full items-center gap-3 rounded-[18px] bg-card p-3 text-left shadow-card ${
                    selected ? "ring-2 ring-brand" : ""
                  }`}
                >
                  <CoverImage
                    url={c.cover_url}
                    alt={c.title}
                    className="h-16 w-11 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{c.title}</div>
                    <div className="text-[11px] text-ink-muted">
                      {[c.author, c.publisher].filter(Boolean).join(" ・ ")}
                    </div>
                  </div>
                  {selected && (
                    <span className="shrink-0 self-center text-xs font-extrabold text-brand">
                      ✓ 選択中
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        onSubmit={handleCreate}
        className="scroll-mt-3 space-y-3 rounded-card bg-card p-4 shadow-card"
      >
        {selectedIndex !== null && (
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-text">
            「{form.title}」を反映しました。確認して登録してください。
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">
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
        <Labeled label="既に読んだ巻数（任意）">
          <input
            type="number"
            min="1"
            step="1"
            className="input"
            {...field("read_up_to")}
            placeholder="例: 10"
          />
          <p className="mt-1 text-xs text-ink-muted">
            「N巻まで読んだ既存シリーズ」を登録する時に使うと、1〜N 巻の読破記録を一気に作成します。
          </p>
        </Labeled>
        <Labeled label="お気に入り度">
          <StarRating
            value={form.favorite_score}
            onChange={(n) => setForm({ ...form, favorite_score: n })}
            size="text-xl"
          />
        </Labeled>
        <Labeled label="登録先">
          <div className="flex rounded-full bg-inset p-1">
            {[
              ["active", "進行中"],
              ["wishlist", "いつか読みたい"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm({ ...form, status: value })}
                className={`flex-1 rounded-full py-2 text-center text-[13px] font-bold ${
                  form.status === value
                    ? "bg-card text-brand shadow-sm"
                    : "text-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Labeled>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-3.5 text-[15px] font-extrabold text-white active:bg-brand-strong disabled:opacity-50"
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
      <span className="text-[11px] font-bold tracking-wide text-ink-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
