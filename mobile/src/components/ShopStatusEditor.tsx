import { useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { setAvailability } from "@/api/series";
import type { AvailabilityStatus, RentalShop, Series } from "@/api/types";
import { errorMessage } from "@/lib/errors";
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
  const [local, setLocal] =
    useState<Record<string, AvailabilityStatus>>(statusMap);

  async function cycle(shopId: number) {
    const current = local[shopId] ?? "unknown";
    const next = CYCLE[current];
    try {
      await setAvailability(seriesId, shopId, next);
      setLocal((prev) => {
        const updated = { ...prev };
        if (next === "unknown") delete updated[shopId];
        else updated[shopId] = next;
        return updated;
      });
    } catch (err) {
      Toast.show({ type: "error", text1: errorMessage(err) });
    }
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
            status={local[shop.id] ?? "unknown"}
            onPress={() => cycle(shop.id)}
            showCycleHint
          />
        </View>
      ))}
    </View>
  );
}
