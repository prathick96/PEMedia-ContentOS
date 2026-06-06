import { NextResponse } from "next/server";
import { ProductionAgent } from "@/lib/agents/production";

export async function POST(req: Request) {
  try {
    const input = await req.json();
    if (!input.topic || !input.series_id) {
      return NextResponse.json({ success: false, error: "topic and series_id required" }, { status: 400 });
    }
    const agent = new ProductionAgent();
    const result = await agent.run(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
