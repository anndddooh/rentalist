import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { checkInvite, signup } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/errors.js";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { login } = useAuth();

  const [tokenState, setTokenState] = useState("checking"); // checking|valid|invalid
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    checkInvite(token)
      .then((res) => setTokenState(res.valid ? "valid" : "invalid"))
      .catch(() => setTokenState("invalid"));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(token, username, password);
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err, "サインアップに失敗しました。"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-center text-2xl font-bold text-brand">Rentalist</h1>

        {tokenState === "checking" && (
          <p className="text-center text-sm text-slate-500">
            招待リンクを確認中…
          </p>
        )}

        {tokenState === "invalid" && (
          <div className="space-y-3 text-center">
            <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-600">
              この招待リンクは無効、または期限切れです。
            </p>
            <Link to="/login" className="text-sm text-brand underline">
              ログイン画面へ
            </Link>
          </div>
        )}

        {tokenState === "valid" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-center text-sm text-slate-500">
              招待リンクからアカウントを作成
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
              placeholder="パスワード（8文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-brand py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "作成中…" : "アカウント作成"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
