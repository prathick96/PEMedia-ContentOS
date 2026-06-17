import { describe, expect, it } from "vitest";
import { isTransientStreamError, parseJsonResponse } from "./anthropic";

describe("parseJsonResponse", () => {
  it("parses clean JSON objects", () => {
    expect(parseJsonResponse('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses clean JSON arrays", () => {
    expect(parseJsonResponse("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("strips markdown json fences", () => {
    const raw = '```json\n{"topic": "AI"}\n```';
    expect(parseJsonResponse(raw)).toEqual({ topic: "AI" });
  });

  it("strips bare fences", () => {
    const raw = '```\n[{"x": true}]\n```';
    expect(parseJsonResponse(raw)).toEqual([{ x: true }]);
  });

  it("recovers JSON wrapped in prose", () => {
    const raw = 'Here is the result:\n{"score": 85, "passed": true}\nLet me know!';
    expect(parseJsonResponse(raw)).toEqual({ score: 85, passed: true });
  });

  it("recovers arrays wrapped in prose", () => {
    const raw = "The topics are: [{\"topic\": \"a\"}] — enjoy.";
    expect(parseJsonResponse(raw)).toEqual([{ topic: "a" }]);
  });

  it("throws when no JSON exists", () => {
    expect(() => parseJsonResponse("no json here at all")).toThrow(/No JSON found/);
  });
});

describe("isTransientStreamError", () => {
  it("treats a mid-stream disconnect (undici 'terminated') as transient", () => {
    expect(isTransientStreamError(new TypeError("terminated"))).toBe(true);
  });

  it("treats socket/DNS resets as transient", () => {
    expect(isTransientStreamError(new Error("read ECONNRESET"))).toBe(true);
    expect(isTransientStreamError({ code: "ENOTFOUND", message: "getaddrinfo" })).toBe(true);
    expect(isTransientStreamError(new Error("fetch failed"))).toBe(true);
    expect(isTransientStreamError({ message: "Connection error." })).toBe(true);
  });

  it("treats 408/429/5xx statuses as transient", () => {
    expect(isTransientStreamError({ status: 408 })).toBe(true);
    expect(isTransientStreamError({ status: 429 })).toBe(true);
    expect(isTransientStreamError({ status: 503 })).toBe(true);
  });

  it("does NOT retry deterministic faults", () => {
    expect(
      isTransientStreamError(new Error("Claude response truncated at the max_tokens limit (32000)"))
    ).toBe(false);
    expect(isTransientStreamError(new Error("Unexpected response type from Claude"))).toBe(false);
    expect(isTransientStreamError({ status: 400, message: "invalid_request_error" })).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isTransientStreamError(null)).toBe(false);
    expect(isTransientStreamError(undefined)).toBe(false);
  });
});
