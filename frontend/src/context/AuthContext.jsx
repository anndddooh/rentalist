import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { login as apiLogin, fetchMe, refreshSession } from "../api/auth.js";
import { clearTokens, hasSession } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (hasSession()) {
        try {
          await refreshSession();
          setUser(await fetchMe());
        } catch {
          clearTokens();
        }
      }
      setLoading(false);
    }
    bootstrap();
  }, []);

  const login = useCallback(async (username, password) => {
    await apiLogin(username, password);
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
