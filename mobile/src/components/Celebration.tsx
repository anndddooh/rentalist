import { useEffect, useMemo } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

interface Piece {
  id: number;
  left: number; // %
  delay: number; // s
  duration: number; // s
  color: string;
  size: number;
}

/** 紙吹雪 1 片。上から画面外まで落下しながら回転（web の confetti-fall keyframes 移植） */
function ConfettiPiece({ piece, screenHeight }: { piece: Piece; screenHeight: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay * 1000,
      withRepeat(
        withTiming(1, {
          duration: piece.duration * 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * screenHeight * 1.2 },
      { rotate: `${progress.value * 720}deg` },
    ],
    opacity: progress.value === 0 && piece.delay > 0 ? 0 : 1,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: -screenHeight * 0.05,
          left: `${piece.left}%`,
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

/**
 * シリーズを読破（最終巻まで到達）したときのお祝い演出
 * （frontend/src/components/Celebration.jsx の移植）。
 */
export default function Celebration({
  titles,
  onClose,
}: {
  titles: string[];
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.2 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 9,
      })),
    []
  );

  // カードのポップイン（web の pop-in keyframes 移植）
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.08, { duration: 240, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160 })
    );
    opacity.value = withTiming(1, { duration: 240 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (titles.length === 0) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/50"
      >
        <View
          pointerEvents="none"
          className="absolute inset-0 overflow-hidden"
        >
          {pieces.map((p) => (
            <ConfettiPiece key={p.id} piece={p} screenHeight={height} />
          ))}
        </View>

        <Animated.View
          style={cardStyle}
          className="mx-6 items-center rounded-2xl bg-card p-6 shadow-2xl"
        >
          <Text className="text-6xl">🎉</Text>
          <Text className="mt-2 text-xl font-bold text-brand-text">
            読破おめでとう！
          </Text>
          <View className="mt-3 gap-1">
            {titles.map((title) => (
              <Text key={title} className="text-center font-bold text-ink">
                {title}
              </Text>
            ))}
          </View>
          <Text className="mt-2 text-xs text-ink-faint">
            最終巻まで読み終えました 🏆
          </Text>
          <Pressable
            onPress={onClose}
            className="mt-4 rounded-full bg-brand px-8 py-2 active:bg-brand-strong"
          >
            <Text className="text-sm font-semibold text-white">閉じる</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
