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

// 「いつか読みたい」と「中断」（読むのをやめた進行中シリーズ）を切り替えて表示する
const TABS = {
  wishlist: {
    label: "いつか読みたい",
    action: "読み始める",
    done: (title: string) => `「${title}」を読み始めました`,
    empty: "読みたいリストは空です。右上の＋からシリーズを追加できます。",
  },
  dropped: {
    label: "中断",
    action: "再開する",
    done: (title: string) => `「${title}」を再開しました`,
    empty: "中断中のシリーズはありません。シリーズ詳細のステータスで「中断」にできます。",
  },
} as const;
type TabKey = keyof typeof TABS;

/** frontend/src/pages/Wishlist.jsx の移植 */
export default function Wishlist() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("wishlist");
  const wishlistQuery = useSeriesList("wishlist");
  const droppedQuery = useSeriesList("dropped");
  const seriesQuery = tab === "dropped" ? droppedQuery : wishlistQuery;
  const { data: shops = [] } = useShopsQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const count = seriesQuery.data?.length ?? 0;

  const startMutation = useMutation({
    mutationFn: (target: Series) =>
      updateSeries(target.id, { status: "active" }),
    onSuccess: (_data, target) => {
      Toast.show({
        type: "success",
        text1: TABS[tab].done(target.title),
      });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        subtitle={`${TABS[tab].label} ${count}作品`}
        title="読みたい"
        right={<AddSeriesButton />}
      />
      <View className="mx-4 mb-2 flex-row rounded-full bg-inset p-1">
        {(Object.keys(TABS) as TabKey[]).map((key) => {
          const n = (key === "dropped" ? droppedQuery : wishlistQuery).data?.length;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className={`flex-1 items-center rounded-full py-2 ${
                tab === key ? "bg-card shadow-sm" : ""
              }`}
            >
              <Text
                className={`text-[13px] font-bold ${
                  tab === key ? "text-brand" : "text-ink-muted"
                }`}
              >
                {TABS[key].label}
                {n !== undefined ? ` ${n}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
                    {TABS[tab].action}
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
              : TABS[tab].empty}
          </Text>
        }
      />
    </View>
  );
}
