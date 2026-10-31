import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Series } from "@/api/types";

const mockSet = jest.fn<(seriesId: number, shopId: number, status: string) => Promise<unknown>>();
const mockToast = jest.fn();

jest.mock("@/lib/queryClient", () => {
  // jest.mock は import より先に評価されるため、ここで生成する
  const { QueryClient: QC } = jest.requireActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return { queryClient: new QC({ defaultOptions: { queries: { retry: false } } }) };
});
jest.mock("@/api/series", () => ({
  setAvailability: (...args: [number, number, string]) => mockSet(...args),
}));
jest.mock("react-native-toast-message", () => ({ show: (...a: unknown[]) => mockToast(...a) }));

// eslint-disable-next-line import/first
import { changeAvailability } from "@/lib/availabilitySync";
// eslint-disable-next-line import/first
import { queryClient as mockClient } from "@/lib/queryClient";

const base = { id: 1, availability_map: {}, availability_status: "unknown" } as unknown as Series;
const flush = () => new Promise((r) => setTimeout(r, 0));

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = () => res({});
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("changeAvailability", () => {
  afterAll(() => mockClient.clear());

  beforeEach(() => {
    mockClient.clear();
    mockSet.mockReset();
    mockToast.mockReset();
    mockClient.setQueryData(["series", "active", { shop: 5 }], [base]);
    mockClient.setQueryData(["series", "detail", 1], base);
    mockClient.setQueryData(["series", "wishlist"], [{ ...base, id: 2 }]);
  });

  it("押した瞬間に一覧・詳細の両方のキャッシュを書き換える", async () => {
    const req = deferred();
    mockSet.mockReturnValue(req.promise);
    changeAvailability(1, 5, "unknown", "available");
    const list = mockClient.getQueryData<Series[]>(["series", "active", { shop: 5 }])!;
    const detail = mockClient.getQueryData<Series>(["series", "detail", 1])!;
    expect(list[0].availability_status).toBe("available");
    expect(list[0].availability_map).toEqual({ 5: "available" });
    expect(detail.availability_map).toEqual({ 5: "available" });
    expect(detail.availability_status).toBe("unknown"); // ショップ指定のない取得は変えない
    expect(mockClient.getQueryData<Series[]>(["series", "wishlist"])![0].availability_map).toEqual({});
    req.resolve();
    await flush();
  });

  it("通信中の連打は並行送信せず、最後の状態だけ後から送る", async () => {
    const first = deferred();
    mockSet.mockReturnValueOnce(first.promise).mockResolvedValue({});
    changeAvailability(1, 5, "unknown", "available");
    changeAvailability(1, 5, "available", "unavailable");
    changeAvailability(1, 5, "unavailable", "unknown");
    changeAvailability(1, 5, "unknown", "available");
    changeAvailability(1, 5, "available", "unavailable");
    expect(mockSet).toHaveBeenCalledTimes(1);
    first.resolve();
    await flush();
    expect(mockSet.mock.calls.map((c) => c[2])).toEqual(["available", "unavailable"]);
    const detail = mockClient.getQueryData<Series>(["series", "detail", 1])!;
    expect(detail.availability_map).toEqual({ 5: "unavailable" });
  });

  it("一周して元に戻った分は送らない", async () => {
    const first = deferred();
    mockSet.mockReturnValueOnce(first.promise).mockResolvedValue({});
    changeAvailability(1, 5, "unknown", "available");
    changeAvailability(1, 5, "available", "unavailable");
    changeAvailability(1, 5, "unavailable", "unknown");
    changeAvailability(1, 5, "unknown", "available");
    first.resolve();
    await flush();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("失敗したら確定済みの状態に戻してトーストを出す", async () => {
    mockSet.mockRejectedValue(new Error("network"));
    changeAvailability(1, 5, "unknown", "available");
    await flush();
    const list = mockClient.getQueryData<Series[]>(["series", "active", { shop: 5 }])!;
    expect(list[0].availability_status).toBe("unknown");
    expect(list[0].availability_map).toEqual({});
    expect(mockToast).toHaveBeenCalled();
  });
});
