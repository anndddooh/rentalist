import Toast from "react-native-toast-message";
import { setAvailability } from "@/api/series";
import type { AvailabilityStatus, Series } from "@/api/types";
import { errorMessage } from "./errors";
import { queryClient } from "./queryClient";

/**
 * ショップ別貸出状況の切替を全画面で共有するキュー
 * （frontend/src/lib/availabilitySync.js の移植。iOS は React Query のキャッシュを書き換える）。
 *
 * - 押した瞬間に ["series", ...] の全キャッシュ（一覧・詳細）を新しい状態に書き換える。
 *   以前は操作した画面のキャッシュしか書き換えず、別画面に移ると古い値が出ていた。
 * - API は (シリーズ, ショップ) ごとに 1 本ずつ送り、通信中に押された分は最後の状態だけ送る。
 * - 送信が終わったら ["series"] を invalidate してサーバーの値で取り直す。
 */

type Entry = {
  seriesId: number;
  shopId: number;
  confirmed: AvailabilityStatus;
  desired: AvailabilityStatus;
  running: boolean;
};

const entries = new Map<string, Entry>();

function patchSeries(
  series: Series,
  shopId: number,
  status: AvailabilityStatus,
  viewShopId: number | null
): Series {
  const map = { ...series.availability_map };
  if (status === "unknown") delete map[shopId];
  else map[shopId] = status;
  const patched = { ...series, availability_map: map };
  if (viewShopId === shopId) patched.availability_status = status;
  return patched;
}

/** ["series", ...] の全キャッシュの該当シリーズに status を反映する。 */
function patchCaches(seriesId: number, shopId: number, status: AvailabilityStatus) {
  // 通信中の再取得（保存前の値）で上書きされないよう止める。最後に invalidate で取り直す
  void queryClient.cancelQueries({ queryKey: ["series"] });
  for (const [key, data] of queryClient.getQueriesData<Series | Series[]>({
    queryKey: ["series"],
  })) {
    if (!data) continue;
    const opts = key[2] as { shop?: number } | undefined;
    const viewShopId = typeof opts === "object" && opts?.shop ? opts.shop : null;
    const apply = (s: Series) =>
      s.id === seriesId ? patchSeries(s, shopId, status, viewShopId) : s;
    queryClient.setQueryData(key, Array.isArray(data) ? data.map(apply) : apply(data));
  }
}

/** current（画面に出ている状態）から next へ切り替える。失敗時は元に戻してトーストを出す。 */
export function changeAvailability(
  seriesId: number,
  shopId: number,
  current: AvailabilityStatus,
  next: AvailabilityStatus
) {
  const key = `${seriesId}:${shopId}`;
  let entry = entries.get(key);
  if (!entry) {
    entry = { seriesId, shopId, confirmed: current, desired: next, running: false };
    entries.set(key, entry);
  }
  entry.desired = next;
  patchCaches(seriesId, shopId, next);
  if (!entry.running) void drain(key, entry);
}

async function drain(key: string, entry: Entry) {
  entry.running = true;
  try {
    while (entry.desired !== entry.confirmed) {
      const want = entry.desired;
      await setAvailability(entry.seriesId, entry.shopId, want);
      entry.confirmed = want;
    }
  } catch (err) {
    patchCaches(entry.seriesId, entry.shopId, entry.confirmed);
    Toast.show({ type: "error", text1: errorMessage(err) });
  } finally {
    entries.delete(key);
    void queryClient.invalidateQueries({ queryKey: ["series"] });
  }
}
