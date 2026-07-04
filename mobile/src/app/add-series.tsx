import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { bulkAddHistory, createSeries, searchSeries } from "@/api/series";
import type { RakutenCandidate } from "@/api/types";
import CoverImage from "@/components/CoverImage";
import { BrandButton, ErrorNotice, Field } from "@/components/form";
import StarRating from "@/components/StarRating";
import { errorMessage } from "@/lib/errors";

const EMPTY_FORM = {
  title: "",
  author: "",
  author_kana: "",
  publisher: "",
  magazine_label: "",
  total_volumes: "",
  favorite_score: 3,
  status: "active" as "active" | "wishlist",
  read_up_to: "",
};

// 「ONE PIECE 114」のような末尾の巻数表記を取り除いてシリーズ名にする
// （frontend/src/pages/AddSeries.jsx の移植）
function cleanSeriesTitle(rawTitle: string): string {
  return (rawTitle || "")
    .replace(/[\s　（(]+第?\s*\d+\s*巻?\s*[）)]?\s*$/, "")
    .trim();
}

export default function AddSeries() {
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<RakutenCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      setCandidates(await searchSeries(query));
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(candidate: RakutenCandidate, index: number) {
    setForm((prev) => ({
      ...prev,
      title: cleanSeriesTitle(candidate.title),
      author: candidate.author || "",
      author_kana: candidate.author_kana || "",
      publisher: candidate.publisher || "",
      magazine_label: candidate.series_name || prev.magazine_label,
    }));
    setSelectedIndex(index);
    setError("");
    // フォームへスクロールして「反映された」ことを分かるようにする
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: formY.current, animated: true });
    }, 50);
  }

  async function handleCreate() {
    setError("");
    setBusy(true);
    try {
      const { read_up_to, total_volumes, ...rest } = form;
      const created = await createSeries({
        ...rest,
        total_volumes: total_volumes ? Number(total_volumes) : null,
      });

      const readUpTo = Number(read_up_to);
      if (Number.isInteger(readUpTo) && readUpTo >= 1) {
        try {
          await bulkAddHistory(created.id, readUpTo);
        } catch {
          // シリーズは作れたが履歴投入で失敗。確実に伝えてから詳細で再試行させる
          queryClient.invalidateQueries({ queryKey: ["series"] });
          Alert.alert(
            "履歴の一括追加に失敗",
            "シリーズは作成されましたが、履歴の一括追加に失敗しました。シリーズ詳細から再試行してください。",
            [
              {
                text: "OK",
                onPress: () => {
                  router.back();
                  router.push(`/series/${created.id}`);
                },
              },
            ]
          );
          return;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      Toast.show({ type: "success", text1: `「${created.title}」を登録しました` });
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function setField(key: keyof typeof EMPTY_FORM) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="gap-4 p-3 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* 楽天検索 */}
        <View className="flex-row gap-2 rounded-lg bg-card p-3 shadow-sm">
          <Field
            className="flex-1"
            placeholder="タイトルで検索（楽天ブックス）"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable
            onPress={handleSearch}
            className="justify-center rounded bg-brand px-4 active:bg-brand-strong"
          >
            <Text className="text-sm font-semibold text-white">検索</Text>
          </Pressable>
        </View>

        {searching && (
          <Text className="text-center text-sm text-ink-faint">検索中…</Text>
        )}

        {searched && !searching && candidates.length === 0 && (
          <Text className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            候補が見つかりませんでした。下のフォームに手動で入力してください。
          </Text>
        )}

        {candidates.length > 0 && (
          <View className="gap-2">
            <Text className="text-xs text-ink-muted">
              該当の作品をタップすると、下のフォームに内容が反映されます。
            </Text>
            {candidates.map((c, i) => {
              const selected = selectedIndex === i;
              return (
                <Pressable
                  key={`${c.isbn ?? c.title}-${i}`}
                  onPress={() => pickCandidate(c, i)}
                  className={`flex-row gap-3 rounded-lg p-2 shadow-sm ${
                    selected
                      ? "bg-brand-soft border-2 border-brand"
                      : "bg-card"
                  }`}
                >
                  <CoverImage url={c.cover_url} className="h-20 w-14" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-ink">
                      {c.title}
                    </Text>
                    <Text className="text-xs text-ink-muted">{c.author}</Text>
                    <Text className="text-xs text-ink-faint">
                      {c.publisher}
                    </Text>
                  </View>
                  {selected && (
                    <Text className="self-center text-xs font-bold text-brand-text">
                      ✓ 選択中
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 登録フォーム */}
        <View
          className="gap-3 rounded-lg bg-card p-3 shadow-sm"
          onLayout={(e) => {
            formY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text className="text-sm font-semibold text-ink-muted">
            シリーズ情報（検索候補を選ぶと自動入力されます）
          </Text>
          {selectedIndex !== null && (
            <Text className="rounded bg-brand-soft px-2 py-1.5 text-xs text-brand-text">
              検索結果から「{form.title}
              」を反映しました。内容を確認して登録してください。
            </Text>
          )}
          <ErrorNotice message={error} />

          <Labeled label="タイトル *">
            <Field
              value={form.title}
              onChangeText={setField("title")}
              placeholder="例: ONE PIECE"
            />
          </Labeled>
          <Labeled label="作者名">
            <Field value={form.author} onChangeText={setField("author")} />
          </Labeled>
          <Labeled label="作者ふりがな">
            <Field
              value={form.author_kana}
              onChangeText={setField("author_kana")}
            />
          </Labeled>
          <Labeled label="出版社名">
            <Field
              value={form.publisher}
              onChangeText={setField("publisher")}
            />
          </Labeled>
          <Labeled label="掲載誌・レーベル">
            <Field
              value={form.magazine_label}
              onChangeText={setField("magazine_label")}
              placeholder="例: 週刊少年ジャンプ / ジャンプコミックス"
            />
          </Labeled>
          <Labeled label="全巻数（完結作品のみ・任意）">
            <Field
              value={form.total_volumes}
              onChangeText={setField("total_volumes")}
              keyboardType="number-pad"
            />
          </Labeled>
          <Labeled label="既に読んだ巻数（任意）">
            <Field
              value={form.read_up_to}
              onChangeText={setField("read_up_to")}
              keyboardType="number-pad"
              placeholder="例: 10"
            />
            <Text className="mt-1 text-xs text-ink-muted">
              「N巻まで読んだ既存シリーズ」を登録する時に使うと、1〜N
              巻の読破記録を一気に作成します。
            </Text>
          </Labeled>
          <Labeled label="お気に入り度">
            <StarRating
              value={form.favorite_score}
              onChange={(n) => setForm((prev) => ({ ...prev, favorite_score: n }))}
              size="text-xl"
            />
          </Labeled>
          <Labeled label="登録先">
            <View className="flex-row gap-2">
              {(
                [
                  { key: "active", label: "進行中" },
                  { key: "wishlist", label: "いつか読みたい" },
                ] as const
              ).map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() =>
                    setForm((prev) => ({ ...prev, status: opt.key }))
                  }
                  className={`rounded-full px-4 py-1.5 ${
                    form.status === opt.key ? "bg-brand" : "bg-inset"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      form.status === opt.key ? "text-white" : "text-ink-muted"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Labeled>

          <BrandButton
            title={busy ? "登録中…" : "このシリーズを登録"}
            onPress={handleCreate}
            busy={busy}
            disabled={!form.title.trim()}
          />
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
