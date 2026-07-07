import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { updateSeries } from "@/api/series";
import type { Series } from "@/api/types";
import { AddSeriesButton } from "@/components/HeaderButtons";
import ScreenHeader from "@/components/ScreenHeader";
import SeriesCover from "@/components/SeriesCover";
import ShopStatusEditor from "@/components/ShopStatusEditor";
import StarRating from "@/components/StarRating";
import { useSeriesList } from "@/hooks/useSeries";
import { useShopsQuery } from "@/hooks/useShops";
import { errorMessage } from "@/lib/errors";

/** frontend/src/pages/Wishlist.jsx の移植 */
export default function Wishlist() {
  const queryClient = useQueryClient();
  const seriesQuery = useSeriesList("wishlist");
  const { data: shops = [] } = useShopsQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const count = seriesQuery.data?.length ?? 0;

  const startMutation = useMutation({
    mutationFn: (target: Series) =>
      updateSeries(target.id, { status: "active" }),
    onSuccess: (_data, target) => {
      Toast.show({
        type: "success",
        text1: `「${target.title}」を読み始めました`,
      });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        subtitle={`いつか読みたい ${count}作品`}
        title="読みたい"
        right={<AddSeriesButton />}
      />
      <FlatList
        className="flex-1 bg-surface"
        contentContainerClassName="gap-3 px-4 pb-4 pt-1"
        data={seriesQuery.data ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={seriesQuery.isRefetching}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: ["series"] })
            }
          />
        }
        renderItem={({ item }) => (
          <View className="rounded-[20px] bg-card p-3.5 shadow-sm">
            <View className="flex-row gap-3.5">
              <Link href={`/series/${item.id}`} asChild>
                <Pressable className="shrink-0">
                  <SeriesCover
                    seriesId={item.id}
                    volume={1}
                    initialUrl={item.first_volume_cover_url}
                    className="h-28 w-[82px]"
                  />
                </Pressable>
              </Link>
              <View className="flex-1">
                <Link href={`/series/${item.id}`} asChild>
                  <Pressable>
                    <Text className="text-base font-bold leading-tight text-ink">
                      {item.title}
                    </Text>
                  </Pressable>
                </Link>
                {!!item.author && (
                  <Text className="mt-0.5 text-xs text-ink-muted">
                    {item.author}
                  </Text>
                )}
                <StarRating value={item.favorite_score} />
                <Pressable
                  onPress={() => startMutation.mutate(item)}
                  className="mt-auto items-center rounded-full border-[1.5px] border-brand py-2 active:bg-brand-soft"
                >
                  <Text className="text-sm font-bold text-brand">
                    読み始める
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              hitSlop={6}
              className="mt-3 border-t border-line pt-2.5"
            >
              <Text className="text-xs font-semibold text-brand-text">
                {expandedId === item.id
                  ? "貸出状況を閉じる"
                  : "ショップ別の貸出状況 ▾"}
              </Text>
            </Pressable>
            {expandedId === item.id && (
              <View className="mt-2">
                <ShopStatusEditor
                  seriesId={item.id}
                  shops={shops}
                  statusMap={item.availability_map}
                />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text className="py-10 text-center text-sm text-ink-faint">
            {seriesQuery.isLoading
              ? "読み込み中…"
              : "Wishlist は空です。ホーム右上の＋からシリーズを追加できます。"}
          </Text>
        }
      />
    </View>
  );
}
