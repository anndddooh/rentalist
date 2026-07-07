import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { Series } from "@/api/types";
import AvailabilityBadge from "./AvailabilityBadge";
import SeriesCover from "./SeriesCover";

/**
 * ホームのシリーズカード（frontend/src/components/SeriesCard.jsx のモバイルレイアウト移植）。
 * 表紙が左・情報が右の横並び。shopMode=true のとき右上に貸出状況バッジを出す。
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
    <View className="flex-row gap-3.5 rounded-[20px] bg-card p-3.5 shadow-sm">
      <Link href={`/series/${series.id}`} asChild>
        <Pressable className="shrink-0">
          <SeriesCover
            seriesId={series.id}
            volume={series.next_volume}
            initialUrl={series.next_cover_url}
            refetchVolume={
              series.next_cover_is_fallback ? series.next_volume : null
            }
            className="h-28 w-[82px]"
          />
        </Pressable>
      </Link>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Link href={`/series/${series.id}`} asChild>
            <Pressable className="flex-1">
              <Text className="text-base font-bold leading-tight text-ink">
                {series.title}
              </Text>
            </Pressable>
          </Link>
          {shopMode && onCycleAvailability && (
            <AvailabilityBadge
              status={series.availability_status}
              onPress={() => onCycleAvailability(series)}
              showCycleHint
            />
          )}
        </View>

        {!!series.author && (
          <Text className="mt-0.5 text-xs text-ink-muted">
            {series.author}
            {series.author_kana ? (
              <Text className="text-ink-faint">（{series.author_kana}）</Text>
            ) : null}
          </Text>
        )}
        {(!!series.publisher || !!series.magazine_label) && (
          <Text className="text-[11px] text-ink-faint">
            {[series.publisher, series.magazine_label]
              .filter(Boolean)
              .join(" ・ ")}
          </Text>
        )}

        <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
          <View className="rounded-md bg-brand-soft px-2 py-0.5">
            <Text className="text-xs font-bold text-brand-text">
              次は {series.next_volume}巻
            </Text>
          </View>
          {!shopMode && (
            <Text className="text-[11px] text-ink-muted">
              読了 {series.current_volume} ・ ★{series.favorite_score}
            </Text>
          )}
        </View>

        <View className="mt-auto flex-row items-center gap-2 pt-1.5">
          <Pressable
            onPress={() => onRent(series)}
            className="flex-1 items-center rounded-full bg-brand py-2.5 active:bg-brand-strong"
          >
            <Text className="text-sm font-bold text-white">レンタル</Text>
          </Pressable>
          {series.cart_count > 0 && (
            <Text className="text-xs font-semibold text-ink-muted">
              カート×{series.cart_count}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
