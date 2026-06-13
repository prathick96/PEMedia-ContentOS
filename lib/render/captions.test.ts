import { describe, expect, it } from "vitest";
import type { RenderScene } from "./types";
import { buildSrt, secondsToSrtTime } from "./captions";

describe("secondsToSrtTime", () => {
  it("formats HH:MM:SS,mmm", () => {
    expect(secondsToSrtTime(0)).toBe("00:00:00,000");
    expect(secondsToSrtTime(10)).toBe("00:00:10,000");
    expect(secondsToSrtTime(3661.5)).toBe("01:01:01,500");
  });
  it("clamps negatives to zero", () => {
    expect(secondsToSrtTime(-5)).toBe("00:00:00,000");
  });
});

describe("buildSrt", () => {
  const scenes: RenderScene[] = [
    { text: "first", words: 10 },
    { text: "second", words: 30 },
  ];

  it("emits one cue per scene", () => {
    const srt = buildSrt(scenes, 40);
    expect(srt).toContain("1\n");
    expect(srt).toContain("first");
    expect(srt).toContain("second");
    expect((srt.match(/-->/g) ?? []).length).toBe(2);
  });

  it("covers [0, total] with windows proportional to words", () => {
    const srt = buildSrt(scenes, 40);
    // 10/40 of 40s = first cue ends at 10s; last cue ends exactly at total.
    expect(srt).toContain("00:00:00,000 --> 00:00:10,000");
    expect(srt).toContain("00:00:40,000");
  });

  it("returns empty string for no scenes or non-positive duration", () => {
    expect(buildSrt([], 40)).toBe("");
    expect(buildSrt(scenes, 0)).toBe("");
  });

  it("gives zero-word scenes a non-zero slice (min weight 1)", () => {
    const srt = buildSrt([{ text: "a", words: 0 }, { text: "b", words: 0 }], 10);
    expect(srt).toContain("00:00:00,000 --> 00:00:05,000");
  });
});
