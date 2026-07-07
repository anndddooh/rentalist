import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { addToCart } from "@/api/cart";
import { setAvailability } from "@/api/series";
import type { AvailabilityStatus, Series } from "@/api/types";
import { AddSeriesButton, CartButton } from "@/components/HeaderButtons";
import ScreenHeader from "@/components/ScreenHeader";
import SeriesCard from "@/components/SeriesCard";
import { useAuth } from "@/hooks/useAuth";
import { useSeriesList, seriesListKey } from "@/hooks/useSeries";
import { useShopsQuery } from "@/hooks/useShops";
import { errorMessage } from "@/lib/errors";

// 貸出状況バッジをタップしたときの遷移順（frontend/src/pages/Home.jsx の移植）
const STATUS_CYCLE: Record<AvailabilityStatus, AvailabilityStatus> = {
  unknown: "available",
  available: "unavailable",
  unavailable: "unknown",
};

const STATUS_FILTERS: { key: AvailabilityStatus; label: string }[] = [
  { key: "available", label: "あり" },
  { key: "unknown", label: "未確認" },
  { key: "unavailable", label: "なし" },
];

export default function Home() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [shopId, setShopId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Record<AvailabilityStatus, boolean>>({
    available: true,
    unknown: true,
    unavailable: false,
  });
  // 直前に貸出状況を切替えたカードはフィルタを無視して残す（web と同じ挙動）
  const [stickyIds, setStickyIds] = useState<Set<number>>(() => new Set());

  const { data: shops = [] } = useShopsQuery();
  const seriesQuery = useSeriesList("active", shopId);
  const series = seriesQuery.data ?? [];
  const listKey = seriesListKey("active", shopId);

  const shopMode = shopId != null;

  function selectShop(id: number | null) {
    setStickyIds(new Set());
    setShopId(id);
  }

  const rentMutation = useMutation({
    mutationFn: (target: Series) => addToCart(target.id),
    onSuccess: (_data, target) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Toast.show({
        type: "success",
        text1: `「${target.title}」をカートに追加しました`,
      });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => {
      Toast.show({ type: "error", text1: errorMessage(err) });
    },
  });

  // 楽観更新: 先にキャッシュを書き換えてバッジ色を即時反映。失敗時はロールバック
  async function handleCycleAvailability(target: Series) {
    if (shopId == null) return;
    const current = target.availability_status ?? "unknown";
    const next = STATUS_CYCLE[current];
    const patch = (status: AvailabilityStatus) =>
      queryClient.setQueryData<Series[]>(listKey, (prev) =>
        prev?.map((s) =>
          s.id === target.id ? { ...s, availability_status: status } : s
        )
      );
    patch(next);
    setStickyIds((prev) => new Set(prev).add(target.id));
    try {
      await setAvailability(target.id, shopId, next);
    } catch (err) {
      patch(current);
      Toast.show({ type: "error", text1: errorMessage(err) });
    }
  }

  function toggleFilter(key: AvailabilityStatus) {
    setStickyIds(new Set());
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const visibleSeries = shopMode
    ? series.filter(
        (s) =>
          filters[s.availability_status ?? "unknown"] || stickyIds.has(s.id)
      )
    : series;

  const renderItem = useCallback(
    ({ item }: { item: Series }) => (
      <SeriesCard
        series={item}
        shopMode={shopMode}
        onRent={(target) => rentMutation.mutate(target)}
        onCycleAvailability={handleCycleAvailability}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shopMode, shopId, filters, series]
  );

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        subtitle={`こんにちは、${user?.username ?? ""}さん`}
        title="つづきを借りる"
        right={
          <View className="flex-row items-center gap-2.5">
            <AddSeriesButton />
            <CartButton />
          </View>
        }
      />
      <FlatList
        className="flex-1 bg-surface"
        contentContainerClassName="gap-3 px-4 pb-4"
        data={visibleSeries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={seriesQuery.isRefetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["series"] });
              queryClient.invalidateQueries({ queryKey: ["shops"] });
            }}
          />
        }
        ListHeaderComponent={
          <View className="gap-2 pb-1 pt-1">
            {/* ショップ切替チップ列（横スクロール） */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              <ShopChip
                label="すべて"
                active={shopId == null}
                allMode
                onPress={() => selectShop(null)}
              />
              {shops.map((s) => (
                <ShopChip
                  key={s.id}
                  label={s.name}
                  active={shopId === s.id}
                  onPress={() => selectShop(s.id)}
                />
              ))}
            </ScrollView>

            {shopMode && (
              <View className="flex-row items-center gap-2">
                <Text className="text-[11px] font-bold text-ink-faint">
                  在庫:
                </Text>
                {STATUS_FILTERS.map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => toggleFilter(f.key)}
                    className={`rounded-full px-3 py-1 ${
                      filters[f.key] ? "bg-ink" : "bg-card shadow-sm"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        filters[f.key] ? "text-white" : "text-ink-muted"
                      }`}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text className="py-10 text-center text-sm text-ink-faint">
            {seriesQuery.isLoading
              ? "読み込み中…"
              : "進行中のシリーズがありません。右上の＋から追加できます。"}
          </Text>
        }
      />
    </View>
  );
}

/** ショップ切替チップ（アクティブ: すべて=bg-ink / 店舗=bg-brand、非アクティブ=bg-card） */
function ShopChip({
  label,
  active,
  allMode = false,
  onPress,
}: {
  label: string;
  active: boolean;
  allMode?: boolean;
  onPress: () => void;
}) {
  const activeBg = allMode ? "bg-ink" : "bg-brand";
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3.5 py-2 ${
        active ? activeBg : "bg-card shadow-sm"
      }`}
    >
      <Text
        className={`text-[13px] font-bold ${
          active ? "text-white" : "text-ink-muted"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
