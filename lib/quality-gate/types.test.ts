import { describe, expect, it } from "vitest";
import {
  HARD_FAIL_RULES,
  PASS_THRESHOLD,
  computeScore,
  type QualityDimensions,
} from "./types";

const dims = (overrides: Partial<QualityDimensions> = {}): QualityDimensions => ({
  originality: 8,
  genuine_value: 8,
  policy_compliance: 9,
  ai_producibility: 9,
  copyright_risk: 1,
  duplicate_similarity: 1,
  reasoning: "",
  recommendations: [],
  ...overrides,
});

describe("computeScore", () => {
  it("scores a perfect topic at 100", () => {
    const perfect = dims({
      originality: 10,
      genuine_value: 10,
      policy_compliance: 10,
      ai_producibility: 10,
      copyright_risk: 0,
      duplicate_similarity: 0,
    });
    expect(computeScore(perfect)).toBe(100);
  });

  it("scores a worthless topic at 0", () => {
    const worst = dims({
      originality: 0,
      genuine_value: 0,
      policy_compliance: 0,
      ai_producibility: 0,
      copyright_risk: 10,
      duplicate_similarity: 10,
    });
    expect(computeScore(worst)).toBe(0);
  });

  it("weights dimensions per the documented formula", () => {
    // 8*.25 + 8*.25 + 9*.2 + 9*.15 + (10-1)*.1 + (10-1)*.05 = 8.5 → 85
    expect(computeScore(dims())).toBe(85);
  });

  it("inverts copyright risk (higher risk lowers the score)", () => {
    const low = computeScore(dims({ copyright_risk: 0 }));
    const high = computeScore(dims({ copyright_risk: 10 }));
    expect(low).toBeGreaterThan(high);
  });

  it("keeps a typical good topic above the pass threshold", () => {
    expect(computeScore(dims())).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});

describe("HARD_FAIL_RULES", () => {
  const ruleByFlag = Object.fromEntries(HARD_FAIL_RULES.map((r) => [r.flag, r]));

  it("fails policy compliance below 4", () => {
    expect(ruleByFlag.policy_violation.test(dims({ policy_compliance: 3 }))).toBe(true);
    expect(ruleByFlag.policy_violation.test(dims({ policy_compliance: 4 }))).toBe(false);
  });

  it("fails copyright risk above 7", () => {
    expect(ruleByFlag.copyright_risk_high.test(dims({ copyright_risk: 8 }))).toBe(true);
    expect(ruleByFlag.copyright_risk_high.test(dims({ copyright_risk: 7 }))).toBe(false);
  });

  it("fails topics that need real footage", () => {
    expect(ruleByFlag.not_ai_producible.test(dims({ ai_producibility: 2 }))).toBe(true);
    expect(ruleByFlag.not_ai_producible.test(dims({ ai_producibility: 3 }))).toBe(false);
  });

  it("fails near-duplicate topics", () => {
    expect(ruleByFlag.duplicate_topic.test(dims({ duplicate_similarity: 9 }))).toBe(true);
    expect(ruleByFlag.duplicate_topic.test(dims({ duplicate_similarity: 8 }))).toBe(false);
  });

  it("passes a clean topic through every rule", () => {
    for (const rule of HARD_FAIL_RULES) {
      expect(rule.test(dims())).toBe(false);
    }
  });
});
