import { runFullPipeline } from "@/lib/pipeline/full-run";
import type { NicheSlug } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
// The full run drives every agent (+ optional ffmpeg render) — keep it open.
export const maxDuration = 300;

/**
 * GET /api/pipeline/stream?niche=tech
 * Server-Sent Events. Emits one `data:` JSON frame per stage event as the full
 * pipeline runs, then a final `{ "type": "end" }` frame. Consumed by the Pipeline
 * screen's live tracker via EventSource.
 */
export async function GET(req: Request) {
  const niche = (new URL(req.url).searchParams.get("niche") ?? "tech") as NicheSlug;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const event of runFullPipeline({ niche })) {
          send(event);
        }
      } catch (err) {
        send({ stage: "scout", status: "failed", detail: err instanceof Error ? err.message : "Pipeline error", at: new Date().toISOString() });
      } finally {
        send({ type: "end" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
