import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

/**
 * 左スワイプで「削除」ボタンを出す行（履歴・カートで共通）。
 *
 * 削除ボタンを押したら、まず行を閉じてから onDelete を呼ぶ。閉じないと、
 * 確認ダイアログをキャンセルした時や一覧の再取得が終わるまでの間、
 * 行がスワイプしたまま残って見える。
 */
export default function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <ReanimatedSwipeable
      renderRightActions={(_progress, _translation, swipeable) => (
        <Pressable
          onPress={() => {
            swipeable.close();
            onDelete();
          }}
          className="w-20 items-center justify-center bg-rose-500"
        >
          <Text className="text-sm font-semibold text-white">削除</Text>
        </Pressable>
      )}
      overshootRight={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
