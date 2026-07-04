import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { Series } from "@/api/types";
import AvailabilityBadge from "./AvailabilityBadge";
import SeriesCover from "./SeriesCover";
import StarRating from "./StarRating";

/**
 * ホームのシリーズカード（frontend/src/components/SeriesCard.jsx のモバイルレイアウト移植）。
 * 表紙が左・情報が右の横並び。shopMode=true のとき手掛かり情報と貸出状況バッジを展開表示する。
 */
export default function SeriesCard({
  series,
  shopMode = false,
  onRent,
  onCycleAvailability,
}: {
  series: Series;
  shopMode?: boolean;
  onRent: (series: Series) => void;
  onCycleAvailability?: (series: Series) => void;
}) {
  return (
    <View className="flex-row gap-3 rounded-lg bg-card p-3 shadow-sm">
      <Link href={`/series/${series.id}`} asChild>
        <Pressable className="relative shrink-0">
          <SeriesCover
            seriesId={series.id}
            volume={series.next_volume}
            initialUrl={series.next_cover_url}
            refetchVolume={
              series.next_cover_is_fallback ? series.next_volume : null
            }
            className="h-28 w-20"
          />
          <View className="absolute left-1 top-1 rounded bg-brand/90 px-1.5 py-0.5">
            <Text className="text-xs font-bold text-white">
              次 {series.next_volume}巻
            </Text>
          </View>
        </Pressable>
      </Link>
      <View className="flex-1">
        <Link href={`/series/${series.id}`} asChild>
          <Pressable>
            <Text className="font-bold leading-tight text-ink">
              {series.title}
            </Text>
          </Pressable>
        </Link>
        <StarRating value={series.favorite_score} />

        {shopMode && (
          <View className="mt-1 gap-0.5">
            {!!series.author && (
              <Text className="text-xs text-ink-muted">
                作者: {series.author}
                {series.author_kana ? `（${series.author_kana}）` : ""}
              </Text>
            )}
            {!!series.publisher && (
              <Text className="text-xs text-ink-muted">
                出版社: {series.publisher}
              </Text>
            )}
            {!!series.magazine_label && (
              <Text className="text-xs text-ink-muted">
                掲載誌・レーベル: {series.magazine_label}
              </Text>
            )}
          </View>
        )}

        <View className="mt-auto flex-row flex-wrap items-center gap-2 pt-2">
          <Pressable
            onPress={() => onRent(series)}
            className="rounded bg-brand px-3 py-1.5 active:bg-brand-strong"
          >
            <Text className="text-sm font-semibold text-white">
              レンタル
              {series.cart_count > 0 ? ` (カート${series.cart_count})` : ""}
            </Text>
          </Pressable>
          {shopMode && onCycleAvailability && (
            <AvailabilityBadge
              status={series.availability_status}
              onPress={() => onCycleAvailability(series)}
              showCycleHint
            />
          )}
        </View>
      </View>
    </View>
  );
}
