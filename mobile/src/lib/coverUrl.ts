/**
 * 楽天サムネイルは既定 200x200 で粗い。_ex パラメータを上げて高解像度版を取得する
 * （frontend/src/components/CoverImage.jsx の hiRes の移植）。
 */
export function hiRes(url: string | null | undefined): string | null {
  return url ? url.replace(/_ex=\d+x\d+/, "_ex=400x400") : null;
}
