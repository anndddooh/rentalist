import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { listCart } from "../api/cart.js";
import { useAuth } from "../context/AuthContext.jsx";

// モバイル下部ナビ（5タブ）
const MOBILE_NAV = [
  { to: "/", label: "ホーム", icon: "🏠", end: true },
  { to: "/wishlist", label: "Wishlist", icon: "📑" },
  { to: "/history", label: "履歴", icon: "📖" },
  { to: "/completed", label: "完結", icon: "🏆" },
  { to: "/settings", label: "設定", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    listCart()
      .then((items) => setCartCount(items.length))
      .catch(() => setCartCount(0));
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full">
      {/* デスクトップ: 左サイドバー */}
      <aside className="hidden w-56 shrink-0 flex-col bg-brand-dark text-white md:flex">
        <Link
          to="/"
          className="px-5 py-4 text-xl font-bold tracking-wide text-white"
        >
          Rentalist
        </Link>
        <nav className="flex-1 space-y-1 px-2">
          <SidebarLink to="/" icon="🏠" label="ホーム" end />
          <SidebarLink to="/wishlist" icon="📑" label="Wishlist" />
          <SidebarLink to="/history" icon="📖" label="履歴" />
          <SidebarLink to="/completed" icon="🏆" label="完結" />
          <SidebarLink to="/add" icon="➕" label="シリーズ追加" />
          <SidebarLink
            to="/cart"
            icon="🛒"
            label={`カート${cartCount > 0 ? `（${cartCount}）` : ""}`}
          />
          <SidebarLink to="/settings" icon="⚙️" label="設定" />
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm text-brand-light">{user?.username}</div>
          <button
            onClick={handleLogout}
            className="mt-1 text-xs text-brand-light underline"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインカラム */}
      <div className="flex h-full flex-1 flex-col">
        {/* モバイル: ヘッダー */}
        <header className="flex items-center justify-between bg-brand px-4 py-3 text-white md:hidden">
          <Link to="/" className="text-lg font-bold tracking-wide">
            Rentalist
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative text-xl" aria-label="カート">
              🛒
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 text-xs font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-brand-light underline"
            >
              {user?.username}・ログアウト
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="mx-auto w-full max-w-md md:max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* モバイル: シリーズ追加 FAB */}
      <Link
        to="/add"
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl text-white shadow-lg md:hidden"
        aria-label="シリーズを追加"
      >
        +
      </Link>

      {/* モバイル: 下部ナビ */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white md:hidden">
        <ul className="mx-auto flex max-w-md">
          {MOBILE_NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center py-2 text-xs ${
                    isActive ? "text-brand" : "text-slate-400"
                  }`
                }
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
          isActive
            ? "bg-white/15 text-white"
            : "text-brand-light hover:bg-white/5"
        }`
      }
    >
      <span className="text-lg">{icon}</span>
      {label}
    </NavLink>
  );
}
