import { describe, expect, it } from "vitest";
import {
  buildPexelsQuery,
  photoUrl,
  pickBestPhoto,
  pickBestVideoFile,
  type PexelsPhoto,
  type PexelsVideo,
} from "./visuals";

describe("buildPexelsQuery", () => {
  it("prefers explicit keywords (max 3)", () => {
    expect(buildPexelsQuery("anything", ["server", "rack", "datacenter", "cables"])).toBe(
      "server rack datacenter"
    );
  });
  it("falls back to cleaned caption text (max 4 words)", () => {
    expect(buildPexelsQuery("The hidden, default setting nobody reads!")).toBe(
      "The hidden default setting"
    );
  });
});

const landscape: PexelsPhoto = { id: 1, width: 1920, height: 1080, src: { large2x: "L.jpg" } };
const portrait: PexelsPhoto = { id: 2, width: 1080, height: 1920, src: { large: "P.jpg" } };
const noSrc: PexelsPhoto = { id: 3, width: 100, height: 100, src: {} };

describe("pickBestPhoto", () => {
  it("picks a landscape photo for 16:9", () => {
    expect(pickBestPhoto([portrait, landscape], "16:9")?.id).toBe(1);
  });
  it("picks a portrait photo for 9:16", () => {
    expect(pickBestPhoto([landscape, portrait], "9:16")?.id).toBe(2);
  });
  it("falls back to any usable photo when no orientation matches", () => {
    expect(pickBestPhoto([landscape], "9:16")?.id).toBe(1);
  });
  it("skips photos with no usable src and returns null when none usable", () => {
    expect(pickBestPhoto([noSrc], "16:9")).toBeNull();
  });
});

function vid(id: number, w: number, h: number, files: { w: number; type?: string; link?: string }[]): PexelsVideo {
  return {
    id,
    width: w,
    height: h,
    duration: 10,
    video_files: files.map((f, i) => ({
      id: id * 100 + i,
      quality: "hd",
      file_type: f.type ?? "video/mp4",
      width: f.w,
      height: Math.round(f.w * (h / w)),
      link: f.link ?? `clip${id}-${f.w}.mp4`,
    })),
  };
}

describe("pickBestVideoFile", () => {
  it("picks the smallest mp4 at or above the target width from an orientation match", () => {
    const videos = [vid(1, 1920, 1080, [{ w: 640 }, { w: 1280 }, { w: 1920 }])];
    expect(pickBestVideoFile(videos, "16:9", 1280)?.url).toBe("clip1-1280.mp4");
  });

  it("falls back to the largest available when none reach the target", () => {
    const videos = [vid(1, 1920, 1080, [{ w: 640 }, { w: 960 }])];
    expect(pickBestVideoFile(videos, "16:9", 1280)?.url).toBe("clip1-960.mp4");
  });

  it("prefers an orientation match but relaxes when none match", () => {
    const portraitOnly = [vid(2, 1080, 1920, [{ w: 720 }])];
    expect(pickBestVideoFile(portraitOnly, "16:9", 1280)?.url).toBe("clip2-720.mp4");
  });

  it("ignores non-mp4 files and returns null when none are usable", () => {
    expect(pickBestVideoFile([vid(1, 1920, 1080, [{ w: 1280, type: "video/webm" }])], "16:9")).toBeNull();
    expect(pickBestVideoFile([], "16:9")).toBeNull();
  });
});

describe("photoUrl", () => {
  it("prefers large2x → large → original", () => {
    expect(photoUrl({ id: 1, width: 1, height: 1, src: { large2x: "a", large: "b", original: "c" } })).toBe("a");
    expect(photoUrl({ id: 1, width: 1, height: 1, src: { original: "c" } })).toBe("c");
    expect(photoUrl(noSrc)).toBe("");
  });
});
