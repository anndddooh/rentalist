import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import ScreenHeader from "@/components/ScreenHeader";
import SeriesCover from "@/components/SeriesCover";
import StarRating from "@/components/StarRating";
import { useSeriesList } from "@/hooks/useSeries";

/** frontend/src/pages/Completed.jsx の移植（2列グリッド） */
export default function Completed() {
  const queryClient = useQueryClient();
  const seriesQuery = useSeriesList("completed");
  const count = seriesQuery.data?.length ?? 0;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        subtitle={`読み切った ${count}シリーズ`}
        title="読破"
      />
      <FlatList
        className="flex-1 bg-surface"
        contentContainerClassName="gap-4 px-4 pb-4 pt-1"
        columnWrapperStyle={{ gap: 14 }}
        numColumns={2}
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
          <Link href={`/series/${item.id}`} asChild>
            <Pressable className="flex-1 gap-2 active:opacity-80">
              <View className="relative">
                <SeriesCover
                  seriesId={item.id}
                  volume={1}
                  initialUrl={item.first_volume_cover_url}
                  className="aspect-[2/3] w-full rounded-[12px] shadow-sm"
                />
                <View className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-0.5">
                  <Text className="text-[11px] font-bold text-white">
                    全{item.total_volumes ?? item.current_volume}巻
                  </Text>
                </View>
              </View>
              <View>
                <Text
                  className="text-sm font-bold leading-tight text-ink"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <StarRating value={item.favorite_score} size="text-xs" />
              </View>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          <Text className="py-10 text-center text-sm text-ink-faint">
            {seriesQuery.isLoading
              ? "読み込み中…"
              : "読破済みのシリーズはまだありません。"}
          </Text>
        }
      />
    </View>
  );
}
