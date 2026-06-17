import { describe, expect, it } from "vitest";
import { formatCurrency, formatDuration, formatNumber, formatRelativeTime } from "./utils";

describe("formatNumber", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(2_300_000)).toBe("2.3M");
  });
});

describe("formatCurrency", () => {
  it("formats whole-dollar USD", () => {
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(5000)).toBe("$5,000");
  });
});

describe("formatDuration", () => {
  it("handles ms, seconds, and minutes", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(2500)).toBe("2.5s");
    expect(formatDuration(95_000)).toBe("1m 35s");
  });
});

describe("formatRelativeTime", () => {
  it("handles null and garbage input", () => {
    expect(formatRelativeTime(null)).toBe("never");
    expect(formatRelativeTime(undefined)).toBe("never");
    expect(formatRelativeTime("not-a-date")).toBe("never");
  });

  it("buckets recent times", () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30_000).toISOString())).toBe("just now");
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });
});
