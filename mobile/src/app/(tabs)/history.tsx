import DateTimePicker from "@react-native-community/datetimepicker";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Toast from "react-native-toast-message";
import {
  addHistory,
  deleteHistory,
  listHistory,
  listHistoryNextPage,
} from "@/api/history";
import type { RentalHistoryItem, Series } from "@/api/types";
import { BrandButton, ErrorNotice, Field } from "@/components/form";
import ReadingStatsChart from "@/components/ReadingStatsChart";
import { useSeriesListAll } from "@/hooks/useSeries";
import { errorMessage } from "@/lib/errors";

/** frontend/src/pages/History.jsx の移植（DRF ページネーションは useInfiniteQuery で追従） */
export default function History() {
  const queryClient = useQueryClient();
  const [filterSeries, setFilterSeries] = useState<Series | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSeries, setFormSeries] = useState<Series | null>(null);
  const [formVolume, setFormVolume] = useState("");
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formError, setFormError] = useState("");

  const { data: allSeries = [] } = useSeriesListAll();

  const historyQuery = useInfiniteQuery({
    queryKey: ["history", "list", filterSeries?.id ?? null],
    queryFn: ({ pageParam }) =>
      pageParam
        ? listHistoryNextPage(pageParam)
        : listHistory(filterSeries?.id),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });

  const entries = useMemo(
    () => historyQuery.data?.pages.flatMap((p) => p.results) ?? [],
    [historyQuery.data]
  );
  const totalCount = historyQuery.data?.pages[0]?.count ?? 0;

  function invalidateHistory() {
    queryClient.invalidateQueries({ queryKey: ["history"] });
    queryClient.invalidateQueries({ queryKey: ["series"] });
  }

  function pickSeries(onPick: (s: Series | null) => void, allowAll: boolean) {
    const options = [
      ...(allowAll ? ["すべてのシリーズ"] : []),
      ...allSeries.map((s) => s.title),
      "キャンセル",
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index === options.length - 1) return;
        if (allowAll) {
          onPick(index === 0 ? null : allSeries[index - 1]);
        } else {
          onPick(allSeries[index]);
        }
      }
    );
  }

  const addMutation = useMutation({
    mutationFn: () =>
      addHistory({
        seriesId: formSeries!.id,
        volumeNumber: Number(formVolume),
        rentedAt: formDate.toISOString(),
      }),
    onSuccess: () => {
      setShowForm(false);
      setFormSeries(null);
      setFormVolume("");
      setFormDate(new Date());
      setFormError("");
      invalidateHistory();
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: RentalHistoryItem) => deleteHistory(entry.id),
    onSuccess: invalidateHistory,
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  function confirmDelete(entry: RentalHistoryItem) {
    Alert.alert(
      "履歴を削除",
      "この履歴を削除しますか？（読まずに返却した場合など）巻数が再計算されます。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => deleteMutation.mutate(entry),
        },
      ]
    );
  }

  return (
    <FlatList
      className="flex-1 bg-surface"
      contentContainerClassName="gap-2 p-3 pb-10"
      data={entries}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={historyQuery.isRefetching && !historyQuery.isFetchingNextPage}
          onRefresh={invalidateHistory}
        />
      }
      onEndReachedThreshold={0.3}
      onEndReached={() => {
        if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
          historyQuery.fetchNextPage();
        }
      }}
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          <ReadingStatsChart />

          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-ink-muted">
              {totalCount > 0
                ? `全 ${totalCount}件${
                    entries.length < totalCount
                      ? `（${entries.length}件表示中）`
                      : ""
                  }`
                : ""}
            </Text>
            <Pressable
              onPress={() => setShowForm((v) => !v)}
              className="rounded bg-brand px-3 py-1 active:bg-brand-strong"
            >
              <Text className="text-sm font-semibold text-white">
                {showForm ? "閉じる" : "+ 追加"}
              </Text>
            </Pressable>
          </View>

          {showForm && (
            <View className="gap-2 rounded-lg bg-card p-3 shadow-sm">
              <ErrorNotice message={formError} />
              <Pressable
                onPress={() => pickSeries((s) => s && setFormSeries(s), false)}
                className="rounded-md border border-line px-3 py-2.5"
              >
                <Text
                  className={`text-base ${
                    formSeries ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {formSeries ? formSeries.title : "シリーズを選択"}
                </Text>
              </Pressable>
              <Field
                placeholder="巻数"
                value={formVolume}
                onChangeText={setFormVolume}
                keyboardType="number-pad"
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-ink-muted">借りた日</Text>
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  onChange={(_event, date) => date && setFormDate(date)}
                />
              </View>
              <BrandButton
                title={addMutation.isPending ? "追加中…" : "履歴に追加"}
                onPress={() => addMutation.mutate()}
                busy={addMutation.isPending}
                disabled={!formSeries || !formVolume}
              />
            </View>
          )}

          <Pressable
            onPress={() => pickSeries(setFilterSeries, true)}
            className="flex-row items-center justify-between rounded-md border border-line bg-card px-3 py-2"
          >
            <Text className="text-sm text-ink">
              {filterSeries ? filterSeries.title : "すべてのシリーズ"}
            </Text>
            <Text className="text-xs text-ink-faint">▾</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View className="overflow-hidden rounded-lg shadow-sm">
          <ReanimatedSwipeable
            renderRightActions={() => (
              <Pressable
                onPress={() => confirmDelete(item)}
                className="w-20 items-center justify-center bg-rose-500"
              >
                <Text className="text-sm font-semibold text-white">削除</Text>
              </Pressable>
            )}
            overshootRight={false}
          >
            <View className="flex-row items-center justify-between bg-card p-3">
              <View>
                <Text className="text-sm text-ink">
                  <Text className="font-semibold">{item.series_title}</Text>{" "}
                  <Text className="text-brand-text">
                    {item.volume_number}巻
                  </Text>
                </Text>
                <Text className="text-xs text-ink-faint">
                  {new Date(item.rented_at).toLocaleDateString("ja-JP")}
                </Text>
              </View>
            </View>
          </ReanimatedSwipeable>
        </View>
      )}
      ListEmptyComponent={
        <Text className="py-10 text-center text-sm text-ink-faint">
          {historyQuery.isLoading ? "読み込み中…" : "履歴がありません。"}
        </Text>
      }
      ListFooterComponent={
        historyQuery.isFetchingNextPage ? (
          <Text className="py-3 text-center text-xs text-ink-faint">
            読み込み中…
          </Text>
        ) : null
      }
    />
  );
}
