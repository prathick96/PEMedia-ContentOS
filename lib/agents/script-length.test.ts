import { describe, expect, it } from "vitest";
import {
  checkScriptLength,
  lengthRevisionNote,
  LONGFORM_WORD_RANGE,
  SHORT_WORD_RANGE,
} from "./script-length";
import type { VideoScript } from "@/lib/db/schema";

/** Build a script whose narration has exactly `n` words, plus optional structure. */
function scriptWith(opts: {
  longWords: number;
  shortWords: number;
  hook?: boolean;
  cta?: boolean;
  shortHook?: boolean;
  shortCta?: boolean;
}): VideoScript {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  return {
    hook: opts.hook === false ? "" : "A sharp hook",
    sections: [],
    cta: opts.cta === false ? "" : "A strong ending",
    title_options: ["t"],
    description: "d",
    tags: [],
    chapters: [],
    tts_narration: words(opts.longWords),
    short_cut: {
      hook: opts.shortHook === false ? "" : "short hook",
      narration: words(opts.shortWords),
      captions: [],
      duration_target_secs: 35,
      visual_direction: "",
      broll_keywords: [],
      ai_image_prompts: [],
      cta: opts.shortCta === false ? "" : "short ending",
    },
  } as VideoScript;
}

describe("checkScriptLength", () => {
  it("passes when both narrations are in range and structured", () => {
    const r = checkScriptLength(scriptWith({ longWords: 1000, shortWords: 90 }));
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.longWords).toBe(1000);
    expect(r.shortWords).toBe(90);
  });

  it("flags an over-long long-form (the 13.8-min overshoot)", () => {
    const r = checkScriptLength(scriptWith({ longWords: 2200, shortWords: 90 }));
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/Long-form too LONG/);
  });

  it("flags an over-long short (the 74s overshoot)", () => {
    const r = checkScriptLength(scriptWith({ longWords: 1000, shortWords: 180 }));
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/Short too LONG/);
  });

  it("flags too-short narrations", () => {
    const r = checkScriptLength(scriptWith({ longWords: 300, shortWords: 30 }));
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/Long-form too SHORT/);
    expect(r.issues.join(" ")).toMatch(/Short too SHORT/);
  });

  it("requires a hook and ending on both long-form and short", () => {
    const r = checkScriptLength(
      scriptWith({ longWords: 1000, shortWords: 90, cta: false, shortHook: false })
    );
    expect(r.ok).toBe(false);
    expect(r.hasLongStructure).toBe(false);
    expect(r.hasShortStructure).toBe(false);
  });

  it("estimates duration from word count at 150 wpm", () => {
    const r = checkScriptLength(scriptWith({ longWords: 1050, shortWords: 90 }));
    expect(r.estLongSecs).toBe(Math.round((1050 / 150) * 60)); // 420s = 7 min
    expect(r.estShortSecs).toBe(Math.round((90 / 150) * 60)); // 36s
  });

  it("range constants encode the 6–8 min / 30–40s targets", () => {
    expect(LONGFORM_WORD_RANGE).toEqual({ min: 900, max: 1200 });
    expect(SHORT_WORD_RANGE).toEqual({ min: 75, max: 100 });
  });
});

describe("lengthRevisionNote", () => {
  it("includes the concrete failure and the target ranges for the retry", () => {
    const note = lengthRevisionNote(checkScriptLength(scriptWith({ longWords: 2200, shortWords: 90 })));
    expect(note).toMatch(/too LONG/);
    expect(note).toMatch(/900–1200 words/);
    expect(note).toMatch(/retention-driving ending/);
  });
});
