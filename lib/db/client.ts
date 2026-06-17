import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Resilient fetch for Supabase REST calls.
 *
 * A long-running server (especially after the host machine sleeps) can hold
 * dead keep-alive sockets; Windows takes 10–28s to give up on them, which
 * stalls every dashboard page. Cap the wait and, for idempotent reads only,
 * retry once — the retry opens a fresh connection and succeeds immediately.
 * Writes (POST/PATCH/DELETE) are never auto-retried: a timed-out write may
 * still have reached the server.
 */
const READ_TIMEOUT_MS = 8_000;
const WRITE_TIMEOUT_MS = 30_000;

export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isRead = method === "GET" || method === "HEAD";
  const attempts = isRead ? 2 : 1;
  const timeoutMs = isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const signals = [AbortSignal.timeout(timeoutMs)];
      if (init?.signal) signals.push(init.signal as AbortSignal);
      return await fetch(input, { ...init, signal: AbortSignal.any(signals) });
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        console.warn(
          `[db] ${method} ${new URL(String(input instanceof Request ? input.url : input)).pathname} ` +
            `failed (${err instanceof Error ? err.name : "error"}) — retrying on a fresh connection`
        );
      }
    }
  }
  throw lastError;
}

export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set — check .env.local");
  return createClient(url, key);
}

let _serverClient: SupabaseClient | null = null;

export function getServerClient(): SupabaseClient {
  if (_serverClient) return _serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars not set — check .env.local");
  _serverClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: resilientFetch },
  });
  return _serverClient;
}
