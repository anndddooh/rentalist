import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { createInvite, listInvites } from "@/api/auth";
import { createShop, deleteShop, updateShop } from "@/api/shops";
import type { RentalShop } from "@/api/types";
import { ErrorNotice, Field } from "@/components/form";
import { useAuth } from "@/hooks/useAuth";
import { useShopsQuery } from "@/hooks/useShops";
import { APP_ENV, API_BASE_URL } from "@/lib/env";
import { errorMessage } from "@/lib/errors";

/** frontend/src/pages/Settings.jsx の移植（+ ログアウト行） */
export default function Settings() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: shops = [] } = useShopsQuery();

  // editing: null=閉じる / "new"=新規 / number=既存ショップ編集
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [draft, setDraft] = useState({ name: "", memo: "" });
  const [error, setError] = useState("");

  const invitesQuery = useQuery({
    queryKey: ["invites"],
    queryFn: listInvites,
    enabled: Boolean(user?.is_staff),
  });

  function startEdit(shop: RentalShop | null) {
    setEditing(shop ? shop.id : "new");
    setDraft(shop ? { name: shop.name, memo: shop.memo } : { name: "", memo: "" });
    setError("");
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing === "new"
        ? createShop(draft)
        : updateShop(editing as number, draft),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (shop: RentalShop) => deleteShop(shop.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  function confirmRemove(shop: RentalShop) {
    Alert.alert(
      "ショップを削除",
      `「${shop.name}」を削除しますか？このショップの貸出状況の記録も削除されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => deleteMutation.mutate(shop),
        },
      ]
    );
  }

  const inviteMutation = useMutation({
    mutationFn: createInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  async function shareInvite(token: string) {
    await Share.share({
      message:
        `Rentalist の招待トークンです（7日間有効・1回のみ）:\n${token}\n\n` +
        "アプリのログイン画面 →「招待リンクからアカウント作成」に貼り付けてください。",
    });
  }

  function confirmSignOut() {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: () => signOut() },
    ]);
  }

  const invites = invitesQuery.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-5 p-3 pb-10"
    >
      {/* ショップ管理 */}
      <View className="gap-2 rounded-lg bg-card p-3 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-ink-muted">
            レンタルショップ
          </Text>
          {editing === null && (
            <Pressable
              onPress={() => startEdit(null)}
              className="rounded bg-brand px-3 py-1 active:bg-brand-strong"
            >
              <Text className="text-xs font-semibold text-white">+ 追加</Text>
            </Pressable>
          )}
        </View>

        <ErrorNotice message={error} />

        {editing !== null && (
          <View className="gap-2 border-b border-line/50 pb-3">
            <Field
              placeholder="店名（例: TSUTAYA渋谷店）"
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            />
            <Field
              placeholder="メモ（営業時間・場所など・任意）"
              value={draft.memo}
              onChangeText={(memo) => setDraft((d) => ({ ...d, memo }))}
              multiline
              numberOfLines={2}
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => saveMutation.mutate()}
                disabled={!draft.name.trim() || saveMutation.isPending}
                className={`flex-1 items-center rounded bg-brand py-2 active:bg-brand-strong ${
                  !draft.name.trim() || saveMutation.isPending
                    ? "opacity-50"
                    : ""
                }`}
              >
                <Text className="text-sm font-semibold text-white">保存</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditing(null)}
                className="flex-1 items-center rounded bg-inset py-2"
              >
                <Text className="text-sm font-semibold text-ink-muted">
                  キャンセル
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {shops.length === 0 ? (
          <Text className="text-xs text-ink-faint">
            ショップが未登録です。「+ 追加」から登録してください。
          </Text>
        ) : (
          <View className="gap-1">
            {shops.map((shop) => (
              <View
                key={shop.id}
                className="flex-row items-center justify-between py-1"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-semibold text-ink">
                    {shop.name}
                  </Text>
                  {!!shop.memo && (
                    <Text className="text-xs text-ink-faint">{shop.memo}</Text>
                  )}
                </View>
                <View className="flex-row gap-3">
                  <Pressable onPress={() => startEdit(shop)} hitSlop={6}>
                    <Text className="text-xs text-brand-text underline">
                      編集
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => confirmRemove(shop)} hitSlop={6}>
                    <Text className="text-xs text-rose-500 underline">
                      削除
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 招待リンク（管理者のみ） */}
      {user?.is_staff && (
        <View className="gap-2 rounded-lg bg-card p-3 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink-muted">
              招待リンク（管理者）
            </Text>
            <Pressable
              onPress={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending}
              className="rounded bg-brand px-3 py-1 active:bg-brand-strong"
            >
              <Text className="text-xs font-semibold text-white">+ 発行</Text>
            </Pressable>
          </View>
          <Text className="text-xs text-ink-faint">
            発行したトークンを家族に送るとアカウントを作成できます（7日間有効・1回のみ）。
          </Text>
          {invites.length === 0 ? (
            <Text className="text-xs text-ink-faint">
              発行済みの招待はありません。
            </Text>
          ) : (
            <View className="gap-2">
              {invites.map((inv) => (
                <View key={inv.token}>
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-xs ${
                        inv.is_valid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-ink-faint"
                      }`}
                    >
                      {inv.is_valid ? "有効" : "使用済み/期限切れ"}
                    </Text>
                    {inv.is_valid && (
                      <Pressable
                        onPress={() => shareInvite(inv.token)}
                        hitSlop={6}
                      >
                        <Text className="text-xs text-brand-text underline">
                          共有
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {inv.is_valid && (
                    <Text className="text-xs text-ink-faint" numberOfLines={1}>
                      {inv.token}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* アカウント */}
      <View className="gap-2 rounded-lg bg-card p-3 shadow-sm">
        <Text className="text-sm font-semibold text-ink-muted">アカウント</Text>
        <Text className="text-sm text-ink">
          {user?.username}
          {user?.is_staff ? "（管理者）" : ""}
        </Text>
        <Pressable onPress={confirmSignOut} hitSlop={6}>
          <Text className="text-sm font-semibold text-rose-500">
            ログアウト
          </Text>
        </Pressable>
      </View>

      <Text className="text-center text-xs text-ink-faint">
        {APP_ENV !== "production" ? `${APP_ENV} · ${API_BASE_URL}` : ""}
      </Text>
    </ScrollView>
  );
}
