import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refineTopicUntilPass, summariseAttempts, type RefineInput } from "./refine";
import type { QualityVerdict } from "./types";

/** Build a fake gate verdict with a given score / pass flag. */
function verdict(score: number, passed: boolean): QualityVerdict {
  return {
    passed,
    score,
    dimensions: {
      originality: passed ? 8 : 4,
      genuine_value: passed ? 8 : 4,
      policy_compliance: 8,
      ai_producibility: 9,
      copyright_risk: 1,
      duplicate_similarity: 1,
      reasoning: "fake reasoning",
      recommendations: ["sharpen the angle"],
    },
    reasons: passed ? ["Passed"] : ["Low originality"],
    flags: passed ? [] : ["score_below_threshold"],
  };
}

/** Minimal RefineInput — db is never touched when scoreFn/reframeFn are injected. */
function baseInput(overrides: Partial<RefineInput> = {}): RefineInput {
  return {
    topic: "original topic",
    niche: "history",
    series_context: "Last Days / collapse",
    db: {} as unknown as SupabaseClient,
    ...overrides,
  };
}

describe("refineTopicUntilPass", () => {
  it("returns immediately when the first topic passes — never reframes", async () => {
    const scoreFn = vi.fn(async () => verdict(72, true));
    const reframeFn = vi.fn(async () => "should not be called");

    const result = await refineTopicUntilPass(baseInput(), { scoreFn, reframeFn });

    expect(result.passed).toBe(true);
    expect(result.topic).toBe("original topic");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].reframed).toBe(false);
    expect(scoreFn).toHaveBeenCalledTimes(1);
    expect(reframeFn).not.toHaveBeenCalled();
  });

  it("reframes once, then passes — returns the reframed topic", async () => {
    const scoreFn = vi
      .fn()
      .mockResolvedValueOnce(verdict(51.5, false))
      .mockResolvedValueOnce(verdict(68, true));
    const reframeFn = vi.fn(async () => "sharper reframed topic");

    const result = await refineTopicUntilPass(baseInput(), { scoreFn, reframeFn });

    expect(result.passed).toBe(true);
    expect(result.topic).toBe("sharper reframed topic");
    expect(result.originalTopic).toBe("original topic");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[1].reframed).toBe(true);
    expect(scoreFn).toHaveBeenCalledTimes(2);
    expect(reframeFn).toHaveBeenCalledTimes(1);
  });

  it("never passes — exhausts maxAttempts and returns the best-scoring attempt", async () => {
    const scoreFn = vi
      .fn()
      .mockResolvedValueOnce(verdict(40, false))
      .mockResolvedValueOnce(verdict(58, false)) // best
      .mockResolvedValueOnce(verdict(55, false));
    let n = 0;
    const reframeFn = vi.fn(async () => `reframe ${++n}`);

    const result = await refineTopicUntilPass(baseInput({ maxAttempts: 3 }), {
      scoreFn,
      reframeFn,
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(result.verdict.score).toBe(58);
    expect(result.topic).toBe("reframe 1"); // the 2nd attempt's topic (best score)
    expect(scoreFn).toHaveBeenCalledTimes(3);
    expect(reframeFn).toHaveBeenCalledTimes(2); // no reframe after the final score
  });

  it("stops early and returns best-so-far when the reframer throws", async () => {
    const scoreFn = vi
      .fn()
      .mockResolvedValueOnce(verdict(45, false))
      .mockResolvedValueOnce(verdict(99, true)); // would pass — but never reached
    const reframeFn = vi.fn(async () => {
      throw new Error("LLM unavailable");
    });

    const result = await refineTopicUntilPass(baseInput({ maxAttempts: 3 }), {
      scoreFn,
      reframeFn,
    });

    expect(result.passed).toBe(false);
    expect(result.topic).toBe("original topic");
    expect(result.attempts).toHaveLength(1);
    expect(scoreFn).toHaveBeenCalledTimes(1);
  });

  it("stops early when the reframer restates the same topic", async () => {
    const scoreFn = vi.fn(async () => verdict(50, false));
    const reframeFn = vi.fn(async () => "ORIGINAL TOPIC"); // same, different case

    const result = await refineTopicUntilPass(baseInput({ maxAttempts: 4 }), {
      scoreFn,
      reframeFn,
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(reframeFn).toHaveBeenCalledTimes(1);
  });

  it("respects maxAttempts = 1 — scores once, never reframes", async () => {
    const scoreFn = vi.fn(async () => verdict(50, false));
    const reframeFn = vi.fn(async () => "unused");

    const result = await refineTopicUntilPass(baseInput({ maxAttempts: 1 }), {
      scoreFn,
      reframeFn,
    });

    expect(result.attempts).toHaveLength(1);
    expect(reframeFn).not.toHaveBeenCalled();
  });

  it("fires onAttempt once per scored attempt", async () => {
    const scoreFn = vi
      .fn()
      .mockResolvedValueOnce(verdict(40, false))
      .mockResolvedValueOnce(verdict(70, true));
    const reframeFn = vi.fn(async () => "reframed");
    const seen: number[] = [];

    await refineTopicUntilPass(
      baseInput({ onAttempt: (a) => seen.push(a.attempt) }),
      { scoreFn, reframeFn }
    );

    expect(seen).toEqual([1, 2]);
  });
});

describe("summariseAttempts", () => {
  it("renders a readable score trail", async () => {
    const scoreFn = vi
      .fn()
      .mockResolvedValueOnce(verdict(51.5, false))
      .mockResolvedValueOnce(verdict(68, true));
    const reframeFn = vi.fn(async () => "reframed topic");

    const result = await refineTopicUntilPass(baseInput(), { scoreFn, reframeFn });

    expect(summariseAttempts(result.attempts)).toBe(
      '"original topic" 51.5/100  →  "reframed topic" 68/100'
    );
  });
});
