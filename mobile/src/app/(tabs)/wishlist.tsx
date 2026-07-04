import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { updateSeries } from "@/api/series";
import type { Series } from "@/api/types";
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
    <FlatList
      className="flex-1 bg-surface"
      contentContainerClassName="gap-3 p-3"
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
        <View className="rounded-lg bg-card p-3 shadow-sm">
          <View className="flex-row gap-3">
            <Link href={`/series/${item.id}`} asChild>
              <Pressable className="shrink-0">
                <SeriesCover
                  seriesId={item.id}
                  volume={1}
                  initialUrl={item.first_volume_cover_url}
                  className="h-28 w-20"
                />
              </Pressable>
            </Link>
            <View className="flex-1">
              <Link href={`/series/${item.id}`} asChild>
                <Pressable>
                  <Text className="font-bold leading-tight text-ink">
                    {item.title}
                  </Text>
                </Pressable>
              </Link>
              {!!item.author && (
                <Text className="text-xs text-ink-muted">{item.author}</Text>
              )}
              <StarRating value={item.favorite_score} />
              <Pressable
                onPress={() => startMutation.mutate(item)}
                className="mt-2 self-start rounded bg-brand px-3 py-1.5 active:bg-brand-strong"
              >
                <Text className="text-sm font-semibold text-white">
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
            className="mt-2"
          >
            <Text className="text-xs text-brand-text underline">
              {expandedId === item.id
                ? "貸出状況を閉じる"
                : "ショップ別の貸出状況"}
            </Text>
          </Pressable>
          {expandedId === item.id && (
            <View className="mt-2 border-t border-line/50 pt-2">
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
  );
}
