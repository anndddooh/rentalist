/** axios エラーから表示用メッセージを抽出する（frontend/src/lib/errors.js の移植）。 */
export function errorMessage(
  error: unknown,
  fallback = "エラーが発生しました。"
): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  const first = Object.values(record)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  if (typeof first === "string") return first;
  return fallback;
}
