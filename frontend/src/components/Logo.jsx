/**
 * Rentalist のロゴ。開いた本＋しおりのマーク。
 * withText=true でワードマーク「Rentalist」を併記する。
 */
export default function Logo({ size = 32, withText = false, textClassName = "" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Rentalist"
      >
        <rect width="48" height="48" rx="12" fill="#5b21b6" />
        <path
          d="M24 17c-3.3-2.4-7.6-3.2-11.7-2.5a1 1 0 0 0-.8 1v15.9a1 1 0 0 0 1.2 1c3.6-.6 7.2.1 10 2.2a1.1 1.1 0 0 0 1.3 0c2.8-2.1 6.4-2.8 10-2.2a1 1 0 0 0 1.2-1V15.5a1 1 0 0 0-.8-1c-4.1-.7-8.4.1-11.7 2.5z"
          fill="#ffffff"
        />
        <path
          d="M24 17v17.6"
          stroke="#5b21b6"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M20.8 10.5h6.4v9.6L24 17.7l-3.2 2.4z" fill="#f59e0b" />
      </svg>
      {withText && (
        <span className={`font-bold tracking-wide ${textClassName}`}>
          Rentalist
        </span>
      )}
    </span>
  );
}
