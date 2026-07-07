import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { checkInvite, signup } from "../api/auth.js";
import Logo from "../components/Logo.jsx";
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

      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card p-5 shadow-[0_20px_40px_rgba(30,10,80,0.3)]">
        {tokenState === "checking" && (
          <p className="text-center text-sm text-ink-muted">
            招待リンクを確認中…
          </p>
        )}

        {tokenState === "invalid" && (
          <div className="space-y-3 text-center">
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              この招待リンクは無効、または期限切れです。
            </p>
            <Link to="/login" className="text-sm font-bold text-brand">
              ログイン画面へ
            </Link>
          </div>
        )}

        {tokenState === "valid" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-center text-sm text-ink-muted">
              招待リンクからアカウントを作成
            </p>
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
              placeholder="パスワード（8文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-brand py-3.5 font-extrabold text-white active:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "作成中…" : "アカウント作成"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
