import { afterEach, describe, expect, it, vi } from "vitest";
import { resilientFetch } from "./client";

const URL_UNDER_TEST = "https://example.supabase.co/rest/v1/niches";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resilientFetch", () => {
  it("retries a failed GET once on a fresh connection", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("socket hang up"), { name: "ECONNRESET" }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mock);

    const res = await resilientFetch(URL_UNDER_TEST, { method: "GET" });
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("defaults to GET semantics when no method is given", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("dead socket"))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mock);

    const res = await resilientFetch(URL_UNDER_TEST);
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("never retries a write — a timed-out POST may have reached the server", async () => {
    const mock = vi.fn().mockRejectedValueOnce(new Error("dead socket"));
    vi.stubGlobal("fetch", mock);

    await expect(resilientFetch(URL_UNDER_TEST, { method: "POST" })).rejects.toThrow("dead socket");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("throws the last error when all read attempts fail", async () => {
    const mock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", mock);

    await expect(resilientFetch(URL_UNDER_TEST, { method: "GET" })).rejects.toThrow("network down");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("passes an abort signal through to fetch", async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mock);

    await resilientFetch(URL_UNDER_TEST, { method: "GET" });
    const init = mock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
