import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { useCartQuery } from "@/hooks/useCart";
import { useThemeColors } from "@/theme/colors";

/** ヘッダー右のカートボタン（丸・bg-card、右上にブランド件数バッジ） */
export function CartButton() {
  const { data } = useCartQuery();
  const colors = useThemeColors();
  const count = data?.length ?? 0;
  return (
    <Link href="/cart" asChild>
      <Pressable
        hitSlop={6}
        accessibilityLabel="カート"
        className="h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm active:opacity-80"
      >
        <SymbolView name="cart.fill" tintColor={colors.brand} size={20} />
        {count > 0 && (
          <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-brand px-1">
            <Text className="text-[11px] font-bold text-white">{count}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** ホームのヘッダー右の「＋」シリーズ追加ボタン（丸・bg-card） */
export function AddSeriesButton() {
  const colors = useThemeColors();
  return (
    <Link href="/add-series" asChild>
      <Pressable
        hitSlop={6}
        accessibilityLabel="シリーズを追加"
        className="h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm active:opacity-80"
      >
        <SymbolView name="plus" tintColor={colors.brand} size={22} />
      </Pressable>
    </Link>
  );
}
