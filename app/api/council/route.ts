import { NextResponse } from "next/server";
import { convene, reviewGate, type GateKind } from "@/lib/council";

/**
 * POST /api/council
 *   Strategic convene:  { "question": string, "context"?: object }
 *   Tactical gate:      { "gate": "channel_launch"|"topic_greenlight"|"series_kill",
 *                         "payload": object, "context"?: object }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.gate) {
      const verdict = await reviewGate(
        body.gate as GateKind,
        body.payload ?? {},
        body.context ?? {}
      );
      return NextResponse.json({ success: true, verdict });
    }

    if (!body.question) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Provide { question, context } for a strategic convene, or { gate, payload } for a tactical gate.",
        },
        { status: 400 }
      );
    }

    const decision = await convene(body.question, body.context ?? {});
    return NextResponse.json({ success: true, decision });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
