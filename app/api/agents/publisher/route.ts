import { NextResponse } from "next/server";
import { PublisherAgent } from "@/lib/agents/publisher";

export async function POST(req: Request) {
  try {
    const input = await req.json();
    if (!input.video_id) {
      return NextResponse.json({ success: false, error: "video_id required" }, { status: 400 });
    }
    const agent = new PublisherAgent();
    const result = await agent.run(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
