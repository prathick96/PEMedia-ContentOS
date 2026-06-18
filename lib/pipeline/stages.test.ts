import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, pickTopTopic, reduceStageViews, type PipelineEvent } from "./stages";

const ev = (
  stage: PipelineEvent["stage"],
  status: PipelineEvent["status"],
  detail?: string
): PipelineEvent => ({ stage, status, detail, at: "2026-01-01T00:00:00.000Z" });

describe("reduceStageViews", () => {
  it("defaults every stage to pending for an empty/undefined log", () => {
    const views = reduceStageViews(undefined);
    expect(PIPELINE_STAGES.every((s) => views[s.id].status === "pending")).toBe(true);
    expect(reduceStageViews([]).scout.status).toBe("pending");
  });

  it("lands each stage on its latest event (running → done)", () => {
    const views = reduceStageViews([
      ev("scout", "running"),
      ev("scout", "done", "Top topic: X"),
      ev("ceo_check", "running"),
    ]);
    expect(views.scout).toEqual({ status: "done", detail: "Top topic: X" });
    expect(views.ceo_check.status).toBe("running");
    expect(views.production.status).toBe("pending");
  });

  it("ignores events for unknown stages", () => {
    const views = reduceStageViews([
      { stage: "bogus" as PipelineEvent["stage"], status: "done" },
    ]);
    expect(PIPELINE_STAGES.every((s) => views[s.id].status === "pending")).toBe(true);
  });
});

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
