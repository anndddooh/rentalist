/** axios エラーから表示用メッセージを抽出する。 */
export function errorMessage(error, fallback = "エラーが発生しました。") {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return first[0];
  if (typeof first === "string") return first;
  return fallback;
}
