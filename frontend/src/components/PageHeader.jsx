import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

/**
 * 各画面共通のヘッダー。
 * サブ見出し（小・text-ink-muted）＋大見出し（extrabold・text-ink）を縦に置き、
 * 右側に丸ボタンやピルなどのアクション（actions）を並べる。
 */
export default function PageHeader({ eyebrow, title, actions, leading }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {eyebrow != null && (
            <div className="text-sm font-semibold text-ink-muted">{eyebrow}</div>
          )}
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">
            {title}
          </h1>
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}

/**
 * 丸ボタン（44px・白地・やわらかい影）。中にブランド色（既定）または
 * インク色のラインアイコンを置く。to があれば Link、無ければ button。
 * badge > 0 のとき右上にブランドの件数バッジを出す。
 */
export function RoundButton({
  to,
  onClick,
  icon,
  label,
  badge = 0,
  variant = "brand",
  strokeWidth,
  type = "button",
}) {
  const cls =
    "relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card";
  const iconColor = variant === "ink" ? "text-ink" : "text-brand";
  const inner = (
    <>
      <Icon
        name={icon}
        className={`h-5 w-5 ${iconColor}`}
        strokeWidth={strokeWidth}
      />
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} aria-label={label} className={cls}>
      {inner}
    </button>
  );
}
