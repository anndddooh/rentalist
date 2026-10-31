import { setAvailability } from "../api/series.js";

/**
 * ショップ別貸出状況の切替を全画面で共有するキュー。
 *
 * - 押した瞬間に購読中の画面へ新しい状態を通知する（楽観的更新）。
 * - API は (シリーズ, ショップ) ごとに 1 本ずつ送り、通信中に押された分は最後の状態だけ送る。
 *   並行送信だと到着順が入れ替わり、サーバーに 1 つ前の状態が残ることがあった。
 * - 切替直後に別画面で取得した一覧は、保存完了より前に読まれて古いことがあるため、
 *   取得開始時刻より後に確定した切替を overlay で上書きする。
 */

const entries = new Map(); // key -> { seriesId, shopId, confirmed, desired, running, settledAt }
const listeners = new Set();
const KEEP_MS = 60_000;

const keyOf = (seriesId, shopId) => `${seriesId}:${shopId}`;

function emit(seriesId, shopId, status) {
  listeners.forEach((fn) => fn(seriesId, shopId, status));
}

/** 切替の通知を購読する。戻り値は購読解除関数。 */
export function subscribeAvailability(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** current（画面に出ている状態）から next へ切り替える。失敗時は onError を呼んで元に戻す。 */
export function changeAvailability(seriesId, shopId, current, next, { onError } = {}) {
  const key = keyOf(seriesId, shopId);
  let entry = entries.get(key);
  if (!entry || (!entry.running && entry.desired === entry.confirmed)) {
    entry = { seriesId, shopId, confirmed: current, desired: next, running: false, settledAt: null };
    entries.set(key, entry);
  }
  entry.desired = next;
  entry.settledAt = null;
  emit(seriesId, shopId, next);
  if (!entry.running) drain(entry, onError);
}

async function drain(entry, onError) {
  entry.running = true;
  try {
    while (entry.desired !== entry.confirmed) {
      const want = entry.desired;
      await setAvailability(entry.seriesId, entry.shopId, want);
      entry.confirmed = want;
    }
  } catch (err) {
    entry.desired = entry.confirmed;
    emit(entry.seriesId, entry.shopId, entry.confirmed);
    onError?.(err);
  } finally {
    entry.running = false;
    entry.settledAt = Date.now();
  }
}

/** シリーズ 1 件の availability_map / availability_status に status を反映した複製を返す。 */
export function patchSeries(series, shopId, status, viewShopId) {
  const map = { ...(series.availability_map || {}) };
  if (status === "unknown") delete map[shopId];
  else map[shopId] = status;
  const patched = { ...series, availability_map: map };
  if (viewShopId != null && Number(viewShopId) === Number(shopId)) {
    patched.availability_status = status;
  }
  return patched;
}

/**
 * fetchStartedAt 時点より後に確定した（または通信中の）切替を、取得したシリーズに上書きする。
 * viewShopId は availability_status を算出しているショップ（一覧のショップ絞り込み）。
 */
export function overlayPending(series, fetchStartedAt, viewShopId) {
  const now = Date.now();
  let result = series;
  entries.forEach((entry, key) => {
    if (entry.settledAt != null && now - entry.settledAt > KEEP_MS) {
      entries.delete(key);
      return;
    }
    if (entry.settledAt != null && entry.settledAt < fetchStartedAt) return;
    const apply = (s) =>
      s.id === entry.seriesId ? patchSeries(s, entry.shopId, entry.desired, viewShopId) : s;
    result = Array.isArray(result) ? result.map(apply) : apply(result);
  });
  return result;
}
