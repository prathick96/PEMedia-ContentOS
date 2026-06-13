import { describe, expect, it } from "vitest";
import type { ShortCut } from "@/lib/db/schema";
import {
  ALL_SHORT_SURFACES,
  CROSS_PROMO_EVERY,
  DEFAULT_SHORT_SURFACES,
  buildDistributionPlan,
  buildShortNarration,
  composePromoTail,
  shouldCrossPromote,
} from "./distribution";

describe("shouldCrossPromote (1-in-5 rule)", () => {
  it("promotes exactly every CROSS_PROMO_EVERY-th short", () => {
    // priorShortCount is 0-based: 0 => this is the 1st short, 4 => the 5th.
    const flags = Array.from({ length: 10 }, (_, prior) => shouldCrossPromote(prior));
    expect(flags).toEqual([
      false, false, false, false, true, // 5th short promotes
      false, false, false, false, true, // 10th short promotes
    ]);
  });

  it("promotes one short in every window of CROSS_PROMO_EVERY", () => {
    const window = Array.from({ length: CROSS_PROMO_EVERY }, (_, i) => shouldCrossPromote(i));
    expect(window.filter(Boolean)).toHaveLength(1);
  });

  it("never promotes on invalid input", () => {
    expect(shouldCrossPromote(-1)).toBe(false);
    expect(shouldCrossPromote(NaN)).toBe(false);
  });
});

describe("composePromoTail", () => {
  it("is platform-neutral and names the channel", () => {
    const tail = composePromoTail("Bitwise");
    expect(tail).toContain("Bitwise");
    expect(tail.toLowerCase()).toContain("youtube");
    // Must NOT say "below"/"subscribe below" — the file posts to four apps.
    expect(tail.toLowerCase()).not.toContain("subscribe below");
  });

  it("falls back gracefully when no channel name", () => {
    expect(composePromoTail("")).toMatch(/youtube/i);
    expect(composePromoTail("   ")).toMatch(/youtube/i);
  });
});

describe("buildShortNarration", () => {
  const short: ShortCut = {
    hook: "This one line of code broke production.",
    narration: "Here's the bug, and the one-character fix that saved the deploy.",
  };

  it("returns the base narration unchanged when not cross-promoting", () => {
    const out = buildShortNarration(short, { crossPromote: false, channelName: "Bitwise" });
    expect(out).toBe(short.narration);
  });

  it("appends the promo tail (blank-line separated) when cross-promoting", () => {
    const out = buildShortNarration(short, { crossPromote: true, channelName: "Bitwise" });
    expect(out.startsWith(short.narration)).toBe(true);
    expect(out).toContain("\n\n");
    expect(out).toContain(composePromoTail("Bitwise"));
  });

  it("prefers an existing tts_narration over narration as the base", () => {
    const withTts: ShortCut = { ...short, tts_narration: "Pre-tuned TTS line." };
    const out = buildShortNarration(withTts, { crossPromote: false, channelName: "Bitwise" });
    expect(out).toBe("Pre-tuned TTS line.");
  });

  it("does not mutate the input short", () => {
    const copy = { ...short };
    buildShortNarration(short, { crossPromote: true, channelName: "Bitwise" });
    expect(short).toEqual(copy);
  });
});

describe("buildDistributionPlan", () => {
  it("sends long-form to YouTube and the short to YouTube/IG/FB by default", () => {
    const plan = buildDistributionPlan(false);
    expect(plan.longForm.surface).toBe("youtube");
    expect(plan.longForm.aspect).toBe("16:9");
    expect(plan.short.surfaces).toEqual(DEFAULT_SHORT_SURFACES);
    expect(plan.short.surfaces).toContain("youtube_shorts");
    expect(plan.short.surfaces).toContain("instagram_reels");
    expect(plan.short.surfaces).toContain("facebook_reels");
    expect(plan.short.aspect).toBe("9:16");
  });

  it("defers TikTok by default (banned in IN until Canada relocation)", () => {
    expect(buildDistributionPlan(false).short.surfaces).not.toContain("tiktok");
  });

  it("includes TikTok only when explicitly opted in", () => {
    const plan = buildDistributionPlan(false, { includeTikTok: true });
    expect(plan.short.surfaces).toEqual(ALL_SHORT_SURFACES);
    expect(plan.short.surfaces).toContain("tiktok");
  });

  it("always requires AI disclosure on every surface (synthetic voice/visuals)", () => {
    const plan = buildDistributionPlan(true);
    expect(plan.longForm.ai_disclosure).toBe(true);
    expect(plan.short.ai_disclosure).toBe(true);
  });

  it("carries the cross-promote flag through to the short", () => {
    expect(buildDistributionPlan(true).short.crossPromote).toBe(true);
    expect(buildDistributionPlan(false).short.crossPromote).toBe(false);
  });

  it("returns a fresh surfaces array each call (no shared mutable state)", () => {
    const a = buildDistributionPlan(false);
    a.short.surfaces.push("tiktok");
    const b = buildDistributionPlan(false);
    expect(b.short.surfaces).toEqual(DEFAULT_SHORT_SURFACES);
  });
});
