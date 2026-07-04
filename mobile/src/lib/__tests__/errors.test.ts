import { describe, expect, it } from "@jest/globals";
import { errorMessage } from "@/lib/errors";

describe("errorMessage", () => {
  it("レスポンスが無ければフォールバックを返す", () => {
    expect(errorMessage(new Error("network"))).toBe("エラーが発生しました。");
    expect(errorMessage(undefined, "だめ")).toBe("だめ");
  });

  it("detail 文字列を優先する", () => {
    const err = { response: { data: { detail: "カートが空です。" } } };
    expect(errorMessage(err)).toBe("カートが空です。");
  });

  it("フィールドエラー（配列）の先頭を返す", () => {
    const err = {
      response: {
        data: { volume_number: ["3巻は既に履歴に登録されています。"] },
      },
    };
    expect(errorMessage(err)).toBe("3巻は既に履歴に登録されています。");
  });

  it("文字列データはそのまま返す", () => {
    const err = { response: { data: "Server Error" } };
    expect(errorMessage(err)).toBe("Server Error");
  });
});
