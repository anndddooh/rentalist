import { describe, expect, it } from "@jest/globals";
import { hiRes } from "@/lib/coverUrl";

describe("hiRes", () => {
  it("楽天サムネイルの _ex を 400x400 に書き換える", () => {
    expect(
      hiRes("https://thumbnail.image.rakuten.co.jp/x.jpg?_ex=200x200")
    ).toBe("https://thumbnail.image.rakuten.co.jp/x.jpg?_ex=400x400");
  });

  it("_ex が無い URL はそのまま", () => {
    expect(hiRes("https://example.com/cover.jpg")).toBe(
      "https://example.com/cover.jpg"
    );
  });

  it("null/undefined は null を返す", () => {
    expect(hiRes(null)).toBeNull();
    expect(hiRes(undefined)).toBeNull();
  });
});
