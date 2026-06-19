import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { homedir } from "os";
import { join } from "path";
import { isAudioFile, pickFromList, resolveMusicDir } from "./music";

describe("isAudioFile", () => {
  it("accepts common audio extensions (case-insensitive)", () => {
    expect(isAudioFile("track.mp3")).toBe(true);
    expect(isAudioFile("Loop.WAV")).toBe(true);
    expect(isAudioFile("bed.m4a")).toBe(true);
  });
  it("rejects non-audio files", () => {
    expect(isAudioFile("clip.mp4")).toBe(false);
    expect(isAudioFile("notes.txt")).toBe(false);
    expect(isAudioFile("noext")).toBe(false);
  });
});

describe("pickFromList", () => {
  it("returns null for an empty list", () => {
    expect(pickFromList([])).toBeNull();
  });
  it("returns the only item", () => {
    expect(pickFromList(["a"])).toBe("a");
  });
  it("uses the injected rng deterministically", () => {
    expect(pickFromList(["a", "b", "c"], () => 0)).toBe("a");
    expect(pickFromList(["a", "b", "c"], () => 0.5)).toBe("b");
    expect(pickFromList(["a", "b", "c"], () => 0.99)).toBe("c");
  });
});

describe("resolveMusicDir", () => {
  const original = process.env.CONTENT_MUSIC_DIR;
  beforeEach(() => delete process.env.CONTENT_MUSIC_DIR);
  afterEach(() => {
    if (original === undefined) delete process.env.CONTENT_MUSIC_DIR;
    else process.env.CONTENT_MUSIC_DIR = original;
  });

  it("defaults to ~/ContentOS/music", () => {
    expect(resolveMusicDir()).toBe(join(homedir(), "ContentOS", "music"));
  });
  it("honors an absolute CONTENT_MUSIC_DIR", () => {
    const abs = join(homedir(), "Music", "pemedia");
    process.env.CONTENT_MUSIC_DIR = abs;
    expect(resolveMusicDir()).toBe(abs);
  });
  it("resolves a relative CONTENT_MUSIC_DIR against cwd", () => {
    process.env.CONTENT_MUSIC_DIR = "assets/music";
    expect(resolveMusicDir()).toBe(join(process.cwd(), "assets/music"));
  });
});
