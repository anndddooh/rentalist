import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/errors.js";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err, "ユーザー名またはパスワードが違います。"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
      >
        <div className="flex justify-center">
          <Logo size={48} withText textClassName="text-2xl text-brand" />
        </div>
        <p className="text-center text-sm text-slate-500">
          漫画レンタル管理にログイン
        </p>
        {error && (
          <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="ユーザー名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-brand py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
