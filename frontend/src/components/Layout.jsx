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

// モバイル下部ナビ（5タブ）
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
    <div className="flex h-full bg-surface">
      {/* デスクトップ: 白サイドバー */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card md:flex">
        <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={32} withText textClassName="text-xl font-extrabold text-ink" />
        </Link>
        <nav className="flex-1 space-y-0.5 px-3">
          {SIDEBAR_NAV.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {/* カートサマリー（濃色カード） */}
        <Link
          to="/cart"
          className="m-3 block rounded-[18px] bg-ink p-4 text-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/60">カート</span>
            <span className="min-w-[20px] rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-extrabold text-white">
              {cartCount}
            </span>
          </div>
          <div className="mt-1.5 text-[13px] text-white/80">
            {cartCount > 0 ? `${cartCount}冊が入っています` : "カートは空です"}
          </div>
          <span className="mt-2.5 block rounded-full bg-white py-2 text-center text-[13px] font-extrabold text-ink">
            会計した →
          </span>
        </Link>

        {/* ユーザー行 */}
        <div className="flex items-center gap-2.5 px-5 pb-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand-text">
            {user?.username?.[0] || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-ink">
              {user?.username}
            </div>
            <button
              onClick={handleLogout}
              className="text-[11px] text-ink-faint hover:text-brand"
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      {/* メインカラム */}
      <div className="flex h-full flex-1 flex-col">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-md md:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>

      {/* モバイル: 下部ナビ */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-line bg-card/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md px-1 py-1.5">
          {MOBILE_NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink to={item.to} end={item.end}>
                {({ isActive }) => (
                  <div className="flex flex-col items-center gap-1 py-1">
                    <span
                      className={`flex rounded-full px-4 py-1 ${
                        isActive ? "bg-brand-soft text-brand" : "text-ink-faint"
                      }`}
                    >
                      <Icon name={item.icon} className="h-6 w-6" />
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        isActive ? "text-brand" : "text-ink-faint"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                )}
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
        `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold ${
          isActive
            ? "bg-brand-soft text-brand"
            : "text-ink-muted hover:bg-inset"
        }`
      }
    >
      <Icon name={icon} className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
