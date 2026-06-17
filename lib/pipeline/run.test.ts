import { describe, expect, it } from "vitest";
import { shouldProceedAfterQa } from "./run";

describe("shouldProceedAfterQa", () => {
  it("proceeds to the Publisher on auto_publish and needs_human_review", () => {
    expect(shouldProceedAfterQa("auto_publish")).toBe(true);
    expect(shouldProceedAfterQa("needs_human_review")).toBe(true);
  });

  it("halts the chain on reject", () => {
    expect(shouldProceedAfterQa("reject")).toBe(false);
  });
});
