import { Pressable, Text } from "react-native";
import type { AvailabilityStatus } from "@/api/types";

/** 貸出状況ピルの配色（frontend/src/components/SeriesCard.jsx の AVAILABILITY 移植） */
export const AVAILABILITY: Record<
  AvailabilityStatus,
  { label: string; pillCls: string; textCls: string }
> = {
  available: {
    label: "貸出あり",
    pillCls: "bg-emerald-100 dark:bg-emerald-950",
    textCls: "text-emerald-700 dark:text-emerald-300",
  },
  unavailable: {
    label: "貸出なし",
    pillCls: "bg-inset",
    textCls: "text-ink-muted",
  },
  unknown: {
    label: "未確認",
    pillCls: "bg-amber-100 dark:bg-amber-950",
    textCls: "text-amber-700 dark:text-amber-300",
  },
};

/** 貸出状況バッジ。onPress を渡すとタップ可能（状態サイクル/シート起動）になる。 */
export default function AvailabilityBadge({
  status,
  onPress,
  showCycleHint = false,
}: {
  status: AvailabilityStatus | null | undefined;
  onPress?: () => void;
  showCycleHint?: boolean;
}) {
  const avail = AVAILABILITY[status ?? "unknown"] ?? AVAILABILITY.unknown;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={4}
      className={`rounded px-2 py-1 ${avail.pillCls}`}
    >
      <Text className={`text-xs font-semibold ${avail.textCls}`}>
        {avail.label}
        {showCycleHint && " ⇄"}
      </Text>
    </Pressable>
  );
}
