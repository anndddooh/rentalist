import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { listCart } from "../api/cart.js";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);

/**
 * カート件数をアプリ全体で共有する。レンタル追加・削除・確定の直後に
 * refreshCart() を呼ぶことで、画面遷移しなくてもバッジが即更新される。
 */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const items = await listCart();
      setCartCount(items.length);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshCart();
    } else {
      setCartCount(0);
    }
  }, [user, refreshCart]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
