import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkout, clearCart, listCart, removeFromCart } from "../api/cart.js";
import Celebration from "../components/Celebration.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader, { RoundButton } from "../components/PageHeader.jsx";
import { useCart } from "../context/CartContext.jsx";
import { errorMessage } from "../lib/errors.js";

export default function Cart() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [celebration, setCelebration] = useState([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const { refreshCart } = useCart();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      setItems(await listCart());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRemove(id) {
    await removeFromCart(id);
    refreshCart();
    load();
  }

  async function handleClear() {
    setBusy(true);
    try {
      await clearCart();
      setConfirmClear(false);
      refreshCart();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckout() {
    setBusy(true);
    setMessage("");
    try {
      const result = await checkout();
      setMessage(`${result.count}件を確定しました。巻数を繰り上げました。`);
      if (result.completed_series?.length) {
        setCelebration(result.completed_series.map((s) => s.title));
      }
      refreshCart();
      load();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:mx-auto md:max-w-2xl md:p-8">
      {celebration.length > 0 && (
        <Celebration titles={celebration} onClose={() => setCelebration([])} />
      )}

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
        eyebrow={`${items.length}冊`}
        title="カート"
        actions={
          items.length > 0 &&
          (confirmClear ? (
            <span className="flex items-center gap-1.5 text-xs">
              <button
                onClick={handleClear}
                disabled={busy}
                className="rounded-full bg-rose-500 px-3 py-1.5 font-bold text-white disabled:opacity-50"
              >
                全削除
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-full bg-inset px-3 py-1.5 font-bold text-ink-muted"
              >
                やめる
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-sm font-bold text-rose-500"
            >
              全削除
            </button>
          ))
        }
      />

      {message && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-text">
          {message}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          カートは空です。ホームの「レンタル」ボタンから追加できます。
        </p>
      ) : (
        <>
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3.5 rounded-[18px] bg-card p-3.5 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-ink">
                    {item.series_title}
                  </div>
                  <div className="mt-1">
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-text">
                      {item.volume_number}巻
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  aria-label="カートから削除"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink-muted"
                >
                  <Icon name="close" className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-2.5 pt-2">
            <p className="text-center text-xs leading-relaxed text-ink-faint">
              レジで会計したらこのボタンを押すと、
              <br />
              各シリーズの「次に借りる巻」が繰り上がります。
            </p>
            <button
              onClick={handleCheckout}
              disabled={busy}
              className="w-full rounded-full bg-brand py-4 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(91,33,182,0.35)] active:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "確定中…" : `会計した — ${items.length}冊を確定する`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
