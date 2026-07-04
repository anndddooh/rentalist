import "../global.css";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
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
      {/* ヘッダーは web と同じブランド紫。上に重なる文字は常に白 */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="cart"
            options={{ presentation: "modal", title: "カート" }}
          />
          <Stack.Screen
            name="add-series"
            options={{ presentation: "modal", title: "シリーズ追加" }}
          />
          <Stack.Screen name="series/[id]" options={{ title: "シリーズ詳細" }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/signup" options={{ title: "アカウント作成" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
