import { describe, expect, it } from "vitest";
import { DEFAULT_TTS_CHUNK_CHARS, splitForTts } from "./voice";

describe("splitForTts", () => {
  it("returns a single chunk when under the limit", () => {
    expect(splitForTts("One sentence. Two sentences.", 9000)).toEqual([
      "One sentence. Two sentences.",
    ]);
  });

  it("returns [] for empty/whitespace input", () => {
    expect(splitForTts("", 9000)).toEqual([]);
    expect(splitForTts("   \n  ", 9000)).toEqual([]);
  });

  it("splits on sentence boundaries, never exceeding maxChars", () => {
    // Three ~20-char sentences, limit 30 → packs into 2-then-1 / sentence-aligned.
    const text = "Alpha beta gamma one. Delta epsilon zeta two. Eta theta iota three.";
    const chunks = splitForTts(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
    // Every sentence's distinctive word survives somewhere (no content dropped).
    for (const marker of ["one", "two", "three"]) {
      expect(chunks.join(" ")).toContain(marker);
    }
  });

  it("does not split mid-sentence when sentences fit the limit", () => {
    const text = "First full sentence here. Second full sentence here.";
    const chunks = splitForTts(text, 30);
    expect(chunks).toEqual(["First full sentence here.", "Second full sentence here."]);
  });

  it("hard-splits a single sentence longer than the limit on word boundaries", () => {
    const text = "word ".repeat(50).trim() + "."; // ~250 chars, one sentence
    const chunks = splitForTts(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
    // No empty chunks.
    for (const c of chunks) expect(c.trim().length).toBeGreaterThan(0);
  });

  it("hard-splits a pathological single token longer than the limit", () => {
    const chunks = splitForTts("x".repeat(100), 40);
    expect(chunks).toEqual(["x".repeat(40), "x".repeat(40), "x".repeat(20)]);
  });

  it("keeps every chunk within the limit for a realistic long narration", () => {
    const para = "This is a realistic narration sentence with a fair amount of words. ";
    const long = para.repeat(300); // ~20k chars
    const chunks = splitForTts(long, DEFAULT_TTS_CHUNK_CHARS);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(DEFAULT_TTS_CHUNK_CHARS);
  });
});
