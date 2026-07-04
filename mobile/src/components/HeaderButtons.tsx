import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { useCartQuery } from "@/hooks/useCart";

/** ヘッダー右のカートボタン（バッジ付き、web の Layout.jsx ヘッダー相当） */
export function CartButton() {
  const { data } = useCartQuery();
  const count = data?.length ?? 0;
  return (
    <Link href="/cart" asChild>
      <Pressable hitSlop={8} className="relative px-1">
        <SymbolView name="cart.fill" tintColor="#ffffff" size={24} />
        {count > 0 && (
          <View className="absolute -right-1.5 -top-1.5 min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1">
            <Text className="text-[11px] font-bold text-slate-900">{count}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** ホームのヘッダー右の「＋」シリーズ追加ボタン（web の FAB 相当） */
export function AddSeriesButton() {
  return (
    <Link href="/add-series" asChild>
      <Pressable hitSlop={8} className="px-1">
        <SymbolView name="plus" tintColor="#ffffff" size={22} />
      </Pressable>
    </Link>
  );
}
