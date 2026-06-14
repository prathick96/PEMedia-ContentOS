import { describe, expect, it } from "vitest";
import { toSnapshotRow, toVideoAnalyticsRow, todayUtc } from "./ingest";

describe("todayUtc", () => {
  it("formats YYYY-MM-DD", () => {
    expect(todayUtc(new Date("2026-06-14T23:59:00Z"))).toBe("2026-06-14");
  });
});

describe("toSnapshotRow", () => {
  it("maps channel info to an analytics_snaps row", () => {
    const row = toSnapshotRow(
      "ch1",
      { id: "yt", title: "T", subscribers: 1200, totalViews: 50000, videoCount: 8 },
      "2026-06-14"
    );
    expect(row).toMatchObject({
      channel_id: "ch1",
      date: "2026-06-14",
      subscribers: 1200,
      total_views: 50000,
    });
    // Metrics needing the Analytics API stay 0 in v1.
    expect(row.watch_hours).toBe(0);
    expect(row.revenue_usd).toBe(0);
  });
});

describe("toVideoAnalyticsRow", () => {
  it("maps video stats to a video_analytics row", () => {
    const row = toVideoAnalyticsRow("v1", { id: "yt1", views: 900, likes: 80, comments: 12 }, "2026-06-14");
    expect(row).toMatchObject({ video_id: "v1", date: "2026-06-14", views: 900, likes: 80, comments: 12 });
    expect(row.ctr).toBe(0);
  });
});
