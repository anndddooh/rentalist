import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
} from "react-native";

/** web の `rounded border border-slate-300 px-3 py-2` 入力欄に相当する共通テキスト入力 */
export const Field = forwardRef<TextInput, TextInputProps>(function Field(
  { className = "", ...props },
  ref
) {
  return (
    <TextInput
      ref={ref}
      className={`w-full rounded-md border border-line bg-card px-3 py-2.5 text-base text-ink ${className}`}
      placeholderTextColor="#94a3b8"
      {...props}
    />
  );
});

/** web の `bg-brand text-white font-semibold` ボタンに相当する主ボタン */
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
      className={`w-full flex-row items-center justify-center gap-2 rounded-md bg-brand py-3 active:bg-brand-strong ${
        inactive ? "opacity-50" : ""
      } ${className}`}
    >
      {busy && <ActivityIndicator size="small" color="#ffffff" />}
      <Text className="text-base font-semibold text-white">{title}</Text>
    </Pressable>
  );
}

/** web の `bg-rose-50 text-rose-600` エラーメッセージ表示 */
export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Text className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950 dark:text-rose-300">
      {message}
    </Text>
  );
}
