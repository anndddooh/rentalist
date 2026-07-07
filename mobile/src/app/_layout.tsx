import "../global.css";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import OfflineBanner from "@/components/OfflineBanner";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import {
  PERSIST_MAX_AGE,
  queryClient,
  queryPersister,
} from "@/lib/queryClient";
import { useThemeColors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE }}
      >
        <AuthProvider>
          <RootStack />
        </AuthProvider>
        <OfflineBanner />
        <Toast />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { initializing, user } = useAuth();
  const colors = useThemeColors();

  // セッション復元が終わるまでスプラッシュを維持する
  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  return (
    <>
      {/* 各画面は独自のヘッダー（1a Refined）を持つ。地色に応じて自動でステータスバー配色 */}
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cart" options={{ presentation: "modal" }} />
          <Stack.Screen name="add-series" options={{ presentation: "modal" }} />
          <Stack.Screen name="series/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/signup" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
