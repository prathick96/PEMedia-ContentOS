/**
 * YouTube Data API v3 — OAuth + resumable upload.
 *
 * Zero external deps: standard OAuth2 + REST over fetch (runs in the Node route
 * runtime). Used by:
 *   - /api/auth/youtube/connect   → buildAuthUrl()
 *   - /api/auth/youtube/callback  → exchangeCodeForTokens() + fetchMyChannel() + saveChannelOAuth()
 *   - /api/youtube/test-upload    → getValidAccessToken() + uploadVideo()
 *   - Publisher (Phase 3)         → getValidAccessToken() + uploadVideo()
 *
 * SECURITY NOTE: refresh tokens are stored in channel_oauth in plaintext — fine
 * for local-only Phase 1 (service-role access, no public deploy). Encrypt at rest
 * before any public deployment (see docs/deploy/vercel.md).
 */

import { readFile } from "fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/youtube/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

/** Scopes must match the consent screen registration. */
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Must exactly match the Authorized redirect URI registered in Google Cloud. */
export function redirectUri(): string {
  return `${appBaseUrl()}/api/auth/youtube/callback`;
}

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set. Add them to .env.local (see council-brief-003)."
    );
  }
  return { id, secret };
}

// ── OAuth ────────────────────────────────────────────────────────────────────

/** Consent URL. access_type=offline + prompt=consent guarantee a refresh_token. */
export function buildAuthUrl(state: string): string {
  const { id } = clientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const { id, secret } = clientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as OAuthTokens;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const { id, secret } = clientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

// ── Token storage (channel_oauth, migration 007) ─────────────────────────────

export interface SaveOAuthInput {
  channelId: string;
  refreshToken: string;
  accessToken: string;
  expiresIn: number;
  scope?: string;
  providerAccountId?: string;
  providerAccountName?: string;
}

export async function saveChannelOAuth(db: SupabaseClient, input: SaveOAuthInput): Promise<void> {
  const expiry = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  const { error } = await db.from("channel_oauth").upsert(
    {
      channel_id: input.channelId,
      provider: "youtube",
      refresh_token: input.refreshToken,
      access_token: input.accessToken,
      token_expiry: expiry,
      scope: input.scope ?? null,
      provider_account_id: input.providerAccountId ?? null,
      provider_account_name: input.providerAccountName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel_id,provider" }
  );
  if (error) throw new Error(`Failed to save channel_oauth: ${error.message}`);
}

interface ChannelOAuthRowDb {
  refresh_token: string;
  access_token: string | null;
  token_expiry: string | null;
}

/** Return a valid access token for a channel, refreshing (and persisting) if stale. */
export async function getValidAccessToken(db: SupabaseClient, channelId: string): Promise<string> {
  const { data } = await db
    .from("channel_oauth")
    .select("refresh_token, access_token, token_expiry")
    .eq("channel_id", channelId)
    .eq("provider", "youtube")
    .single();

  const row = data as ChannelOAuthRowDb | null;
  if (!row?.refresh_token) {
    throw new Error(`Channel ${channelId} is not connected to YouTube — run /api/auth/youtube/connect first.`);
  }

  const stillValid =
    row.access_token &&
    row.token_expiry &&
    new Date(row.token_expiry).getTime() - Date.now() > 60_000; // 60s safety margin
  if (stillValid) return row.access_token as string;

  const refreshed = await refreshAccessToken(row.refresh_token);
  await db
    .from("channel_oauth")
    .update({
      access_token: refreshed.access_token,
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId)
    .eq("provider", "youtube");
  return refreshed.access_token;
}

// ── Channel info ─────────────────────────────────────────────────────────────

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
}

export async function fetchMyChannel(accessToken: string): Promise<YouTubeChannelInfo> {
  const res = await fetch(`${API_BASE}/channels?part=snippet,statistics&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`channels.list failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    items?: { id: string; snippet: { title: string }; statistics: Record<string, string> }[];
  };
  const item = json.items?.[0];
  if (!item) throw new Error("No YouTube channel found for the authorized account.");
  return {
    id: item.id,
    title: item.snippet.title,
    subscribers: Number(item.statistics.subscriberCount ?? 0),
    totalViews: Number(item.statistics.viewCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
  };
}

export interface YouTubeVideoStats {
  id: string;
  views: number;
  likes: number;
  comments: number;
}

/** Fetch public statistics for up to 50 videos in one call (Data API). */
export async function fetchVideoStats(
  accessToken: string,
  videoIds: string[]
): Promise<YouTubeVideoStats[]> {
  if (videoIds.length === 0) return [];
  const ids = videoIds.slice(0, 50).join(",");
  const res = await fetch(`${API_BASE}/videos?part=statistics&id=${ids}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`videos.list failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    items?: { id: string; statistics: Record<string, string> }[];
  };
  return (json.items ?? []).map((item) => ({
    id: item.id,
    views: Number(item.statistics.viewCount ?? 0),
    likes: Number(item.statistics.likeCount ?? 0),
    comments: Number(item.statistics.commentCount ?? 0),
  }));
}

// ── Upload (resumable) ───────────────────────────────────────────────────────

export interface YouTubeUploadInput {
  /** Absolute path to the rendered video file on the server. */
  videoPath: string;
  title: string;
  description: string;
  tags?: string[];
  /** Default 28 = Science & Technology. */
  categoryId?: string;
  /** 'private' (default, safest) | 'unlisted' | 'public'. */
  privacyStatus?: "private" | "unlisted" | "public";
  /** ISO time → schedules the video (requires privacyStatus 'private'). */
  publishAt?: string;
  /** Optional thumbnail image path (png/jpg). */
  thumbnailPath?: string;
}

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  /**
   * The YouTube Data API cannot set the "altered content" (synthetic-media)
   * disclosure — it must be toggled in YouTube Studio. True = an operator/Publisher
   * must apply it before the video goes public. This is why uploads default to
   * 'private' and the human publish-approval stays on (Council Brief 003).
   */
  requiresStudioDisclosure: boolean;
}

export async function uploadVideo(
  accessToken: string,
  input: YouTubeUploadInput
): Promise<YouTubeUploadResult> {
  const bytes = await readFile(input.videoPath);
  const privacyStatus = input.privacyStatus ?? "private";

  const metadata = {
    snippet: {
      title: input.title,
      description: input.description,
      tags: input.tags ?? [],
      categoryId: input.categoryId ?? "28",
    },
    status: {
      privacyStatus: input.publishAt ? "private" : privacyStatus,
      selfDeclaredMadeForKids: false,
      ...(input.publishAt ? { publishAt: input.publishAt } : {}),
    },
  };

  // 1. Initiate resumable session.
  const init = await fetch(`${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/*",
      "X-Upload-Content-Length": String(bytes.byteLength),
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`Upload init failed (${init.status}): ${await init.text()}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("Upload init did not return a resumable Location URL.");

  // 2. Upload the bytes in a single PUT.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*", "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status}): ${await put.text()}`);
  const created = (await put.json()) as { id: string };

  // 3. Best-effort thumbnail.
  if (input.thumbnailPath) {
    await setThumbnail(accessToken, created.id, input.thumbnailPath).catch((err) =>
      console.warn("[youtube] thumbnail set failed:", err)
    );
  }

  return {
    videoId: created.id,
    url: `https://youtu.be/${created.id}`,
    requiresStudioDisclosure: true,
  };
}

async function setThumbnail(accessToken: string, videoId: string, thumbnailPath: string) {
  const bytes = await readFile(thumbnailPath);
  const contentType = thumbnailPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const res = await fetch(`${UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
    body: bytes,
  });
  if (!res.ok) throw new Error(`thumbnails.set failed (${res.status}): ${await res.text()}`);
}
