import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listHistory } from "../api/history.js";
import {
  deleteSeries,
  getCover,
  getSeries,
  setCover,
  updateSeries,
} from "../api/series.js";
import { listShops } from "../api/shops.js";
import CoverImage from "../components/CoverImage.jsx";
import ShopStatusEditor from "../components/ShopStatusEditor.jsx";
import StarRating from "../components/StarRating.jsx";
import { errorMessage } from "../lib/errors.js";

const STATUS_LABELS = {
  active: "進行中",
  wishlist: "いつか読みたい",
  completed: "完結・読破済み",
};

export default function SeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [shops, setShops] = useState([]);
  const [history, setHistory] = useState([]);
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
    setCoverVolume(data.next_volume);
    getCover(data.id, data.next_volume)
      .then((c) => setCoverUrl(c.resolved_url))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    listShops().then(setShops).catch(() => {});
    listHistory(id).then(setHistory).catch(() => {});
  }, [id]);

  if (!series || !form) {
    return <p className="p-6 text-center text-sm text-slate-400">読み込み中…</p>;
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
      const c = await getCover(id, series.next_volume);
      setCoverUrl(c.resolved_url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== series.title) return;
    await deleteSeries(id);
    navigate("/");
  }

  const f = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="space-y-4 p-3 md:mx-auto md:max-w-2xl">
      <div className="flex gap-3 rounded-lg bg-white p-3 shadow-sm">
        <CoverImage url={coverUrl} alt={series.title} className="h-32 w-24" />
        <div className="text-sm">
          <h1 className="text-base font-bold text-slate-800">{series.title}</h1>
          <p className="mt-1 text-slate-500">
            {STATUS_LABELS[series.status]}
          </p>
          <p className="text-slate-500">
            読了 {series.current_volume}巻
            {series.total_volumes ? ` / 全${series.total_volumes}巻` : ""}
          </p>
          <p className="text-slate-500">次の巻: {series.next_volume}巻</p>
          <StarRating value={series.favorite_score} size="text-sm" />
        </div>
      </div>

      {/* 編集フォーム */}
      <form
        onSubmit={handleSave}
        className="space-y-3 rounded-lg bg-white p-3 shadow-sm"
      >
        <p className="text-sm font-semibold text-slate-600">基本情報の編集</p>
        {error && (
          <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded bg-brand-light px-2 py-1 text-xs text-brand-dark">
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
          <select className="input" {...f("status")}>
            <option value="active">進行中</option>
            <option value="wishlist">いつか読みたい</option>
            <option value="completed">完結・読破済み</option>
          </select>
        </Field>
        <button
          type="submit"
          className="w-full rounded bg-brand py-2 text-sm font-semibold text-white"
        >
          保存
        </button>
      </form>

      {/* 表紙設定 */}
      <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">表紙画像の設定</p>
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
          className="w-full rounded bg-slate-600 py-2 text-sm font-semibold text-white"
        >
          表紙を設定
        </button>
      </div>

      {/* ショップ別貸出状況 */}
      <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          ショップ別の貸出状況
        </p>
        <ShopStatusEditor
          seriesId={series.id}
          shops={shops}
          statusMap={series.availability_map}
        />
      </div>

      {/* 履歴 */}
      <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">読破記録</p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">記録はありません。</p>
        ) : (
          <ul className="text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between py-0.5">
                <span>{h.volume_number}巻</span>
                <span className="text-xs text-slate-400">
                  {new Date(h.rented_at).toLocaleDateString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 削除 */}
      <div className="space-y-2 rounded-lg border border-rose-200 bg-white p-3 shadow-sm">
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm font-semibold text-rose-600"
          >
            このシリーズを削除
          </button>
        ) : (
          <>
            <p className="text-xs text-rose-600">
              ⚠️ 削除すると、このシリーズの読破記録・カート・貸出状況も
              すべて完全に削除されます。この操作は取り消せません。
            </p>
            <p className="text-xs text-slate-500">
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
                className="flex-1 rounded bg-rose-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                削除する
              </button>
              <button
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm("");
                }}
                className="flex-1 rounded bg-slate-200 py-2 text-sm font-semibold text-slate-600"
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
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
