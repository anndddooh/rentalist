import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
} from "react-native";
import { useThemeColors } from "@/theme/colors";

/** 沈み面（bg-inset）の角丸フィールド。モックアップの入力欄に相当 */
export const Field = forwardRef<TextInput, TextInputProps>(function Field(
  { className = "", ...props },
  ref
) {
  const colors = useThemeColors();
  return (
    <TextInput
      ref={ref}
      className={`w-full rounded-xl bg-inset px-4 py-3 text-base text-ink ${className}`}
      placeholderTextColor={colors.inkFaint}
      {...props}
    />
  );
});

/** ブランド色のピル型主ボタン（`bg-brand text-white font-bold`） */
export function BrandButton({
  title,
  onPress,
  disabled = false,
  busy = false,
  className = "",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      className={`w-full flex-row items-center justify-center gap-2 rounded-full bg-brand py-3.5 active:bg-brand-strong ${
        inactive ? "opacity-50" : ""
      } ${className}`}
    >
      {busy && <ActivityIndicator size="small" color="#ffffff" />}
      <Text className="text-base font-bold text-white">{title}</Text>
    </Pressable>
  );
}

/** エラーメッセージ表示 */
export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Text className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950 dark:text-rose-300">
      {message}
    </Text>
  );
}
