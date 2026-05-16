import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";

// モバイル下部ナビ（5タブ・幅が狭いため一部は短縮表記）
const MOBILE_NAV = [
  { to: "/", label: "ホーム", icon: "home", end: true },
  { to: "/wishlist", label: "読みたい", icon: "bookmark" },
  { to: "/history", label: "履歴", icon: "history" },
  { to: "/completed", label: "読破", icon: "trophy" },
  { to: "/settings", label: "設定", icon: "settings" },
];

// デスクトップ左サイドバー
const SIDEBAR_NAV = [
  { to: "/", label: "ホーム", icon: "home", end: true },
  { to: "/wishlist", label: "いつか読みたい", icon: "bookmark" },
  { to: "/history", label: "履歴", icon: "history" },
  { to: "/completed", label: "読破", icon: "trophy" },
  { to: "/add", label: "シリーズ追加", icon: "plus" },
  { to: "/settings", label: "設定", icon: "settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { cartCount, refreshCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // 画面遷移ごとに念のため再取得（他端末での変更などの取りこぼし対策）
  useEffect(() => {
    refreshCart();
  }, [location.pathname, refreshCart]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full">
      {/* デスクトップ: 左サイドバー */}
      <aside className="hidden w-56 shrink-0 flex-col bg-brand-dark text-white md:flex">
        <Link to="/" className="px-5 py-4">
          <Logo size={30} withText textClassName="text-xl text-white" />
        </Link>
        <nav className="flex-1 space-y-1 px-2">
          {SIDEBAR_NAV.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          <SidebarLink
            to="/cart"
            icon="cart"
            label={`カート${cartCount > 0 ? `（${cartCount}）` : ""}`}
          />
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
        <header className="flex items-center justify-between bg-brand px-4 py-2.5 text-white md:hidden">
          <Link to="/">
            <Logo size={26} withText textClassName="text-lg text-white" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative" aria-label="カート">
              <Icon name="cart" className="h-6 w-6" />
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
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg md:hidden"
        aria-label="シリーズを追加"
      >
        <Icon name="plus" className="h-7 w-7" strokeWidth={2.4} />
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
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${
                    isActive ? "text-brand" : "text-slate-400"
                  }`
                }
              >
                <Icon name={item.icon} className="h-6 w-6" />
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
      <Icon name={icon} className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
