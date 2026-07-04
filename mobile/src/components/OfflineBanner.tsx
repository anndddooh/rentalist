import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function subscribe(callback: () => void) {
  return onlineManager.subscribe(callback);
}

/** オフライン時に画面下部へ表示するバナー（キャッシュ表示中であることを知らせる） */
export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    subscribe,
    () => onlineManager.isOnline()
  );
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View
      pointerEvents="none"
      style={{ bottom: insets.bottom + 56 }}
      className="absolute left-0 right-0 items-center"
    >
      <View className="rounded-full bg-slate-800/90 px-4 py-1.5">
        <Text className="text-xs font-semibold text-white">
          オフライン — 保存済みの内容を表示しています
        </Text>
      </View>
    </View>
  );
}
