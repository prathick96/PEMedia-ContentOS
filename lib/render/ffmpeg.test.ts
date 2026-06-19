import { describe, expect, it } from "vitest";
import { join } from "path";
import {
  buildAudioConcatArgs,
  buildBrollFinalArgs,
  buildColorClipArgs,
  buildConcatListContent,
  buildImageClipArgs,
  buildKenBurnsClipArgs,
  buildMusicMixArgs,
  buildRenderArgs,
  buildSubtitlesFilter,
  buildVideoClipArgs,
  subtitlesFilterName,
} from "./ffmpeg";

describe("subtitlesFilterName", () => {
  it("reduces a path to its bare filename (no drive colon reaches the filtergraph)", () => {
    expect(subtitlesFilterName(join("any", "dir", "captions.srt"))).toBe("captions.srt");
  });
  it("escapes single quotes in the filename", () => {
    expect(subtitlesFilterName(join("t", "a'b.srt"))).toBe("a\\'b.srt");
  });
});

describe("buildSubtitlesFilter", () => {
  it("references the bare srt filename and a quoted force_style", () => {
    const f = buildSubtitlesFilter(join("x", "c.srt"));
    expect(f.startsWith("subtitles=c.srt:force_style='")).toBe(true);
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
    // fps is RENDER_FPS (default 15) — the dominant render-speed lever.
    expect(args.find((a) => a.startsWith("color=c=0x0B0B0F:s=1920x1080:r="))).toBeTruthy();
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

  it("sets a fast x264 preset (a flat background must not encode at the slow default)", () => {
    const i = args.indexOf("-preset");
    expect(i).toBeGreaterThan(0);
    expect(args[i + 1]).toBeTruthy();
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

describe("buildKenBurnsClipArgs", () => {
  const args = buildKenBurnsClipArgs({
    imagePath: "/t/img.jpg",
    outputPath: "/t/clip.mp4",
    durationSecs: 4,
    width: 1920,
    height: 1080,
  });
  it("animates the still with zoompan (never frozen) at the target size", () => {
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("zoompan=");
    expect(vf).toContain("s=1920x1080");
    expect(args).toContain("-an");
    expect(args[args.length - 1]).toBe("/t/clip.mp4");
  });
});

describe("buildVideoClipArgs", () => {
  const args = buildVideoClipArgs({
    videoPath: "/t/src.mp4",
    outputPath: "/t/clip.mp4",
    durationSecs: 5,
    width: 1080,
    height: 1920,
  });
  it("loops + trims the source, drops its audio, fills the frame", () => {
    expect(args[args.indexOf("-stream_loop") + 1]).toBe("-1");
    expect(args[args.indexOf("-t") + 1]).toBe("5.000");
    expect(args).toContain("-an");
    expect(args.join(" ")).toContain("crop=1080:1920");
    expect(args[args.length - 1]).toBe("/t/clip.mp4");
  });
});

describe("buildColorClipArgs", () => {
  const args = buildColorClipArgs({
    outputPath: "/t/clip.mp4",
    durationSecs: 3,
    width: 1920,
    height: 1080,
    backgroundColor: "0x0B0B0F",
  });
  it("renders a solid color card of the given duration", () => {
    expect(args.join(" ")).toContain("color=c=0x0B0B0F:s=1920x1080");
    expect(args[args.indexOf("-t") + 1]).toBe("3.000");
    expect(args).toContain("-an");
    expect(args[args.length - 1]).toBe("/t/clip.mp4");
  });
});

describe("buildMusicMixArgs", () => {
  const args = buildMusicMixArgs({
    videoPath: "/t/in.mp4",
    musicPath: "/t/bed.mp3",
    outputPath: "/t/out.mp4",
    volume: 0.1,
  });
  it("mixes a looped, lowered music bed under narration, copying video", () => {
    expect(args[args.indexOf("-stream_loop") + 1]).toBe("-1");
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("volume=0.1");
    expect(fc).toContain("amix=inputs=2");
    expect(fc).toContain("normalize=0"); // narration stays at full volume
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
    expect(args).toContain("-shortest");
    expect(args[args.length - 1]).toBe("/t/out.mp4");
  });
});

describe("buildConcatListContent", () => {
  it("emits a concat-demuxer list, escaping single quotes", () => {
    const content = buildConcatListContent(["/t/a.mp4", "/t/b's.mp4"]);
    expect(content).toContain("file '/t/a.mp4'");
    expect(content).toContain("file '/t/b'\\''s.mp4'");
  });
});

describe("buildAudioConcatArgs", () => {
  const args = buildAudioConcatArgs({ concatListPath: "/t/list.txt", outputPath: "/t/out.mp3" });
  it("concatenates via the demuxer with a stream copy (lossless)", () => {
    expect(args).toContain("concat");
    expect(args[args.indexOf("-i") + 1]).toBe("/t/list.txt");
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    expect(args[args.length - 1]).toBe("/t/out.mp3");
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
