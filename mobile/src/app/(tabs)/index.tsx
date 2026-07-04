import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { addToCart } from "@/api/cart";
import { setAvailability } from "@/api/series";
import type { AvailabilityStatus, Series } from "@/api/types";
import SeriesCard from "@/components/SeriesCard";
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
  const selectedShop = shops.find((s) => s.id === shopId);

  function openShopSelector() {
    const options = [
      "絞り込みなし（全シリーズ）",
      ...shops.map((s) => s.name),
      "キャンセル",
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "ショップで絞り込み",
        options,
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index === options.length - 1) return;
        setStickyIds(new Set());
        setShopId(index === 0 ? null : shops[index - 1].id);
      }
    );
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
    <FlatList
      className="flex-1 bg-surface"
      contentContainerClassName="gap-3 p-3"
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
        <View className="rounded-lg bg-card p-3 shadow-sm">
          <Text className="text-xs font-semibold text-ink-muted">
            ショップで絞り込み
          </Text>
          <Pressable
            onPress={openShopSelector}
            className="mt-1 flex-row items-center justify-between rounded-md border border-line px-3 py-2"
          >
            <Text className="text-sm text-ink">
              {selectedShop ? selectedShop.name : "絞り込みなし（全シリーズ）"}
            </Text>
            <Text className="text-xs text-ink-faint">▾</Text>
          </Pressable>

          {shopMode && (
            <View className="mt-2 flex-row gap-2">
              {STATUS_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => toggleFilter(f.key)}
                  className={`rounded-full px-3 py-1 ${
                    filters[f.key] ? "bg-brand" : "bg-inset"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
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
  );
}
