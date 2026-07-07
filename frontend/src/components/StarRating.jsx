/**
 * お気に入り度の★表示。onChange を渡すとクリックで編集可能になる。
 */
export default function StarRating({ value = 0, onChange, size = "text-base" }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className={`inline-flex ${size}`}>
      {stars.map((n) => {
        const filled = n <= value;
        const star = (
          <span className={filled ? "text-amber-400" : "text-ink-faint"}>★</span>
        );
        if (!onChange) {
          return <span key={n}>{star}</span>;
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`お気に入り度 ${n}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
