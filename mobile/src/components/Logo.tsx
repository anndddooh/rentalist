import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

/**
 * Rentalist のロゴ。開いた本＋しおりのマーク（frontend/src/components/Logo.jsx の移植）。
 * withText=true でワードマーク「Rentalist」を併記する。
 */
export default function Logo({
  size = 32,
  withText = false,
  textClassName = "",
}: {
  size?: number;
  withText?: boolean;
  textClassName?: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Rect width={48} height={48} rx={14} fill="#ffffff" />
        <Path
          d="M24 17c-3.3-2.4-7.6-3.2-11.7-2.5a1 1 0 0 0-.8 1v15.9a1 1 0 0 0 1.2 1c3.6-.6 7.2.1 10 2.2a1.1 1.1 0 0 0 1.3 0c2.8-2.1 6.4-2.8 10-2.2a1 1 0 0 0 1.2-1V15.5a1 1 0 0 0-.8-1c-4.1-.7-8.4.1-11.7 2.5z"
          fill="#5b21b6"
        />
        <Path
          d="M24 17v17.6"
          stroke="#ffffff"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Path d="M20.8 10.5h6.4v9.6L24 17.7l-3.2 2.4z" fill="#f59e0b" />
      </Svg>
      {withText && (
        <Text className={`font-bold tracking-wide ${textClassName}`}>
          Rentalist
        </Text>
      )}
    </View>
  );
}
