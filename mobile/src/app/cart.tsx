import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Toast from "react-native-toast-message";
import { checkout, clearCart, removeFromCart } from "@/api/cart";
import type { CartItem } from "@/api/types";
import Celebration from "@/components/Celebration";
import { BrandButton } from "@/components/form";
import ScreenHeader from "@/components/ScreenHeader";
import { useCartQuery } from "@/hooks/useCart";
import { errorMessage } from "@/lib/errors";

/** スワイプで現れる削除アクション */
function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-20 items-center justify-center bg-rose-500"
    >
      <Text className="text-sm font-semibold text-white">削除</Text>
    </Pressable>
  );
}

export default function Cart() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useCartQuery();
  const [celebration, setCelebration] = useState<string[]>([]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["cart"] });
    queryClient.invalidateQueries({ queryKey: ["series"] });
    queryClient.invalidateQueries({ queryKey: ["history"] });
  }

  const removeMutation = useMutation({
    mutationFn: (item: CartItem) => removeFromCart(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  const clearMutation = useMutation({
    mutationFn: clearCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  const checkoutMutation = useMutation({
    mutationFn: checkout,
    onSuccess: (result) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: `${result.count}件を確定しました。巻数を繰り上げました。`,
      });
      if (result.completed_series?.length) {
        setCelebration(result.completed_series.map((s) => s.title));
      }
      invalidateAll();
    },
    onError: (err) => Toast.show({ type: "error", text1: errorMessage(err) }),
  });

  function confirmClear() {
    // web はインライン確認だが、iOS では Alert が自然
    Alert.alert("カートを全削除", "カートを空にしますか？（確定はされません）", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "全削除",
        style: "destructive",
        onPress: () => clearMutation.mutate(),
      },
    ]);
  }

  return (
    <View className="flex-1 bg-surface">
      {celebration.length > 0 && (
        <Celebration titles={celebration} onClose={() => setCelebration([])} />
      )}

      <ScreenHeader
        onBack={() => router.back()}
        subtitle={`${items.length}冊`}
        title="カート"
        right={
          items.length > 0 ? (
            <Pressable onPress={confirmClear} hitSlop={6}>
              <Text className="text-[13px] font-bold text-rose-500">
                全削除
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="gap-2.5 px-4 pb-4 pt-1"
        renderItem={({ item }) => (
          <View className="overflow-hidden rounded-[18px] shadow-sm">
            <ReanimatedSwipeable
              renderRightActions={() => (
                <DeleteAction onPress={() => removeMutation.mutate(item)} />
              )}
              overshootRight={false}
            >
              <View className="flex-row items-center justify-between gap-3 bg-card px-4 py-3.5">
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-ink">
                    {item.series_title}
                  </Text>
                  <View className="mt-1 self-start rounded-md bg-brand-soft px-2 py-0.5">
                    <Text className="text-xs font-bold text-brand-text">
                      {item.volume_number}巻
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-ink-faint">← スワイプで削除</Text>
              </View>
            </ReanimatedSwipeable>
          </View>
        )}
        ListEmptyComponent={
          <Text className="py-10 text-center text-sm text-ink-faint">
            {isLoading
              ? "読み込み中…"
              : "カートは空です。ホームの「レンタル」ボタンから追加できます。"}
          </Text>
        }
        ListFooterComponent={
          items.length > 0 ? (
            <View className="mt-3 gap-3">
              <Text className="text-center text-xs leading-5 text-ink-faint">
                レジで会計したらこのボタンを押すと、各シリーズの「次に借りる巻」が繰り上がります。
              </Text>
              <BrandButton
                title={
                  checkoutMutation.isPending
                    ? "確定中…"
                    : `会計した — ${items.length}冊を確定する`
                }
                onPress={() => checkoutMutation.mutate()}
                busy={checkoutMutation.isPending}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}
