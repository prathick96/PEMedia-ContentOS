import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "./anthropic";

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
