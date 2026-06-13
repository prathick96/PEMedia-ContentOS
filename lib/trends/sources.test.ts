import { describe, expect, it } from "vitest";
import { mapHackerNews, mapReddit, mapWikipedia, mapYouTube } from "./sources";

describe("mapHackerNews", () => {
  it("maps hits to trend items", () => {
    const json = {
      hits: [
        { title: "New AI chip ships", url: "https://example.com", points: 420, objectID: "1" },
        { title: "Show HN: tool", points: 99, objectID: "2" },
      ],
    };
    const items = mapHackerNews(json);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "New AI chip ships",
      source: "hackernews",
      metric: 420,
      metricLabel: "points",
    });
    // Falls back to the HN discussion link when no external URL
    expect(items[1].url).toBe("https://news.ycombinator.com/item?id=2");
  });

  it("drops hits without titles and tolerates malformed payloads", () => {
    expect(mapHackerNews({ hits: [{ points: 10 }] })).toEqual([]);
    expect(mapHackerNews({})).toEqual([]);
    expect(mapHackerNews(null)).toEqual([]);
  });
});

describe("mapReddit", () => {
  const post = (overrides: Record<string, unknown> = {}) => ({
    data: { title: "A post", permalink: "/r/tech/x", ups: 1000, stickied: false, over_18: false, ...overrides },
  });

  it("maps posts to trend items", () => {
    const items = mapReddit({ data: { children: [post()] } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "A post",
      url: "https://www.reddit.com/r/tech/x",
      source: "reddit",
      metric: 1000,
      metricLabel: "upvotes",
    });
  });

  it("filters stickied and NSFW posts", () => {
    const json = {
      data: { children: [post({ stickied: true }), post({ over_18: true }), post()] },
    };
    expect(mapReddit(json)).toHaveLength(1);
  });

  it("tolerates malformed payloads", () => {
    expect(mapReddit({})).toEqual([]);
    expect(mapReddit(null)).toEqual([]);
    expect(mapReddit({ data: { children: [{}] } })).toEqual([]);
  });
});

describe("mapWikipedia", () => {
  it("maps trending articles and filters meta pages", () => {
    const json = {
      items: [
        {
          articles: [
            { article: "Main_Page", views: 5_000_000 },
            { article: "Special:Search", views: 1_000_000 },
            { article: "Battle_of_Hastings", views: 80_000 },
          ],
        },
      ],
    };
    const items = mapWikipedia(json);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Battle of Hastings",
      url: "https://en.wikipedia.org/wiki/Battle_of_Hastings",
      source: "wikipedia",
      metric: 80_000,
      metricLabel: "views",
    });
  });

  it("tolerates malformed payloads", () => {
    expect(mapWikipedia({})).toEqual([]);
    expect(mapWikipedia(null)).toEqual([]);
    expect(mapWikipedia({ items: [] })).toEqual([]);
  });
});

describe("mapYouTube", () => {
  it("maps videos to trend items", () => {
    const json = {
      items: [
        { id: "abc", snippet: { title: "Trending video" }, statistics: { viewCount: "123456" } },
      ],
    };
    const items = mapYouTube(json);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Trending video",
      url: "https://www.youtube.com/watch?v=abc",
      source: "youtube",
      metric: 123456,
      metricLabel: "views",
    });
  });

  it("tolerates missing statistics and malformed payloads", () => {
    const items = mapYouTube({ items: [{ id: "x", snippet: { title: "No stats" } }] });
    expect(items[0].metric).toBe(0);
    expect(mapYouTube({})).toEqual([]);
    expect(mapYouTube(null)).toEqual([]);
  });
});
