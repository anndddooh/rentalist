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

const NAV = [
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
    <div className="mx-auto flex h-full max-w-md flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
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

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <Link
        to="/add"
        className="fixed bottom-20 right-[calc(50%-13rem)] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl text-white shadow-lg"
        aria-label="シリーズを追加"
      >
        +
      </Link>

      <nav className="fixed bottom-0 w-full max-w-md border-t border-slate-200 bg-white">
        <ul className="flex">
          {NAV.map((item) => (
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
