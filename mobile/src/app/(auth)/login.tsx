import { Link } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandButton, ErrorNotice, Field } from "@/components/form";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { errorMessage } from "@/lib/errors";

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError("");
    setBusy(true);
    try {
      await signIn(username, password);
      // 遷移は Stack.Protected が user の変化で行う
    } catch (err) {
      setError(errorMessage(err, "ユーザー名またはパスワードが違います。"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center p-6"
        keyboardShouldPersistTaps="handled"
        style={{ paddingTop: insets.top }}
      >
        <View className="w-full max-w-sm gap-4 rounded-xl bg-card p-6 shadow">
          <View className="items-center">
            <Logo size={48} withText textClassName="text-2xl text-brand-text" />
          </View>
          <Text className="text-center text-sm text-ink-muted">
            漫画レンタル管理にログイン
          </Text>
          <ErrorNotice message={error} />
          <Field
            placeholder="ユーザー名"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />
          <Field
            placeholder="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            onSubmitEditing={handleSubmit}
          />
          <BrandButton
            title={busy ? "ログイン中…" : "ログイン"}
            onPress={handleSubmit}
            busy={busy}
            disabled={!username || !password}
          />
          <Link href="/signup" className="text-center text-sm text-brand-text">
            招待リンクからアカウント作成
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
