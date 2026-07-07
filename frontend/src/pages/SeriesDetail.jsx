import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  bulkAddHistory,
  listHistory,
  listHistoryNextPage,
} from "../api/history.js";
import {
  deleteSeries,
  getCover,
  getSeries,
  setCover,
  updateSeries,
} from "../api/series.js";
import { listShops } from "../api/shops.js";
import CoverImage from "../components/CoverImage.jsx";
import { RoundButton } from "../components/PageHeader.jsx";
import ShopStatusEditor from "../components/ShopStatusEditor.jsx";
import StarRating from "../components/StarRating.jsx";
import { errorMessage } from "../lib/errors.js";

const STATUS_LABELS = {
  active: "進行中",
  wishlist: "いつか読みたい",
  completed: "読破済み",
};

const STATUS_OPTIONS = [
  ["active", "進行中"],
  ["wishlist", "読みたい"],
  ["completed", "読破"],
];

export default function SeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [series, setSeries] = useState(null);
  const [shops, setShops] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyNextUrl, setHistoryNextUrl] = useState(null);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [coverUrl, setCoverUrl] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // 表紙設定
  const [coverVolume, setCoverVolume] = useState(1);
  const [coverInputUrl, setCoverInputUrl] = useState("");
  const [coverFile, setCoverFile] = useState(null);

  // 削除確認
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  // 一括履歴追加 UI 用
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToVolume, setBulkToVolume] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  async function load() {
    const data = await getSeries(id);
    setSeries(data);
    setForm({
      title: data.title,
      author: data.author,
      author_kana: data.author_kana,
      publisher: data.publisher,
      magazine_label: data.magazine_label,
      total_volumes: data.total_volumes ?? "",
      favorite_score: data.favorite_score,
      status: data.status,
    });
    // 読破済みは「次の巻」が存在しないため1巻の表紙を表示する
    const coverVol = data.status === "completed" ? 1 : data.next_volume;
    setCoverVolume(coverVol);
    getCover(data.id, coverVol)
      .then((c) => setCoverUrl(c.resolved_url))
      .catch(() => {});
  }

  async function loadHistory() {
    try {
      const data = await listHistory(id);
      setHistory(data.results);
      setHistoryNextUrl(data.next);
      setHistoryTotalCount(data.count);
    } catch {
      /* 履歴取得失敗は致命的ではないので silent */
    }
  }

  async function loadMoreHistory() {
    if (!historyNextUrl) return;
    setHistoryLoadingMore(true);
    try {
      const data = await listHistoryNextPage(historyNextUrl);
      setHistory((prev) => [...prev, ...data.results]);
      setHistoryNextUrl(data.next);
    } finally {
      setHistoryLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
    listShops().then(setShops).catch(() => {});
    loadHistory();
  }, [id]);

  useEffect(() => {
    if (!bulkMessage) return;
    const timer = setTimeout(() => setBulkMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [bulkMessage]);

  if (!series || !form) {
    return <p className="p-6 text-center text-sm text-ink-faint">読み込み中…</p>;
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const payload = {
        ...form,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      };
      await updateSeries(id, payload);
      setSaved(true);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCoverSave() {
    setError("");
    try {
      await setCover(id, {
        volumeNumber: Number(coverVolume),
        imageUrl: coverInputUrl,
        imageFile: coverFile,
      });
      setCoverInputUrl("");
      setCoverFile(null);
      const displayVol = series.status === "completed" ? 1 : series.next_volume;
      const c = await getCover(id, displayVol);
      setCoverUrl(c.resolved_url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleBulkAdd() {
    const n = Number(bulkToVolume);
    if (!Number.isInteger(n) || n < 1) {
      setError("巻数は 1 以上の整数を指定してください。");
      return;
    }
    setBulkBusy(true);
    setError("");
    try {
      const result = await bulkAddHistory(id, n);
      setBulkMessage(`${result.created}件の読破記録を追加しました。`);
      setBulkToVolume("");
      setBulkOpen(false);
      // 履歴とシリーズを再取得（履歴は先頭ページから読み直し）
      await Promise.all([loadHistory(), load()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== series.title) return;
    await deleteSeries(id);
    navigate("/");
  }

  function goBack() {
    // 遷移元の画面に戻る。直接開いた等で履歴が無ければホームへ。
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  const f = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="space-y-4 p-4 md:mx-auto md:max-w-2xl md:p-8">
      <div className="flex items-center justify-between">
        <RoundButton
          onClick={goBack}
          icon="arrowLeft"
          label="戻る"
          variant="ink"
          strokeWidth={2.2}
        />
      </div>

      {/* ヒーロー */}
      <div className="flex gap-4">
        <CoverImage
          url={coverUrl}
          alt={series.title}
          className="h-[150px] w-[106px] rounded-xl shadow-card"
        />
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink">
            {series.title}
          </h1>
          {series.author && (
            <p className="text-xs text-ink-muted">
              {series.author}
              {series.author_kana && (
                <span className="text-ink-faint">（{series.author_kana}）</span>
              )}
            </p>
          )}
          {(series.publisher || series.magazine_label) && (
            <p className="text-xs text-ink-muted">
              {[series.publisher, series.magazine_label]
                .filter(Boolean)
                .join(" ・ ")}
            </p>
          )}
          <StarRating value={series.favorite_score} size="text-sm" />
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-text">
              {STATUS_LABELS[series.status]}
            </span>
            <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-bold text-ink-muted shadow-sm">
              読了 {series.current_volume}巻
              {series.total_volumes ? ` / 全${series.total_volumes}巻` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* 次に借りる巻 */}
      {series.status !== "completed" && (
        <div className="flex items-center justify-between rounded-card bg-brand px-5 py-4 text-white shadow-[0_8px_20px_rgba(91,33,182,0.3)]">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-white/70">
              次に借りる巻
            </div>
            <div className="text-[26px] font-extrabold tracking-tight">
              {series.next_volume}巻
            </div>
          </div>
        </div>
      )}

      {/* 編集フォーム */}
      <form
        onSubmit={handleSave}
        className="space-y-3 rounded-card bg-card p-4 shadow-card"
      >
        <p className="text-[13px] font-extrabold text-ink">基本情報の編集</p>
        {error && (
          <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg bg-brand-soft px-2 py-1 text-xs text-brand-text">
            保存しました。
          </p>
        )}
        <Field label="タイトル">
          <input required className="input" {...f("title")} />
        </Field>
        <Field label="作者名">
          <input className="input" {...f("author")} />
        </Field>
        <Field label="作者ふりがな">
          <input className="input" {...f("author_kana")} />
        </Field>
        <Field label="出版社名">
          <input className="input" {...f("publisher")} />
        </Field>
        <Field label="掲載誌・レーベル">
          <input className="input" {...f("magazine_label")} />
        </Field>
        <Field label="全巻数（完結作品のみ）">
          <input
            type="number"
            min="1"
            className="input"
            {...f("total_volumes")}
          />
        </Field>
        <Field label="お気に入り度">
          <StarRating
            value={form.favorite_score}
            onChange={(n) => setForm({ ...form, favorite_score: n })}
            size="text-xl"
          />
        </Field>
        <Field label="ステータス">
          <div className="flex rounded-full bg-inset p-1">
            {STATUS_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm({ ...form, status: value })}
                className={`flex-1 rounded-full py-2 text-center text-xs font-bold ${
                  form.status === value
                    ? "bg-card text-brand shadow-sm"
                    : "text-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <button
          type="submit"
          className="w-full rounded-full bg-ink py-2.5 text-sm font-bold text-white"
        >
          保存
        </button>
      </form>

      {/* 表紙設定 */}
      <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-ink">表紙画像の設定</p>
        <Field label="対象の巻">
          <input
            type="number"
            min="1"
            className="input"
            value={coverVolume}
            onChange={(e) => setCoverVolume(e.target.value)}
          />
        </Field>
        <Field label="画像URL">
          <input
            className="input"
            placeholder="https://..."
            value={coverInputUrl}
            onChange={(e) => setCoverInputUrl(e.target.value)}
          />
        </Field>
        <Field label="または画像をアップロード">
          <input
            type="file"
            accept="image/*"
            className="text-xs"
            onChange={(e) => setCoverFile(e.target.files[0] || null)}
          />
        </Field>
        <button
          onClick={handleCoverSave}
          className="w-full rounded-full bg-ink py-2.5 text-sm font-bold text-white"
        >
          表紙を設定
        </button>
      </div>

      {/* ショップ別貸出状況 */}
      <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-ink">
          ショップ別の貸出状況
        </p>
        <ShopStatusEditor
          seriesId={series.id}
          shops={shops}
          statusMap={series.availability_map}
        />
      </div>

      {/* 履歴 */}
      <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-extrabold text-ink">読破記録</p>
          <button
            onClick={() => {
              setBulkOpen((v) => !v);
              setBulkMessage("");
            }}
            className="text-xs font-bold text-brand"
          >
            {bulkOpen ? "閉じる" : "＋ N巻まで一括追加"}
          </button>
        </div>

        {bulkMessage && (
          <p className="rounded-lg bg-brand-soft px-2 py-1 text-xs text-brand-text">
            {bulkMessage}
          </p>
        )}

        {bulkOpen && (
          <div className="space-y-2 rounded-xl bg-brand-soft/40 p-3">
            <Field label="巻数（N）">
              <input
                type="number"
                min="1"
                className="input"
                value={bulkToVolume}
                onChange={(e) => setBulkToVolume(e.target.value)}
                placeholder="例: 10"
              />
            </Field>
            <p className="text-xs text-ink-muted">
              1〜N 巻の読破記録を追加します。既に登録済みの巻はそのまま残ります。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleBulkAdd}
                disabled={bulkBusy}
                className="flex-1 rounded-full bg-brand py-2 text-sm font-bold text-white active:bg-brand-strong disabled:opacity-50"
              >
                {bulkBusy ? "追加中…" : "追加"}
              </button>
              <button
                onClick={() => {
                  setBulkOpen(false);
                  setBulkToVolume("");
                }}
                disabled={bulkBusy}
                className="flex-1 rounded-full bg-inset py-2 text-sm font-bold text-ink-muted disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-xs text-ink-faint">記録はありません。</p>
        ) : (
          <>
            <p className="text-xs text-ink-muted">
              全 {historyTotalCount}件
              {history.length < historyTotalCount
                ? `（${history.length}件表示中）`
                : ""}
            </p>
            <ul className="text-sm">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex justify-between border-b border-line py-2 last:border-b-0"
                >
                  <span className="font-bold text-ink">{h.volume_number}巻</span>
                  <span className="text-xs text-ink-faint">
                    {new Date(h.rented_at).toLocaleDateString("ja-JP")}
                  </span>
                </li>
              ))}
            </ul>
            {historyNextUrl && (
              <button
                onClick={loadMoreHistory}
                disabled={historyLoadingMore}
                className="block w-full py-1 text-center text-xs font-bold text-brand disabled:opacity-50"
              >
                {historyLoadingMore
                  ? "読み込み中…"
                  : `もっと見る（残り ${historyTotalCount - history.length}件）`}
              </button>
            )}
          </>
        )}
      </div>

      {/* 削除 */}
      <div className="space-y-2 rounded-card bg-card p-4 shadow-card">
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm font-bold text-rose-500"
          >
            このシリーズを削除
          </button>
        ) : (
          <>
            <p className="text-xs text-rose-600">
              ⚠️ 削除すると、このシリーズの読破記録・カート・貸出状況も
              すべて完全に削除されます。この操作は取り消せません。
            </p>
            <p className="text-xs text-ink-muted">
              確認のため、シリーズ名「{series.title}」を入力してください。
            </p>
            <input
              className="input"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={series.title}
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== series.title}
                className="flex-1 rounded-full bg-rose-600 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                削除する
              </button>
              <button
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm("");
                }}
                className="flex-1 rounded-full bg-inset py-2 text-sm font-bold text-ink-muted"
              >
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold tracking-wide text-ink-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
