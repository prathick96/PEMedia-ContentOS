import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/db/client";
import { appBaseUrl, exchangeCodeForTokens, fetchMyChannel, saveChannelOAuth } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/youtube/callback
 * Google redirects here with ?code & ?state. We verify the CSRF state cookie,
 * exchange the code for tokens, capture the connected channel identity, persist
 * to channel_oauth, and redirect back to the channel page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const expectedState = store.get("yt_oauth_state")?.value;
  const channelId = store.get("yt_oauth_channel")?.value;

  // Clear the one-shot cookies regardless of outcome.
  const clear = (res: NextResponse) => {
    res.cookies.delete("yt_oauth_state");
    res.cookies.delete("yt_oauth_channel");
    return res;
  };
  const back = (params: string) =>
    clear(
      NextResponse.redirect(
        `${appBaseUrl()}/dashboard/channels/${channelId ?? ""}?${params}`
      )
    );

  if (oauthError) return back(`youtube_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("youtube_error=invalid_state");
  }
  if (!channelId) return back("youtube_error=missing_channel");

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Happens if the user previously consented and Google withheld a new refresh
      // token. They must revoke at myaccount.google.com/permissions and reconnect.
      return back("youtube_error=no_refresh_token");
    }

    const channel = await fetchMyChannel(tokens.access_token);
    const db = getServerClient();
    await saveChannelOAuth(db, {
      channelId,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      providerAccountId: channel.id,
      providerAccountName: channel.title,
    });
    await db
      .from("channels")
      .update({ url: `https://www.youtube.com/channel/${channel.id}` })
      .eq("id", channelId);

    return back(`connected=youtube&yt=${encodeURIComponent(channel.title)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return back(`youtube_error=${encodeURIComponent(message)}`);
  }
}
