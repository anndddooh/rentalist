import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { createInvite, listInvites } from "@/api/auth";
import { createShop, deleteShop, updateShop } from "@/api/shops";
import type { RentalShop } from "@/api/types";
import { ErrorNotice, Field } from "@/components/form";
import ScreenHeader from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { useShopsQuery } from "@/hooks/useShops";
import { APP_ENV, API_BASE_URL } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { useThemeColors } from "@/theme/colors";

/** frontend/src/pages/Settings.jsx の移植（+ ログアウト行） */
export default function Settings() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
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
    <View className="flex-1 bg-surface">
      <ScreenHeader
        subtitle={`${user?.username ?? ""}${user?.is_staff ? "（管理者）" : ""}`}
        title="設定"
      />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="gap-4 px-4 pb-10 pt-1"
      >
        {/* ショップ管理 */}
        <View className="overflow-hidden rounded-[20px] bg-card shadow-sm">
          <View className="flex-row items-center justify-between border-b border-line px-4 py-3.5">
            <Text className="text-[13px] font-extrabold tracking-wide text-ink">
              レンタルショップ
            </Text>
            {editing === null && (
              <Pressable onPress={() => startEdit(null)} hitSlop={6}>
                <Text className="text-xs font-bold text-brand-text">
                  ＋ 追加
                </Text>
              </Pressable>
            )}
          </View>

          <View className="gap-2 px-4 py-3">
            <ErrorNotice message={error} />

            {editing !== null && (
              <View className="gap-2 border-b border-line pb-3">
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
                    className={`flex-1 items-center rounded-full bg-brand py-2.5 active:bg-brand-strong ${
                      !draft.name.trim() || saveMutation.isPending
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <Text className="text-sm font-bold text-white">保存</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditing(null)}
                    className="flex-1 items-center rounded-full bg-inset py-2.5"
                  >
                    <Text className="text-sm font-bold text-ink-muted">
                      キャンセル
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {shops.length === 0 ? (
              <Text className="text-xs text-ink-faint">
                ショップが未登録です。「＋ 追加」から登録してください。
              </Text>
            ) : (
              <View>
                {shops.map((shop) => (
                  <View
                    key={shop.id}
                    className="flex-row items-center gap-3 py-2"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                      <SymbolView
                        name="bag.fill"
                        tintColor={colors.brand}
                        size={18}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink">
                        {shop.name}
                      </Text>
                      {!!shop.memo && (
                        <Text className="text-xs text-ink-faint">
                          {shop.memo}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row gap-3">
                      <Pressable onPress={() => startEdit(shop)} hitSlop={6}>
                        <Text className="text-xs font-semibold text-brand-text">
                          編集
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => confirmRemove(shop)} hitSlop={6}>
                        <Text className="text-xs font-semibold text-rose-500">
                          削除
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* 招待リンク（管理者のみ） */}
        {user?.is_staff && (
          <View className="overflow-hidden rounded-[20px] bg-card shadow-sm">
            <View className="flex-row items-center justify-between border-b border-line px-4 py-3.5">
              <Text className="text-[13px] font-extrabold tracking-wide text-ink">
                家族を招待
              </Text>
              <Pressable
                onPress={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                hitSlop={6}
              >
                <Text className="text-xs font-bold text-brand-text">
                  ＋ リンクを発行
                </Text>
              </Pressable>
            </View>
            <View className="gap-2 px-4 py-3">
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
                        {inv.is_valid ? (
                          <View className="rounded-full bg-emerald-100 px-2.5 py-0.5 dark:bg-emerald-950">
                            <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              有効
                            </Text>
                          </View>
                        ) : (
                          <View className="rounded-full bg-inset px-2.5 py-0.5">
                            <Text className="text-xs font-bold text-ink-faint">
                              使用済み/期限切れ
                            </Text>
                          </View>
                        )}
                        {inv.is_valid && (
                          <Pressable
                            onPress={() => shareInvite(inv.token)}
                            hitSlop={6}
                          >
                            <Text className="text-xs font-bold text-brand-text">
                              共有
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      {inv.is_valid && (
                        <Text
                          className="mt-1 text-xs text-ink-faint"
                          numberOfLines={1}
                        >
                          {inv.token}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ログアウト */}
        <Pressable
          onPress={confirmSignOut}
          className="flex-row items-center justify-between rounded-[20px] bg-card px-4 py-3.5 shadow-sm active:opacity-80"
        >
          <Text className="text-sm font-bold text-rose-500">ログアウト</Text>
          <SymbolView
            name="rectangle.portrait.and.arrow.right"
            tintColor="#e11d48"
            size={18}
          />
        </Pressable>

        <Text className="text-center text-xs text-ink-faint">
          {APP_ENV !== "production" ? `${APP_ENV} · ${API_BASE_URL}` : ""}
        </Text>
      </ScrollView>
    </View>
  );
}
