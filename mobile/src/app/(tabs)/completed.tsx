import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import SeriesCover from "@/components/SeriesCover";
import StarRating from "@/components/StarRating";
import { useSeriesList } from "@/hooks/useSeries";

/** frontend/src/pages/Completed.jsx の移植 */
export default function Completed() {
  const queryClient = useQueryClient();
  const seriesQuery = useSeriesList("completed");

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
        <Link href={`/series/${item.id}`} asChild>
          <Pressable className="flex-row gap-3 rounded-lg bg-card p-3 shadow-sm active:opacity-80">
            <SeriesCover
              seriesId={item.id}
              volume={1}
              initialUrl={item.first_volume_cover_url}
              className="h-28 w-20"
            />
            <View className="flex-1">
              <Text className="font-bold leading-tight text-ink">
                {item.title}
              </Text>
              <Text className="text-xs text-ink-muted">
                全{item.total_volumes ?? item.current_volume}巻 読破
              </Text>
              <View className="mt-auto pt-1">
                <StarRating value={item.favorite_score} />
              </View>
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
  );
}
