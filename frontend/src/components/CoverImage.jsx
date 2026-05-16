import { useState } from "react";

// 楽天サムネイルは既定 200x200 で粗い。_ex パラメータを上げて高解像度版を取得する
function hiRes(url) {
  return url ? url.replace(/_ex=\d+x\d+/, "_ex=400x400") : url;
}

/**
 * 表紙画像。URL が無い・読み込み失敗時はプレースホルダを表示する。
 */
export default function CoverImage({ url, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !url || failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200 ${className}`}
    >
      {showPlaceholder ? (
        <span className="px-1 text-center text-[10px] leading-tight text-slate-400">
          表紙なし
        </span>
      ) : (
        <img
          src={hiRes(url)}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
