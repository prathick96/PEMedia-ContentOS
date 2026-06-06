import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const niche = searchParams.get("niche");

  const db = getServerClient();
  let query = db
    .from("trend_signals")
    .select("*, niches(name, slug)")
    .order("score", { ascending: false })
    .limit(20);

  if (niche) {
    query = query.eq("niches.slug", niche);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signals: data ?? [] });
}
