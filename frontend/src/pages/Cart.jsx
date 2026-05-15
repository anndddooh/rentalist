import { useEffect, useState } from "react";
import { checkout, listCart, removeFromCart } from "../api/cart.js";
import { errorMessage } from "../lib/errors.js";

export default function Cart() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
    load();
  }

  async function handleCheckout() {
    setBusy(true);
    setMessage("");
    try {
      const result = await checkout();
      setMessage(`${result.count}件を確定しました。巻数を繰り上げました。`);
      load();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-bold text-slate-700">カート</h1>

      {message && (
        <p className="rounded bg-brand-light px-3 py-2 text-sm text-brand-dark">
          {message}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          カートは空です。ホームの「レンタル」ボタンから追加できます。
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
              >
                <span className="text-sm">
                  <span className="font-semibold">{item.series_title}</span>{" "}
                  <span className="text-brand">{item.volume_number}巻</span>
                </span>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-xs text-rose-500 underline"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={handleCheckout}
            disabled={busy}
            className="w-full rounded-lg bg-brand py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "確定中…" : `確定する（${items.length}件）`}
          </button>
          <p className="text-center text-xs text-slate-400">
            レジで会計したらこのボタンを押すと、各シリーズの巻数が繰り上がります。
          </p>
        </>
      )}
    </div>
  );
}
