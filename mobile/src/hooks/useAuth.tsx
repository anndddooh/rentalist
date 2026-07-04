import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setSessionExpiredHandler } from "@/api/client";
import * as authApi from "@/api/auth";
import type { Me } from "@/api/types";
import { queryClient } from "@/lib/queryClient";
import { clearTokens, hasSession, loadRefreshToken } from "@/lib/tokens";

interface AuthContextValue {
  /** 起動時のセッション復元が完了するまで true */
  initializing: boolean;
  user: Me | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<Me | null>(null);

  // 起動時: SecureStore から refresh を復元 → access 再発行 → me 取得
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadRefreshToken();
        if (hasSession()) {
          await authApi.refreshSession();
          const me = await authApi.fetchMe();
          if (active) setUser(me);
        }
      } catch {
        await clearTokens();
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // refresh 失敗（セッション失効）→ ログイン画面へ（Stack.Protected が遷移を担う）
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    await authApi.login(username, password);
    const me = await authApi.fetchMe();
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    queryClient.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ initializing, user, signIn, signOut }),
    [initializing, user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
