import { NextResponse } from "next/server";
import { CreativeAgent } from "@/lib/agents/creative";

export async function POST(req: Request) {
  try {
    const input = await req.json();
    if (!input.niche || !input.niche_id) {
      return NextResponse.json({ success: false, error: "niche and niche_id required" }, { status: 400 });
    }
    const agent = new CreativeAgent();
    const result = await agent.run(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
