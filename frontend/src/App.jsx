import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AddSeries from "./pages/AddSeries.jsx";
import Cart from "./pages/Cart.jsx";
import Completed from "./pages/Completed.jsx";
import History from "./pages/History.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import SeriesDetail from "./pages/SeriesDetail.jsx";
import Settings from "./pages/Settings.jsx";
import Signup from "./pages/Signup.jsx";
import Wishlist from "./pages/Wishlist.jsx";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/history" element={<History />} />
        <Route path="/completed" element={<Completed />} />
        <Route path="/add" element={<AddSeries />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
