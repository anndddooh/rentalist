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
    <div className="flex min-h-full flex-col items-center justify-center gap-7 bg-brand p-7">
      <div className="flex flex-col items-center gap-3.5">
        <Logo size={72} inverted />
        <div className="text-center">
          <div className="text-[32px] font-extrabold tracking-tight text-white">
            Rentalist
          </div>
          <div className="mt-1 text-sm text-brand-text">
            家族の漫画レンタルを、かしこく管理
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-3xl bg-card p-5 shadow-[0_20px_40px_rgba(30,10,80,0.3)]"
      >
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <input
          className="input"
          placeholder="ユーザー名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-3.5 font-extrabold text-white active:bg-brand-strong disabled:opacity-50"
        >
          {busy ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
