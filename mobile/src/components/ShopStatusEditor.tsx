import { Text, View } from "react-native";
import type { AvailabilityStatus, RentalShop, Series } from "@/api/types";
import { changeAvailability } from "@/lib/availabilitySync";
import AvailabilityBadge from "./AvailabilityBadge";

const CYCLE: Record<AvailabilityStatus, AvailabilityStatus> = {
  unknown: "available",
  available: "unavailable",
  unavailable: "unknown",
};

/**
 * シリーズのショップ別貸出状況を編集する
 * （frontend/src/components/ShopStatusEditor.jsx の移植）。
 * statusMap は { [shopId]: "available"|"unavailable" }（不在は未確認）。
 * 表示はキャッシュ（statusMap）をそのまま使い、切替は lib/availabilitySync が
 * 全キャッシュを書き換える。ローカル state に持つと再取得に追従せず古い値が残っていた。
 */
export default function ShopStatusEditor({
  seriesId,
  shops,
  statusMap = {},
}: {
  seriesId: number;
  shops: RentalShop[];
  statusMap?: Series["availability_map"];
}) {
  function cycle(shopId: number) {
    const current = statusMap[shopId] ?? "unknown";
    changeAvailability(seriesId, shopId, current, CYCLE[current]);
  }

  if (shops.length === 0) {
    return (
      <Text className="text-xs text-ink-faint">
        ショップが未登録です。設定画面から登録できます。
      </Text>
    );
  }

  return (
    <View className="gap-1.5">
      {shops.map((shop) => (
        <View
          key={shop.id}
          className="flex-row items-center justify-between"
        >
          <Text className="text-sm text-ink-muted">{shop.name}</Text>
          <AvailabilityBadge
            status={statusMap[shop.id] ?? "unknown"}
            onPress={() => cycle(shop.id)}
            showCycleHint
          />
        </View>
      ))}
    </View>
  );
}
