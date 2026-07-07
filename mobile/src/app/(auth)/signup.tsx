import { router } from "expo-router";
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
import { checkInvite, signup } from "@/api/auth";
import { BrandButton, ErrorNotice, Field } from "@/components/form";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { errorMessage } from "@/lib/errors";

/** 招待リンク（…/signup?token=xxx）や生のトークン文字列から UUID を抜き出す */
function extractToken(input: string): string | null {
  const match = input.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return match ? match[0] : null;
}

export default function Signup() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [inviteInput, setInviteInput] = useState("");
  const [validToken, setValidToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCheck() {
    setError("");
    const token = extractToken(inviteInput);
    if (!token) {
      setError("招待リンク（またはトークン）の形式が正しくありません。");
      return;
    }
    setChecking(true);
    try {
      const res = await checkInvite(token);
      if (res.valid) {
        setValidToken(token);
      } else {
        setError("この招待リンクは無効、または期限切れです。");
      }
    } catch {
      setError("この招待リンクは無効、または期限切れです。");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit() {
    if (!validToken) return;
    setError("");
    setBusy(true);
    try {
      await signup(validToken, username, password);
      await signIn(username, password);
      // 遷移は Stack.Protected が行う
    } catch (err) {
      setError(errorMessage(err, "サインアップに失敗しました。"));
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
          {!validToken ? (
            <>
              <Text className="text-center text-sm text-ink-muted">
                共有された招待リンクを貼り付けてください
              </Text>
              <ErrorNotice message={error} />
              <Field
                placeholder="招待リンク or トークン"
                value={inviteInput}
                onChangeText={setInviteInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <BrandButton
                title={checking ? "確認中…" : "招待リンクを確認"}
                onPress={handleCheck}
                busy={checking}
                disabled={!inviteInput.trim()}
              />
              <Text
                className="text-center text-sm font-semibold text-brand-text"
                onPress={() => router.back()}
              >
                ログイン画面へ戻る
              </Text>
            </>
          ) : (
            <>
              <Text className="text-center text-sm text-ink-muted">
                招待リンクからアカウントを作成
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
                placeholder="パスワード（8文字以上）"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
              />
              <BrandButton
                title={busy ? "作成中…" : "アカウント作成"}
                onPress={handleSubmit}
                busy={busy}
                disabled={!username || !password}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
