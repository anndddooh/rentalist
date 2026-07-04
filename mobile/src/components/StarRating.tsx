import { Pressable, Text, View } from "react-native";

/**
 * お気に入り度の★表示（frontend/src/components/StarRating.jsx の移植）。
 * onChange を渡すとタップで編集可能になる。
 */
export default function StarRating({
  value = 0,
  onChange,
  size = "text-sm",
}: {
  value?: number;
  onChange?: (n: number) => void;
  size?: string;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View className="flex-row">
      {stars.map((n) => {
        const star = (
          <Text
            className={`${size} ${
              n <= value ? "text-amber-400" : "text-ink-faint opacity-60"
            }`}
          >
            ★
          </Text>
        );
        if (!onChange) return <View key={n}>{star}</View>;
        return (
          <Pressable
            key={n}
            hitSlop={4}
            onPress={() => onChange(n)}
            accessibilityLabel={`お気に入り度 ${n}`}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
