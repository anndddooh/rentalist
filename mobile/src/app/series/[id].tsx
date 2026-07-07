import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { listHistory, listHistoryNextPage } from "@/api/history";
import {
  bulkAddHistory,
  deleteSeries,
  getCover,
  setCover,
  updateSeries,
  type UploadFile,
} from "@/api/series";
import type { Series, SeriesStatus } from "@/api/types";
import CoverImage from "@/components/CoverImage";
import { BrandButton, ErrorNotice, Field } from "@/components/form";
import ScreenHeader from "@/components/ScreenHeader";
import ShopStatusEditor from "@/components/ShopStatusEditor";
import StarRating from "@/components/StarRating";
import { useSeriesDetail } from "@/hooks/useSeries";
import { useShopsQuery } from "@/hooks/useShops";
import { errorMessage } from "@/lib/errors";

const STATUS_LABELS: Record<SeriesStatus, string> = {
  active: "進行中",
  wishlist: "いつか読みたい",
  completed: "読破済み",
};

interface EditForm {
  title: string;
  author: string;
  author_kana: string;
  publisher: string;
  magazine_label: string;
  total_volumes: string;
  favorite_score: number;
  status: SeriesStatus;
}

/** frontend/src/pages/SeriesDetail.jsx の移植 */
export default function SeriesDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data: series } = useSeriesDetail(id);

  if (!series) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-sm text-ink-faint">読み込み中…</Text>
      </View>
    );
  }

  // key=series.id で、別シリーズへ遷移したときに編集フォーム等の state を確実にリセットする
  return <SeriesDetailLoaded key={series.id} series={series} />;
}

function SeriesDetailLoaded({ series }: { series: Series }) {
  const id = series.id;
  const queryClient = useQueryClient();
  const { data: shops = [] } = useShopsQuery();

  // 読破済みは「次の巻」が存在しないため1巻の表紙を表示する
  const displayVolume =
    series.status === "completed" ? 1 : series.next_volume;

  const [form, setForm] = useState<EditForm>(() => ({
    title: series.title,
    author: series.author,
    author_kana: series.author_kana,
    publisher: series.publisher,
    magazine_label: series.magazine_label,
    total_volumes: series.total_volumes ? String(series.total_volumes) : "",
    favorite_score: series.favorite_score,
    status: series.status,
  }));
  const [error, setError] = useState("");

  // 表紙設定
  const [coverVolume, setCoverVolume] = useState(() => String(displayVolume));
  const [coverInputUrl, setCoverInputUrl] = useState("");
  const [coverFile, setCoverFile] = useState<UploadFile | null>(null);

  // 一括履歴追加
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToVolume, setBulkToVolume] = useState("");

  // 削除確認
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const coverQuery = useQuery({
    queryKey: ["cover", id, displayVolume],
    queryFn: () => getCover(id, displayVolume),
    staleTime: 0,
  });

  const historyQuery = useInfiniteQuery({
    queryKey: ["history", "list", id],
    queryFn: ({ pageParam }) =>
      pageParam ? listHistoryNextPage(pageParam) : listHistory(id),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const history = useMemo(
    () => historyQuery.data?.pages.flatMap((p) => p.results) ?? [],
    [historyQuery.data]
  );
  const historyTotalCount = historyQuery.data?.pages[0]?.count ?? 0;

  function invalidateSeries() {
    queryClient.invalidateQueries({ queryKey: ["series"] });
    queryClient.invalidateQueries({ queryKey: ["history"] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSeries(id, {
        ...form,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      }),
    onSuccess: () => {
      setError("");
      Toast.show({ type: "success", text1: "保存しました。" });
      invalidateSeries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const coverMutation = useMutation({
    mutationFn: () =>
      setCover(id, {
        volumeNumber: Number(coverVolume),
        imageUrl: coverInputUrl || undefined,
        imageFile: coverFile ?? undefined,
      }),
    onSuccess: () => {
      setError("");
      setCoverInputUrl("");
      setCoverFile(null);
      Toast.show({ type: "success", text1: "表紙を設定しました。" });
      queryClient.invalidateQueries({ queryKey: ["cover", id] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const bulkMutation = useMutation({
    mutationFn: (toVolume: number) => bulkAddHistory(id, toVolume),
    onSuccess: (result: { created: number }) => {
      setError("");
      setBulkToVolume("");
      setBulkOpen(false);
      Toast.show({
        type: "success",
        text1: `${result.created}件の読破記録を追加しました。`,
      });
      invalidateSeries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSeries(id),
    onSuccess: () => {
      Toast.show({ type: "success", text1: "シリーズを削除しました。" });
      invalidateSeries();
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      router.back();
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  function handleBulkAdd() {
    const n = Number(bulkToVolume);
    if (!Number.isInteger(n) || n < 1) {
      setError("巻数は 1 以上の整数を指定してください。");
      return;
    }
    bulkMutation.mutate(n);
  }

  async function pickCoverImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCoverFile({
      uri: asset.uri,
      name: asset.fileName ?? "cover.jpg",
      type: asset.mimeType ?? "image/jpeg",
    });
  }

  function openStatusPicker() {
    const statuses: SeriesStatus[] = ["active", "wishlist", "completed"];
    const options = [...statuses.map((s) => STATUS_LABELS[s]), "キャンセル"];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: "ステータス", options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index === options.length - 1) return;
        setForm((prev) => ({ ...prev, status: statuses[index] }));
      }
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: series.title }} />
      <ScreenHeader onBack={() => router.back()} />
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        {/* ヒーロー */}
        <View className="flex-row gap-4">
          <CoverImage
            url={coverQuery.data?.resolved_url}
            className="h-40 w-28 rounded-[12px] shadow-sm"
          />
          <View className="flex-1 justify-center gap-1.5">
            <Text className="text-[22px] font-extrabold leading-tight text-ink">
              {series.title}
            </Text>
            {!!series.author && (
              <Text className="text-xs text-ink-muted">
                {series.author}
                {series.author_kana ? (
                  <Text className="text-ink-faint">
                    （{series.author_kana}）
                  </Text>
                ) : null}
              </Text>
            )}
            {(!!series.publisher || !!series.magazine_label) && (
              <Text className="text-xs text-ink-faint">
                {[series.publisher, series.magazine_label]
                  .filter(Boolean)
                  .join(" ・ ")}
              </Text>
            )}
            <StarRating value={series.favorite_score} />
            <View className="flex-row flex-wrap items-center gap-1.5">
              <View className="rounded-full bg-brand-soft px-2.5 py-1">
                <Text className="text-[11px] font-bold text-brand-text">
                  {STATUS_LABELS[series.status]}
                </Text>
              </View>
              <View className="rounded-full bg-card px-2.5 py-1 shadow-sm">
                <Text className="text-[11px] font-bold text-ink-muted">
                  読了 {series.current_volume}巻
                  {series.total_volumes ? ` / 全${series.total_volumes}巻` : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 次に借りる巻 */}
        <View className="rounded-[20px] bg-brand p-4 shadow-sm">
          <Text className="text-[11px] font-bold tracking-wide text-white/70">
            {series.status === "completed" ? "読破ステータス" : "次に借りる巻"}
          </Text>
          <Text className="text-2xl font-extrabold text-white">
            {series.status === "completed"
              ? "🎉 全巻読破"
              : `${series.next_volume}巻`}
          </Text>
        </View>

        <ErrorNotice message={error} />

        {/* 編集フォーム */}
        <View className="gap-3 rounded-[20px] bg-card p-4 shadow-sm">
          <Text className="text-[13px] font-extrabold text-ink">
            基本情報の編集
          </Text>
          <Labeled label="タイトル">
            <Field
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
            />
          </Labeled>
          <Labeled label="作者名">
            <Field
              value={form.author}
              onChangeText={(v) => setForm({ ...form, author: v })}
            />
          </Labeled>
          <Labeled label="作者ふりがな">
            <Field
              value={form.author_kana}
              onChangeText={(v) => setForm({ ...form, author_kana: v })}
            />
          </Labeled>
          <Labeled label="出版社名">
            <Field
              value={form.publisher}
              onChangeText={(v) => setForm({ ...form, publisher: v })}
            />
          </Labeled>
          <Labeled label="掲載誌・レーベル">
            <Field
              value={form.magazine_label}
              onChangeText={(v) => setForm({ ...form, magazine_label: v })}
            />
          </Labeled>
          <Labeled label="全巻数（完結作品のみ）">
            <Field
              value={form.total_volumes}
              onChangeText={(v) => setForm({ ...form, total_volumes: v })}
              keyboardType="number-pad"
            />
          </Labeled>
          <Labeled label="お気に入り度">
            <StarRating
              value={form.favorite_score}
              onChange={(n) => setForm({ ...form, favorite_score: n })}
              size="text-xl"
            />
          </Labeled>
          <Labeled label="ステータス">
            <Pressable
              onPress={openStatusPicker}
              className="flex-row items-center justify-between rounded-md border border-line px-3 py-2.5"
            >
              <Text className="text-base text-ink">
                {STATUS_LABELS[form.status]}
              </Text>
              <Text className="text-xs text-ink-faint">▾</Text>
            </Pressable>
          </Labeled>
          <BrandButton
            title={saveMutation.isPending ? "保存中…" : "保存"}
            onPress={() => saveMutation.mutate()}
            busy={saveMutation.isPending}
            disabled={!form.title.trim()}
          />
        </View>

        {/* 表紙設定 */}
        <View className="gap-3 rounded-[20px] bg-card p-4 shadow-sm">
          <Text className="text-[13px] font-extrabold text-ink">
            表紙画像の設定
          </Text>
          <Labeled label="対象の巻">
            <Field
              value={coverVolume}
              onChangeText={setCoverVolume}
              keyboardType="number-pad"
            />
          </Labeled>
          <Labeled label="画像URL">
            <Field
              value={coverInputUrl}
              onChangeText={setCoverInputUrl}
              placeholder="https://..."
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Labeled>
          <Labeled label="または画像をアップロード">
            <Pressable
              onPress={pickCoverImage}
              className="self-start rounded bg-inset px-3 py-2"
            >
              <Text className="text-sm font-semibold text-ink-muted">
                {coverFile ? `選択済み: ${coverFile.name}` : "写真から選ぶ"}
              </Text>
            </Pressable>
          </Labeled>
          <Pressable
            onPress={() => coverMutation.mutate()}
            disabled={
              coverMutation.isPending ||
              !coverVolume ||
              (!coverInputUrl && !coverFile)
            }
            className={`w-full items-center rounded bg-ink-muted py-2.5 ${
              coverMutation.isPending ||
              !coverVolume ||
              (!coverInputUrl && !coverFile)
                ? "opacity-50"
                : ""
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              {coverMutation.isPending ? "設定中…" : "表紙を設定"}
            </Text>
          </Pressable>
        </View>

        {/* ショップ別貸出状況 */}
        <View className="gap-2 rounded-[20px] bg-card p-4 shadow-sm">
          <Text className="text-[13px] font-extrabold text-ink">
            ショップ別の貸出状況
          </Text>
          <ShopStatusEditor
            seriesId={series.id}
            shops={shops}
            statusMap={series.availability_map}
          />
        </View>

        {/* 読破記録 */}
        <View className="gap-2 rounded-[20px] bg-card p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-extrabold text-ink">
              読破記録
            </Text>
            <Pressable onPress={() => setBulkOpen((v) => !v)} hitSlop={6}>
              <Text className="text-xs font-semibold text-brand-text underline">
                {bulkOpen ? "閉じる" : "+ N巻まで一括追加"}
              </Text>
            </Pressable>
          </View>

          {bulkOpen && (
            <View className="gap-2 rounded border border-brand-soft bg-brand-soft/30 p-2">
              <Labeled label="巻数（N）">
                <Field
                  value={bulkToVolume}
                  onChangeText={setBulkToVolume}
                  keyboardType="number-pad"
                  placeholder="例: 10"
                />
              </Labeled>
              <Text className="text-xs text-ink-muted">
                1〜N 巻の読破記録を追加します。既に登録済みの巻はそのまま残ります。
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleBulkAdd}
                  disabled={bulkMutation.isPending}
                  className={`flex-1 items-center rounded bg-brand py-2 active:bg-brand-strong ${
                    bulkMutation.isPending ? "opacity-50" : ""
                  }`}
                >
                  <Text className="text-sm font-semibold text-white">
                    {bulkMutation.isPending ? "追加中…" : "追加"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setBulkOpen(false);
                    setBulkToVolume("");
                  }}
                  className="flex-1 items-center rounded bg-inset py-2"
                >
                  <Text className="text-sm font-semibold text-ink-muted">
                    キャンセル
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {history.length === 0 ? (
            <Text className="text-xs text-ink-faint">記録はありません。</Text>
          ) : (
            <>
              <Text className="text-xs text-ink-muted">
                全 {historyTotalCount}件
                {history.length < historyTotalCount
                  ? `（${history.length}件表示中）`
                  : ""}
              </Text>
              <View>
                {history.map((h) => (
                  <View
                    key={h.id}
                    className="flex-row justify-between py-0.5"
                  >
                    <Text className="text-sm text-ink">{h.volume_number}巻</Text>
                    <Text className="text-xs text-ink-faint">
                      {new Date(h.rented_at).toLocaleDateString("ja-JP")}
                    </Text>
                  </View>
                ))}
              </View>
              {historyQuery.hasNextPage && (
                <Pressable
                  onPress={() => historyQuery.fetchNextPage()}
                  disabled={historyQuery.isFetchingNextPage}
                  className={`w-full items-center rounded bg-inset py-1.5 ${
                    historyQuery.isFetchingNextPage ? "opacity-50" : ""
                  }`}
                >
                  <Text className="text-xs font-semibold text-ink-muted">
                    {historyQuery.isFetchingNextPage
                      ? "読み込み中…"
                      : `もっと読み込む（残り ${
                          historyTotalCount - history.length
                        }件）`}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* 削除（シリーズ名の入力を要求する強確認。web と同じ GitHub 方式） */}
        <View className="gap-2 rounded-[20px] border border-rose-300 bg-card p-4 shadow-sm dark:border-rose-800">
          {!showDelete ? (
            <Pressable onPress={() => setShowDelete(true)} hitSlop={6}>
              <Text className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                このシリーズを削除
              </Text>
            </Pressable>
          ) : (
            <>
              <Text className="text-xs text-rose-600 dark:text-rose-400">
                ⚠️
                削除すると、このシリーズの読破記録・カート・貸出状況もすべて完全に削除されます。この操作は取り消せません。
              </Text>
              <Text className="text-xs text-ink-muted">
                確認のため、シリーズ名「{series.title}」を入力してください。
              </Text>
              <Field
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder={series.title}
              />
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => deleteMutation.mutate()}
                  disabled={
                    deleteConfirm !== series.title || deleteMutation.isPending
                  }
                  className={`flex-1 items-center rounded bg-rose-600 py-2 ${
                    deleteConfirm !== series.title || deleteMutation.isPending
                      ? "opacity-40"
                      : ""
                  }`}
                >
                  <Text className="text-sm font-semibold text-white">
                    削除する
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowDelete(false);
                    setDeleteConfirm("");
                  }}
                  className="flex-1 items-center rounded bg-inset py-2"
                >
                  <Text className="text-sm font-semibold text-ink-muted">
                    キャンセル
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="text-xs font-semibold text-ink-muted">{label}</Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}
