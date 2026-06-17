import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerClient } from "@/lib/db/client";
import { buildAuthUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/youtube/connect?channel_id=<uuid>
 * Starts the OAuth flow: sets a CSRF state + the target channel in httpOnly
 * cookies, then redirects to Google's consent screen. Defaults to the most
 * recent channel when channel_id is omitted.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let channelId = url.searchParams.get("channel_id");

    if (!channelId) {
      const db = getServerClient();
      const { data } = await db
        .from("channels")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      channelId = (data as { id: string } | null)?.id ?? null;
    }
    if (!channelId) {
      return NextResponse.json(
        { error: "No channel to connect — create a channel first." },
        { status: 400 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const authUrl = buildAuthUrl(state);

    const res = NextResponse.redirect(authUrl);
    const secure = appIsHttps();
    const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: 600 };
    res.cookies.set("yt_oauth_state", state, cookieOpts);
    res.cookies.set("yt_oauth_channel", channelId, cookieOpts);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function appIsHttps(): boolean {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https");
}
