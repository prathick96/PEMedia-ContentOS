import { describe, expect, it } from "vitest";
import { evaluateCadence, MAX_POSTS_PER_WEEK, MIN_HOURS_BETWEEN_POSTS } from "./cadence";

const NOW = new Date("2026-06-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 3_600_000);

describe("evaluateCadence — 18h rule", () => {
  it("allows the first-ever post", () => {
    expect(evaluateCadence([], NOW).allowed).toBe(true);
  });

  it("blocks a post within 18h of the last one", () => {
    const d = evaluateCadence([hoursAgo(5)], NOW);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/since the last post/);
    expect(d.nextAllowedAt).toBe(new Date(hoursAgo(5).getTime() + MIN_HOURS_BETWEEN_POSTS * 3_600_000).toISOString());
  });

  it("allows once 18h have passed (and under the weekly cap)", () => {
    expect(evaluateCadence([hoursAgo(20)], NOW).allowed).toBe(true);
  });
});

describe("evaluateCadence — weekly cap", () => {
  it(`blocks the ${MAX_POSTS_PER_WEEK + 1}th post in a rolling week`, () => {
    // Two posts in the last 7 days, both older than 18h.
    const d = evaluateCadence([hoursAgo(20), daysAgo(4)], NOW);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/last 7 days/);
  });

  it("allows when the older posts have aged out of the 7-day window", () => {
    const d = evaluateCadence([daysAgo(8), daysAgo(9)], NOW);
    expect(d.allowed).toBe(true);
  });
});

describe("evaluateCadence — options + robustness", () => {
  it("honors custom thresholds", () => {
    expect(evaluateCadence([hoursAgo(10)], NOW, { minHoursBetween: 6 }).allowed).toBe(true);
  });

  it("ignores invalid dates", () => {
    expect(evaluateCadence([new Date("nonsense")], NOW).allowed).toBe(true);
  });
});
