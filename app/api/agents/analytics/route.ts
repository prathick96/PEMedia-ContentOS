import { NextResponse } from "next/server";
import { AnalyticsAgent } from "@/lib/agents/analytics";

export async function POST(req: Request) {
  try {
    const input = await req.json();
    const agent = new AnalyticsAgent();
    const result = await agent.run(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
