import { describe, expect, it } from "vitest";
import type { ShortCut, VideoScript } from "@/lib/db/schema";
import {
  buildRenderPlan,
  buildShortRenderPlan,
  computeSceneDurations,
  countWords,
  normalizeColor,
  truncateCaption,
} from "./plan";

const script: VideoScript = {
  hook: "This tiny config flag quietly doubled our cloud bill.",
  sections: [
    {
      title: "The default nobody reads",
      content: "The provider ships it on by default.",
      narration: "Here is the default setting that the provider ships enabled, and why it costs you.",
      on_screen_text: "The hidden default",
    },
    {
      title: "The fix",
      content: "One line turns it off.",
      narration: "One line in your config turns it off and the bill drops the next cycle.",
      on_screen_text: "The one-line fix",
    },
  ],
  cta: "Follow for more cloud cost autopsies.",
  title_options: ["The flag that doubled our bill"],
  description: "",
  tags: [],
  chapters: [],
};

describe("countWords", () => {
  it("counts words, tolerating extra whitespace and empties", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  spaced   out  ")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });
});

describe("truncateCaption", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    expect(truncateCaption("a   b")).toBe("a b");
    const long = "x".repeat(200);
    const out = truncateCaption(long, 50);
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("normalizeColor", () => {
  it("normalizes hex variants to 0xRRGGBB", () => {
    expect(normalizeColor("#0a0a0a")).toBe("0x0A0A0A");
    expect(normalizeColor("0a0a0a")).toBe("0x0A0A0A");
    expect(normalizeColor("0xABCDEF")).toBe("0xABCDEF");
  });
  it("falls back to the default on junk or missing input", () => {
    expect(normalizeColor("red")).toBe("0x0B0B0F");
    expect(normalizeColor(undefined)).toBe("0x0B0B0F");
  });
});

describe("buildRenderPlan", () => {
  it("creates a scene for hook + each section + cta", () => {
    const plan = buildRenderPlan(script);
    expect(plan.scenes).toHaveLength(4);
    expect(plan.scenes[0].text).toContain("doubled our cloud bill");
    expect(plan.scenes[1].text).toBe("The hidden default");
    expect(plan.scenes[2].text).toBe("The one-line fix");
    expect(plan.scenes[3].text).toContain("Follow for more");
  });

  it("defaults to 16:9 dimensions and honors 9:16", () => {
    expect(buildRenderPlan(script)).toMatchObject({ width: 1920, height: 1080 });
    expect(buildRenderPlan(script, { aspect: "9:16" })).toMatchObject({ width: 1080, height: 1920 });
  });

  it("derives narration from tts_narration when present, else from the package", () => {
    const withTts = { ...script, tts_narration: "Pre-baked narration." };
    expect(buildRenderPlan(withTts).narration).toBe("Pre-baked narration.");
    expect(buildRenderPlan(script).narration).toContain("This tiny config flag");
  });

  it("applies the brand background color", () => {
    expect(buildRenderPlan(script, { backgroundColor: "#123456" }).backgroundColor).toBe("0x123456");
  });

  it("throws when there is no narration to speak", () => {
    const empty: VideoScript = { ...script, hook: "", sections: [], cta: "", tts_narration: "" };
    expect(() => buildRenderPlan(empty)).toThrow(/no narration/i);
  });
});

describe("computeSceneDurations", () => {
  it("splits total duration proportionally to words and sums to total", () => {
    const durs = computeSceneDurations(
      [{ text: "a", words: 10 }, { text: "b", words: 30 }],
      40
    );
    expect(durs).toEqual([10, 30]);
    expect(durs.reduce((s, d) => s + d, 0)).toBeCloseTo(40);
  });
  it("returns [] for empty scenes or non-positive duration", () => {
    expect(computeSceneDurations([], 40)).toEqual([]);
    expect(computeSceneDurations([{ text: "a", words: 1 }], 0)).toEqual([]);
  });
});

describe("buildShortRenderPlan", () => {
  const short: ShortCut = {
    hook: "The hidden default",
    narration: "One config flag, on by default, quietly doubled the bill. One line fixes it.",
    captions: ["One flag", "On by default", "One-line fix"],
    tts_narration: "One config flag, on by default, quietly doubled the bill. One line fixes it.",
  };

  it("is 9:16 and makes one scene per caption", () => {
    const plan = buildShortRenderPlan(short);
    expect(plan).toMatchObject({ width: 1080, height: 1920 });
    expect(plan.scenes.map((s) => s.text)).toEqual(["One flag", "On by default", "One-line fix"]);
  });

  it("falls back to the hook when there are no captions", () => {
    const plan = buildShortRenderPlan({ ...short, captions: [] });
    expect(plan.scenes).toHaveLength(1);
    expect(plan.scenes[0].text).toBe("The hidden default");
  });
});
