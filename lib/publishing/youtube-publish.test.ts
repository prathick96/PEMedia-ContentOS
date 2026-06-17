import { describe, expect, it } from "vitest";
import { resolvePublishedStatus, shouldAutoPublishOnApproval } from "./youtube-publish";

describe("resolvePublishedStatus", () => {
  it("public goes live (PUBLISHED)", () => {
    expect(resolvePublishedStatus("public")).toBe("PUBLISHED");
  });
  it("private/unlisted stage on YouTube pending disclosure (SCHEDULED)", () => {
    expect(resolvePublishedStatus("private")).toBe("SCHEDULED");
    expect(resolvePublishedStatus("unlisted")).toBe("SCHEDULED");
  });
});

describe("shouldAutoPublishOnApproval", () => {
  it("fires only for an approved publish_video", () => {
    expect(shouldAutoPublishOnApproval("publish_video", "approved")).toBe(true);
  });
  it("does not fire on rejection or other actions", () => {
    expect(shouldAutoPublishOnApproval("publish_video", "rejected")).toBe(false);
    expect(shouldAutoPublishOnApproval("launch_channel", "approved")).toBe(false);
    expect(shouldAutoPublishOnApproval("spend_money", "approved")).toBe(false);
  });
});
