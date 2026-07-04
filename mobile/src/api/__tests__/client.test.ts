/**
 * axios クライアントの 401 → refresh → リトライ挙動のテスト
 * （frontend/src/api/client.js から移植したロジックの検証）。
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import api, { setSessionExpiredHandler } from "@/api/client";
import * as tokens from "@/lib/tokens";

jest.mock("@/lib/env", () => ({
  APP_ENV: "development",
  API_BASE_URL: "http://test",
  API_BASE: "http://test/api",
}));

jest.mock("@/lib/tokens", () => {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    getAccessToken: () => access,
    setAccessToken: (t: string | null) => {
      access = t;
    },
    getRefreshToken: () => refresh,
    setRefreshToken: async (t: string) => {
      refresh = t;
    },
    clearTokens: jest.fn(async () => {
      access = null;
      refresh = null;
    }),
    loadRefreshToken: async () => refresh,
    hasSession: () => Boolean(refresh),
    // テスト用ヘルパ
    __set: (a: string | null, r: string | null) => {
      access = a;
      refresh = r;
    },
  };
});

const tokensMock = tokens as unknown as typeof tokens & {
  __set: (a: string | null, r: string | null) => void;
};

const REFRESH_URL = "http://test/api/auth/token/refresh/";

describe("api client の refresh フロー", () => {
  let apiMock: MockAdapter;
  let axiosMock: MockAdapter;

  beforeEach(() => {
    apiMock = new MockAdapter(api);
    axiosMock = new MockAdapter(axios);
    tokensMock.__set("old-access", "refresh-token");
    jest.mocked(tokens.clearTokens).mockClear();
  });

  afterEach(() => {
    apiMock.restore();
    axiosMock.restore();
    setSessionExpiredHandler(null);
  });

  it("401 のとき refresh して 1 回だけリトライする", async () => {
    apiMock
      .onGet("/series/")
      .replyOnce(401)
      .onGet("/series/")
      .replyOnce(200, { ok: true });
    axiosMock.onPost(REFRESH_URL).reply(200, { access: "new-access" });

    const { data } = await api.get("/series/");

    expect(data).toEqual({ ok: true });
    expect(tokens.getAccessToken()).toBe("new-access");
    expect(axiosMock.history.post).toHaveLength(1);
  });

  it("並行 401 では refresh を単一飛行にする", async () => {
    apiMock.onGet("/a/").replyOnce(401).onGet("/a/").replyOnce(200, { r: "a" });
    apiMock.onGet("/b/").replyOnce(401).onGet("/b/").replyOnce(200, { r: "b" });
    axiosMock.onPost(REFRESH_URL).reply(200, { access: "new-access" });

    const [a, b] = await Promise.all([api.get("/a/"), api.get("/b/")]);

    expect(a.data).toEqual({ r: "a" });
    expect(b.data).toEqual({ r: "b" });
    expect(axiosMock.history.post).toHaveLength(1);
  });

  it("refresh 失敗でトークンを消しセッション失効ハンドラを呼ぶ", async () => {
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    apiMock.onGet("/series/").reply(401);
    axiosMock.onPost(REFRESH_URL).reply(401);

    await expect(api.get("/series/")).rejects.toBeTruthy();

    expect(tokens.clearTokens).toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalled();
    expect(tokens.hasSession()).toBe(false);
  });

  it("refresh トークンが無ければリトライせずそのまま失敗する", async () => {
    tokensMock.__set(null, null);
    apiMock.onGet("/series/").reply(401);

    await expect(api.get("/series/")).rejects.toBeTruthy();
    expect(axiosMock.history.post).toHaveLength(0);
  });
});
