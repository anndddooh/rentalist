import { useEffect, useState } from "react";
import { createInvite, listInvites } from "../api/auth.js";
import {
  createShop,
  deleteShop,
  listShops,
  updateShop,
} from "../api/shops.js";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/errors.js";

export default function Settings() {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [editing, setEditing] = useState(null); // shop id or "new"
  const [draft, setDraft] = useState({ name: "", memo: "" });
  const [error, setError] = useState("");

  const [invites, setInvites] = useState([]);
  const [inviteError, setInviteError] = useState("");

  async function loadShops() {
    setShops(await listShops());
  }

  useEffect(() => {
    loadShops().catch(() => {});
    if (user?.is_staff) {
      listInvites().then(setInvites).catch(() => {});
    }
  }, [user]);

  function startEdit(shop) {
    setEditing(shop ? shop.id : "new");
    setDraft(shop ? { name: shop.name, memo: shop.memo } : { name: "", memo: "" });
    setError("");
  }

  async function saveShop(e) {
    e.preventDefault();
    setError("");
    try {
      if (editing === "new") {
        await createShop(draft);
      } else {
        await updateShop(editing, draft);
      }
      setEditing(null);
      loadShops();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeShop(shop) {
    if (
      !window.confirm(
        `「${shop.name}」を削除しますか？このショップの貸出状況の記録も削除されます。`
      )
    ) {
      return;
    }
    await deleteShop(shop.id);
    loadShops();
  }

  async function handleCreateInvite() {
    setInviteError("");
    try {
      await createInvite();
      setInvites(await listInvites());
    } catch (err) {
      setInviteError(errorMessage(err));
    }
  }

  function inviteUrl(path) {
    return `${window.location.origin}${path}`;
  }

  return (
    <div className="space-y-5 p-3">
      <h1 className="text-lg font-bold text-slate-700">設定</h1>

      {/* ショップ管理 */}
      <section className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">
            レンタルショップ
          </h2>
          {editing === null && (
            <button
              onClick={() => startEdit(null)}
              className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white"
            >
              + 追加
            </button>
          )}
        </div>

        {error && (
          <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
            {error}
          </p>
        )}

        {editing !== null && (
          <form onSubmit={saveShop} className="space-y-2 border-b pb-2">
            <input
              required
              className="input"
              placeholder="店名（例: TSUTAYA渋谷店）"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <textarea
              className="input"
              rows="2"
              placeholder="メモ（営業時間・場所など・任意）"
              value={draft.memo}
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded bg-brand py-1.5 text-sm font-semibold text-white"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded bg-slate-200 py-1.5 text-sm font-semibold text-slate-600"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {shops.length === 0 ? (
          <p className="text-xs text-slate-400">
            ショップが未登録です。「+ 追加」から登録してください。
          </p>
        ) : (
          <ul className="space-y-1">
            {shops.map((shop) => (
              <li
                key={shop.id}
                className="flex items-center justify-between py-1"
              >
                <div className="text-sm">
                  <div className="font-semibold">{shop.name}</div>
                  {shop.memo && (
                    <div className="text-xs text-slate-400">{shop.memo}</div>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => startEdit(shop)}
                    className="text-brand underline"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => removeShop(shop)}
                    className="text-rose-500 underline"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 招待リンク（管理者のみ） */}
      {user?.is_staff && (
        <section className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">
              招待リンク（管理者）
            </h2>
            <button
              onClick={handleCreateInvite}
              className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white"
            >
              + 発行
            </button>
          </div>
          {inviteError && (
            <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
              {inviteError}
            </p>
          )}
          <p className="text-xs text-slate-400">
            発行したリンクを家族に送るとアカウントを作成できます（7日間有効・1回のみ）。
          </p>
          {invites.length === 0 ? (
            <p className="text-xs text-slate-400">発行済みの招待はありません。</p>
          ) : (
            <ul className="space-y-1">
              {invites.map((inv) => (
                <li key={inv.token} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        inv.is_valid ? "text-emerald-600" : "text-slate-400"
                      }
                    >
                      {inv.is_valid ? "有効" : "使用済み/期限切れ"}
                    </span>
                    {inv.is_valid && (
                      <button
                        onClick={() =>
                          navigator.clipboard?.writeText(
                            inviteUrl(inv.signup_path)
                          )
                        }
                        className="text-brand underline"
                      >
                        リンクをコピー
                      </button>
                    )}
                  </div>
                  {inv.is_valid && (
                    <div className="break-all text-slate-400">
                      {inviteUrl(inv.signup_path)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
