import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/theme/colors";

/**
 * デザイン言語 1a「Refined」の画面ヘッダー。
 * サブ見出し（小・text-ink-muted）＋大見出し（extrabold・text-ink）を縦に置き、
 * 右側にアクション（丸ボタン / ピル）を並べる。onBack を渡すと左に丸い戻るボタンを出す。
 */
export default function ScreenHeader({
  subtitle,
  title,
  right,
  onBack,
}: {
  subtitle?: string;
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="bg-surface px-5 pb-2"
    >
      <View
        className={`flex-row ${
          onBack ? "items-center gap-3" : "items-end justify-between"
        }`}
      >
        {onBack && (
          <RoundIconButton
            symbol="chevron.left"
            tone="ink"
            onPress={onBack}
            accessibilityLabel="戻る"
          />
        )}
        <View className={onBack ? "" : "flex-1 pr-3"}>
          {!!subtitle && (
            <Text className="text-sm font-semibold text-ink-muted">
              {subtitle}
            </Text>
          )}
          {!!title && (
            <Text className="text-[28px] font-extrabold leading-tight text-ink">
              {title}
            </Text>
          )}
        </View>
        {!!right && <View className={onBack ? "ml-auto" : ""}>{right}</View>}
      </View>
    </View>
  );
}

/** ヘッダー右/左に置く 44px 丸ボタン（bg-card・影・中にアイコン） */
export function RoundIconButton({
  symbol,
  tone = "brand",
  onPress,
  accessibilityLabel,
  children,
}: {
  symbol: SymbolViewProps["name"];
  tone?: "brand" | "ink";
  onPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm active:opacity-80"
    >
      <SymbolView
        name={symbol}
        tintColor={tone === "ink" ? colors.ink : colors.brand}
        size={20}
      />
      {children}
    </Pressable>
  );
}
