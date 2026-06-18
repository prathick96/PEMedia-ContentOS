import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { homedir } from "os";
import { isAbsolute, join } from "path";
import { resolveOutputBaseDir, resolveRenderDir } from "./output-dir";

describe("resolveOutputBaseDir", () => {
  const original = process.env.CONTENT_OUTPUT_DIR;
  beforeEach(() => delete process.env.CONTENT_OUTPUT_DIR);
  afterEach(() => {
    if (original === undefined) delete process.env.CONTENT_OUTPUT_DIR;
    else process.env.CONTENT_OUTPUT_DIR = original;
  });

  it("defaults to ~/ContentOS/output when unset", () => {
    expect(resolveOutputBaseDir()).toBe(join(homedir(), "ContentOS", "output"));
  });

  it("uses CONTENT_OUTPUT_DIR verbatim when absolute", () => {
    const abs = join(homedir(), "PEMedia", "renders");
    process.env.CONTENT_OUTPUT_DIR = abs;
    expect(resolveOutputBaseDir()).toBe(abs);
    expect(isAbsolute(resolveOutputBaseDir())).toBe(true);
  });

  it("resolves a relative CONTENT_OUTPUT_DIR against cwd", () => {
    process.env.CONTENT_OUTPUT_DIR = "renders";
    expect(resolveOutputBaseDir()).toBe(join(process.cwd(), "renders"));
  });
});

describe("resolveRenderDir", () => {
  it("isolates each render under the base by key", () => {
    const base = resolveOutputBaseDir();
    expect(resolveRenderDir(12345)).toBe(join(base, "12345"));
    expect(resolveRenderDir("abc")).toBe(join(base, "abc"));
  });
});
