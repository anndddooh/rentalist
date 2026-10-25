import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

const DURATION = { success: 2500, error: 4000 };

/**
 * 画面上部に一時表示する通知（mobile の react-native-toast-message 相当）。
 * 保存・追加・削除などの結果を、操作した場所に関係なく必ず目に入る位置で伝える。
 * 同時に出すのは 1 件だけで、新しい通知が来たら差し替える。
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((type, message) => {
    clearTimeout(timerRef.current);
    setToast({ type, message, key: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), DURATION[type]);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const success = useCallback((message) => show("success", message), [show]);
  const error = useCallback((message) => show("error", message), [show]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]"
      >
        {toast && (
          <div
            key={toast.key}
            role={toast.type === "error" ? "alert" : "status"}
            onClick={() => setToast(null)}
            className={`toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border-l-4 bg-card px-4 py-3 text-sm font-bold text-ink shadow-[0_8px_24px_rgba(30,27,46,0.18)] ${
              toast.type === "error" ? "border-rose-500" : "border-emerald-500"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${
                toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"
              }`}
            >
              {toast.type === "error" ? "!" : "✓"}
            </span>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
