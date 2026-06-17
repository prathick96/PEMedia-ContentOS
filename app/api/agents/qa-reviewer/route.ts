import { NextResponse } from "next/server";
import { QAReviewerAgent } from "@/lib/agents/qa-reviewer";

export async function POST(req: Request) {
  try {
    const input = await req.json();
    if (!input.video_id) {
      return NextResponse.json({ success: false, error: "video_id required" }, { status: 400 });
    }
    const agent = new QAReviewerAgent();
    const result = await agent.run(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
