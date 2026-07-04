import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

const DAY = 24 * 60 * 60 * 1000;

/** 表示専用オフラインキャッシュ: クエリは 7 日保持し AsyncStorage に永続化。
 *  ミューテーションはオンライン必須（networkMode 既定 online）。 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * DAY,
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "rentalist-query-cache",
});

export const PERSIST_MAX_AGE = 7 * DAY;

// オンライン判定を NetInfo に接続（オフライン中はクエリを一時停止）
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)))
);

// フォアグラウンド復帰を「フォーカス」として再検証（access token 30 分失効対策も兼ねる）
AppState.addEventListener("change", (status) => {
  focusManager.setFocused(status === "active");
});
