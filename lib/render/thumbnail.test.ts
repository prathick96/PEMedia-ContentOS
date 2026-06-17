import { describe, expect, it } from "vitest";
import type { ThumbnailConcept } from "@/lib/db/schema";
import { buildThumbnailArgs, buildThumbnailText } from "./thumbnail";

const concept: ThumbnailConcept = {
  composition: "centered subject",
  text: "the hidden default",
  style_notes: "high contrast",
  ai_image_prompt: "...",
};

describe("buildThumbnailText", () => {
  it("upper-cases and caps at 4 words", () => {
    expect(buildThumbnailText(concept, "fallback")).toBe("THE HIDDEN DEFAULT");
    expect(buildThumbnailText({ ...concept, text: "one two three four five six" }, "")).toBe(
      "ONE TWO THREE FOUR"
    );
  });

  it("uses the fallback when the concept has no text", () => {
    expect(buildThumbnailText(undefined, "My Video Title Here Extra")).toBe("MY VIDEO TITLE HERE");
    expect(buildThumbnailText({ ...concept, text: "  " }, "Fallback Words")).toBe("FALLBACK WORDS");
  });
});

describe("buildThumbnailArgs", () => {
  const args = buildThumbnailArgs({
    srtPath: "/t/thumb.srt",
    outputPath: "/t/thumb.png",
    width: 1280,
    height: 720,
    backgroundColor: "0x123456",
  });

  it("renders a single frame at the requested size + background", () => {
    expect(args).toContain("color=c=0x123456:s=1280x720");
    expect(args).toContain("-frames:v");
    expect(args[args.indexOf("-frames:v") + 1]).toBe("1");
  });

  it("burns the centered text via subtitles and writes the png last", () => {
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("subtitles=");
    expect(vf).toContain("Alignment=5");
    expect(args[args.length - 1]).toBe("/t/thumb.png");
  });
});
