import { describe, expect, it } from "vitest";
import {
  buildBrollFinalArgs,
  buildConcatListContent,
  buildImageClipArgs,
  buildRenderArgs,
  buildSubtitlesFilter,
  escapeSubtitlesPath,
} from "./ffmpeg";

describe("escapeSubtitlesPath", () => {
  it("converts backslashes to slashes and escapes the drive colon (Windows)", () => {
    expect(escapeSubtitlesPath("C:\\Users\\a\\captions.srt")).toBe("C\\:/Users/a/captions.srt");
  });
  it("leaves a posix path's slashes but still escapes colons", () => {
    expect(escapeSubtitlesPath("/tmp/pemedia/captions.srt")).toBe("/tmp/pemedia/captions.srt");
  });
});

describe("buildSubtitlesFilter", () => {
  it("references the escaped path and a quoted force_style", () => {
    const f = buildSubtitlesFilter("C:\\x\\c.srt");
    expect(f.startsWith("subtitles=C\\:/x/c.srt:force_style='")).toBe(true);
    expect(f).toContain("Alignment=2");
    expect(f.endsWith("'")).toBe(true);
  });
});

describe("buildRenderArgs", () => {
  const args = buildRenderArgs({
    audioPath: "/t/narration.mp3",
    srtPath: "/t/captions.srt",
    plan: { width: 1920, height: 1080, backgroundColor: "0x0B0B0F" },
    outputPath: "/t/out.mp4",
  });

  it("builds a color source at the plan's size and background", () => {
    expect(args).toContain("color=c=0x0B0B0F:s=1920x1080:r=30");
  });

  it("takes the narration as the second input", () => {
    const audioIdx = args.indexOf("/t/narration.mp3");
    expect(audioIdx).toBeGreaterThan(0);
    expect(args[audioIdx - 1]).toBe("-i");
  });

  it("burns subtitles via -vf and bounds output with -shortest", () => {
    const vfIdx = args.indexOf("-vf");
    expect(vfIdx).toBeGreaterThan(0);
    expect(args[vfIdx + 1]).toContain("subtitles=");
    expect(args).toContain("-shortest");
  });

  it("writes to the output path last", () => {
    expect(args[args.length - 1]).toBe("/t/out.mp4");
  });
});

describe("buildImageClipArgs", () => {
  const args = buildImageClipArgs({
    imagePath: "/t/img.jpg",
    outputPath: "/t/clip.mp4",
    durationSecs: 4.2,
    width: 1920,
    height: 1080,
  });
  it("loops the still for the scene duration at the target size", () => {
    expect(args).toContain("-loop");
    expect(args[args.indexOf("-t") + 1]).toBe("4.200");
    expect(args.join(" ")).toContain("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080");
    expect(args).toContain("-an"); // clips are silent
    expect(args[args.length - 1]).toBe("/t/clip.mp4");
  });
});

describe("buildConcatListContent", () => {
  it("emits a concat-demuxer list, escaping single quotes", () => {
    const content = buildConcatListContent(["/t/a.mp4", "/t/b's.mp4"]);
    expect(content).toContain("file '/t/a.mp4'");
    expect(content).toContain("file '/t/b'\\''s.mp4'");
  });
});

describe("buildBrollFinalArgs", () => {
  const args = buildBrollFinalArgs({
    concatListPath: "/t/list.txt",
    audioPath: "/t/a.mp3",
    srtPath: "/t/c.srt",
    outputPath: "/t/out.mp4",
  });
  it("concats clips, muxes audio, burns subtitles, bounds with -shortest", () => {
    expect(args).toContain("concat");
    expect(args[args.indexOf("-i")]).toBe("-i");
    expect(args.join(" ")).toContain("/t/list.txt");
    expect(args.join(" ")).toContain("/t/a.mp3");
    expect(args[args.indexOf("-vf") + 1]).toContain("subtitles=");
    expect(args).toContain("-shortest");
    expect(args[args.length - 1]).toBe("/t/out.mp4");
  });
});
