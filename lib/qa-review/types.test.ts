import { describe, expect, it } from "vitest";
import {
  AUTO_PUBLISH_THRESHOLD,
  HUMAN_REVIEW_THRESHOLD,
  type QADimensions,
  computeQAScore,
  decideQA,
  qaHardFails,
} from "./types";

/** A strong, fully-compliant package. */
const strong: QADimensions = {
  hook_strength: 9,
  retention_structure: 8,
  narration_humanness: 8,
  originality_value: 9,
  thumbnail_quality: 8,
  metadata_quality: 8,
  short_cut_quality: 8,
  compliance_disclosure: 10,
  copyright_safety: 10,
  reasoning: "",
  fixes: [],
};

describe("computeQAScore", () => {
  it("uses weights that sum to 1.0 (all-10s → 100)", () => {
    const allTen: QADimensions = { ...strong };
    (Object.keys(allTen) as (keyof QADimensions)[]).forEach((k) => {
      if (typeof allTen[k] === "number") (allTen[k] as number) = 10;
    });
    expect(computeQAScore(allTen)).toBe(100);
  });

  it("all-zeros → 0", () => {
    const allZero = { ...strong } as QADimensions;
    (Object.keys(allZero) as (keyof QADimensions)[]).forEach((k) => {
      if (typeof allZero[k] === "number") (allZero[k] as number) = 0;
    });
    expect(computeQAScore(allZero)).toBe(0);
  });

  it("weights originality more than thumbnail", () => {
    const origHigh = { ...strong, originality_value: 10, thumbnail_quality: 0 };
    const thumbHigh = { ...strong, originality_value: 0, thumbnail_quality: 10 };
    expect(computeQAScore(origHigh)).toBeGreaterThan(computeQAScore(thumbHigh));
  });
});

describe("qaHardFails", () => {
  it("trips when AI disclosure is compromised", () => {
    const fails = qaHardFails({ ...strong, compliance_disclosure: 2 });
    expect(fails.map((f) => f.flag)).toContain("disclosure_compromised");
  });

  it("trips on copyright exposure", () => {
    const fails = qaHardFails({ ...strong, copyright_safety: 2 });
    expect(fails.map((f) => f.flag)).toContain("copyright_risk");
  });

  it("a clean strong package trips nothing", () => {
    expect(qaHardFails(strong)).toHaveLength(0);
  });
});

describe("decideQA", () => {
  it("auto-publishes a high score with no hard fail", () => {
    expect(decideQA(AUTO_PUBLISH_THRESHOLD, false)).toBe("auto_publish");
    expect(decideQA(95, false)).toBe("auto_publish");
  });

  it("routes a mid score to human review", () => {
    expect(decideQA(HUMAN_REVIEW_THRESHOLD, false)).toBe("needs_human_review");
    expect(decideQA(70, false)).toBe("needs_human_review");
  });

  it("rejects below the human-review floor", () => {
    expect(decideQA(HUMAN_REVIEW_THRESHOLD - 0.1, false)).toBe("reject");
    expect(decideQA(10, false)).toBe("reject");
  });

  it("a hard fail forces reject even at a perfect score", () => {
    expect(decideQA(100, true)).toBe("reject");
  });
});

describe("end-to-end decision on a strong package", () => {
  it("a strong, compliant package auto-publishes", () => {
    const score = computeQAScore(strong);
    const decision = decideQA(score, qaHardFails(strong).length > 0);
    expect(score).toBeGreaterThanOrEqual(AUTO_PUBLISH_THRESHOLD);
    expect(decision).toBe("auto_publish");
  });

  it("a great package with hidden AI provenance is rejected, not published", () => {
    const evasive: QADimensions = { ...strong, compliance_disclosure: 1 };
    const score = computeQAScore(evasive);
    const decision = decideQA(score, qaHardFails(evasive).length > 0);
    expect(decision).toBe("reject");
  });
});
