import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
      className="flex-1 bg-brand"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerClassName="flex-grow items-center justify-center gap-7 p-7"
        keyboardShouldPersistTaps="handled"
        style={{ paddingTop: insets.top }}
      >
        <View className="items-center gap-3.5">
          <Logo size={64} />
          <View className="items-center">
            <Text className="text-[32px] font-extrabold tracking-tight text-white">
              Rentalist
            </Text>
            <Text className="mt-1 text-sm font-medium text-white/70">
              家族の漫画レンタルを、かしこく管理
            </Text>
          </View>
        </View>

        <View className="w-full max-w-sm gap-3 rounded-[24px] bg-card p-5 shadow-lg">
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
        </View>

        <Link
          href="/signup"
          className="text-center text-sm font-semibold text-white/80"
        >
          招待リンクからアカウント作成
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
