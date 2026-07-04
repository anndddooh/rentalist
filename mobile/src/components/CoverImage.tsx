import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";
import { hiRes } from "@/lib/coverUrl";

/**
 * 表紙画像。URL が無い・読み込み失敗時は「表紙なし」プレースホルダを表示する
 * （frontend/src/components/CoverImage.jsx の移植。expo-image のディスクキャッシュで
 * オフラインでも一度表示した表紙は出る）。
 */
export default function CoverImage({
  url,
  className = "",
}: {
  url: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !url || failed;

  return (
    <View
      className={`shrink-0 items-center justify-center overflow-hidden rounded bg-inset ${className}`}
    >
      {showPlaceholder ? (
        <Text className="px-1 text-center text-[10px] leading-tight text-ink-faint">
          表紙なし
        </Text>
      ) : (
        <Image
          source={{ uri: hiRes(url) ?? undefined }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
