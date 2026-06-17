import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, pickTopTopic } from "./stages";

describe("pickTopTopic", () => {
  it("returns the highest-scoring topic", () => {
    const top = pickTopTopic([
      { topic: "low", score: 40 },
      { topic: "high", score: 88 },
      { topic: "mid", score: 70 },
    ]);
    expect(top?.topic).toBe("high");
  });

  it("returns null for empty or missing input", () => {
    expect(pickTopTopic([])).toBeNull();
    expect(pickTopTopic(undefined)).toBeNull();
  });

  it("treats a missing score as 0", () => {
    expect(pickTopTopic([{ topic: "a" }, { topic: "b", score: 1 }])?.topic).toBe("b");
  });
});

describe("PIPELINE_STAGES", () => {
  it("is the full ordered chain", () => {
    expect(PIPELINE_STAGES.map((s) => s.id)).toEqual([
      "scout",
      "ceo_check",
      "creative",
      "production",
      "render",
      "qa",
      "publisher",
    ]);
  });
});
