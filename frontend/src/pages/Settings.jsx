import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createInvite, listInvites } from "../api/auth.js";
import {
  createShop,
  deleteShop,
  listShops,
  updateShop,
} from "../api/shops.js";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/errors.js";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="space-y-4 p-4 md:mx-auto md:max-w-2xl md:p-8">
      <PageHeader
        eyebrow={`${user?.username ?? ""}${user?.is_staff ? "（管理者）" : ""}`}
        title="設定"
      />

      {/* ショップ管理 */}
      <section className="overflow-hidden rounded-card bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="text-[13px] font-extrabold tracking-wide text-ink">
            レンタルショップ
          </h2>
          {editing === null && (
            <button
              onClick={() => startEdit(null)}
              className="text-xs font-bold text-brand"
            >
              ＋ 追加
            </button>
          )}
        </div>

        {error && (
          <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">
            {error}
          </p>
        )}

        {editing !== null && (
          <form onSubmit={saveShop} className="space-y-2 border-b border-line p-4">
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
                className="flex-1 rounded-full bg-brand py-2 text-sm font-bold text-white active:bg-brand-strong"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded-full bg-inset py-2 text-sm font-bold text-ink-muted"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {shops.length === 0 ? (
          <p className="px-4 py-3 text-xs text-ink-faint">
            ショップが未登録です。「＋ 追加」から登録してください。
          </p>
        ) : (
          <ul>
            {shops.map((shop) => (
              <li
                key={shop.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon name="store" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{shop.name}</div>
                  {shop.memo && (
                    <div className="text-[11px] text-ink-faint">{shop.memo}</div>
                  )}
                </div>
                <div className="flex gap-2.5 text-xs font-semibold">
                  <button
                    onClick={() => startEdit(shop)}
                    className="text-brand"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => removeShop(shop)}
                    className="text-rose-500"
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
        <section className="overflow-hidden rounded-card bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-[13px] font-extrabold tracking-wide text-ink">
              家族を招待
            </h2>
            <button
              onClick={handleCreateInvite}
              className="text-xs font-bold text-brand"
            >
              ＋ リンクを発行
            </button>
          </div>
          {inviteError && (
            <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">
              {inviteError}
            </p>
          )}
          <p className="px-4 py-3 text-[11px] text-ink-faint">
            発行したリンクを家族に送るとアカウントを作成できます（7日間有効・1回のみ）。
          </p>
          {invites.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-ink-faint">
              発行済みの招待はありません。
            </p>
          ) : (
            <ul>
              {invites.map((inv) => (
                <li
                  key={inv.token}
                  className="border-t border-line px-4 py-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        inv.is_valid
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-inset text-ink-faint"
                      }`}
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
                        className="font-bold text-brand"
                      >
                        リンクをコピー
                      </button>
                    )}
                  </div>
                  {inv.is_valid && (
                    <div className="mt-1.5 break-all text-ink-faint">
                      {inviteUrl(inv.signup_path)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ログアウト */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-between rounded-card bg-card px-4 py-3.5 shadow-card"
      >
        <span className="text-sm font-bold text-rose-500">ログアウト</span>
        <Icon name="logout" className="h-[18px] w-[18px] text-rose-500" strokeWidth={2} />
      </button>
    </div>
  );
}
