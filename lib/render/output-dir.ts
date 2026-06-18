/**
 * lib/render/output-dir.ts
 *
 * Where rendered media lands. Previously everything went to the OS temp dir, which
 * the system auto-cleans — so finished videos vanished. Renders now go to a stable,
 * configurable base directory whose absolute path is stored in the DB (videos.video_url)
 * for later reference.
 *
 * Default: ~/ContentOS/output. Override with CONTENT_OUTPUT_DIR — point it at any
 * drive/path (e.g. D:\PEMedia\renders or /mnt/storage/pemedia) when you want the
 * library on a bigger disk. A future cloud target (s3/gcs) slots in behind this resolver.
 */

import { homedir } from "os";
import { isAbsolute, join } from "path";

/** The base directory for all rendered output (absolute). */
export function resolveOutputBaseDir(): string {
  const env = process.env.CONTENT_OUTPUT_DIR?.trim();
  if (env) return isAbsolute(env) ? env : join(process.cwd(), env);
  return join(homedir(), "ContentOS", "output");
}

/**
 * The directory for one render, isolated by a unique key (stamp or video id) so
 * concurrent renders never collide and a run's artifacts stay together.
 */
export function resolveRenderDir(key: string | number): string {
  return join(resolveOutputBaseDir(), String(key));
}
