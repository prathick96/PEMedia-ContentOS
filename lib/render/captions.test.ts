import { describe, expect, it } from "vitest";
import type { VoiceAlignment } from "@/lib/elevenlabs";
import type { RenderScene } from "./types";
import { buildSrt, mergeTimedChunks, parseAlignment, secondsToSrtTime, wordsToSrt } from "./captions";

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

describe("parseAlignment", () => {
  // "hi yo" → h(0-0.2) i(0.2-0.4) space(0.4-0.5) y(0.5-0.7) o(0.7-0.9)
  const alignment: VoiceAlignment = {
    characters: ["h", "i", " ", "y", "o"],
    character_start_times_seconds: [0, 0.2, 0.4, 0.5, 0.7],
    character_end_times_seconds: [0.2, 0.4, 0.5, 0.7, 0.9],
  };

  it("collapses characters into per-word timings", () => {
    expect(parseAlignment(alignment)).toEqual([
      { text: "hi", start: 0, end: 0.4 },
      { text: "yo", start: 0.5, end: 0.9 },
    ]);
  });

  it("returns [] for missing/empty alignment", () => {
    expect(parseAlignment(null)).toEqual([]);
    expect(parseAlignment({ characters: [], character_start_times_seconds: [], character_end_times_seconds: [] })).toEqual([]);
  });
});

describe("mergeTimedChunks", () => {
  it("offsets each chunk's words by the preceding chunks' durations", () => {
    const merged = mergeTimedChunks([
      { words: [{ text: "a", start: 0, end: 0.5 }, { text: "b", start: 0.5, end: 1 }], duration: 1.2 },
      { words: [{ text: "c", start: 0, end: 0.4 }], duration: 0.6 },
      { words: [{ text: "d", start: 0.1, end: 0.5 }], duration: 0.5 },
    ]);
    expect(merged).toEqual([
      { text: "a", start: 0, end: 0.5 },
      { text: "b", start: 0.5, end: 1 },
      { text: "c", start: 1.2, end: 1.6 }, // offset by chunk 0's duration (1.2)
      { text: "d", start: 1.9, end: 2.3 }, // offset by 1.2 + 0.6
    ]);
  });

  it("is a no-op for a single chunk", () => {
    const words = [{ text: "x", start: 0, end: 0.3 }];
    expect(mergeTimedChunks([{ words, duration: 0.5 }])).toEqual(words);
  });

  it("returns [] for no chunks", () => {
    expect(mergeTimedChunks([])).toEqual([]);
  });
});

describe("wordsToSrt", () => {
  const words = [
    { text: "one", start: 0, end: 0.5 },
    { text: "two", start: 0.5, end: 1 },
    { text: "three", start: 1, end: 1.5 },
  ];

  it("chunks words into cues of at most maxWordsPerCue", () => {
    const srt = wordsToSrt(words, { maxWordsPerCue: 2 });
    expect((srt.match(/-->/g) ?? []).length).toBe(2); // [one two] [three]
    expect(srt).toContain("one two");
    expect(srt).toContain("three");
  });

  it("times each cue to its words' actual start/end", () => {
    const srt = wordsToSrt(words, { maxWordsPerCue: 3 });
    expect(srt).toContain("00:00:00,000 --> 00:00:01,500");
  });

  it("returns empty string for no words", () => {
    expect(wordsToSrt([])).toBe("");
  });
});
