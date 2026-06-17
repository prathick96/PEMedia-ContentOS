import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;

/** Lazy singleton — constructing eagerly at module load crashes builds/CI without a key. */
export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Model registry. Seats and agents default to Sonnet for cost discipline
 * (Finance seat, Council Brief 001 §1.4). The Chairman can be upgraded to
 * Opus for high-stakes strategic synthesis by passing `chairmanModel`.
 */
export const MODELS = {
  seat: "claude-sonnet-4-6",
  chairman: "claude-sonnet-4-6", // upgrade to "claude-opus-4-6" for high-stakes convenes
  fast: "claude-haiku-4-5-20251001",
} as const;

/** Back-compat default model used by existing agents. */
export const MODEL = MODELS.seat;

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Hard per-model output ceilings. Requests are clamped to these so a too-high
 * maxTokens can't 400. Unknown models fall back conservatively.
 */
const MODEL_MAX_OUTPUT: Record<string, number> = {
  "claude-sonnet-4-6": 64000,
  "claude-opus-4-8": 128000,
  "claude-opus-4-6": 128000,
  "claude-haiku-4-5-20251001": 64000,
};
const DEFAULT_MAX_OUTPUT = 16000;

/** How many times to (re)issue a streaming generation when the connection drops. */
const MAX_STREAM_ATTEMPTS = 3;

/**
 * True for faults worth retrying on a fresh connection. The key case: a stream that
 * drops mid-flight makes undici throw `TypeError: terminated` — and because the SDK
 * can't resume a partial stream, it does NOT auto-retry that, so we must. Also covers
 * socket/DNS resets and 408/429/5xx. Deterministic faults (max_tokens truncation,
 * unexpected response shape, 4xx validation) are NOT transient and fall straight through.
 */
export function isTransientStreamError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { message?: string; name?: string; code?: string; status?: number };
  const hay = `${e.name ?? ""} ${e.message ?? ""} ${e.code ?? ""}`.toLowerCase();
  const transientWord =
    hay.includes("terminated") ||
    hay.includes("econnreset") ||
    hay.includes("econnrefused") ||
    hay.includes("enotfound") ||
    hay.includes("epipe") ||
    hay.includes("etimedout") ||
    hay.includes("socket") ||
    hay.includes("network") ||
    hay.includes("fetch failed") ||
    hay.includes("connection error");
  const transientStatus =
    e.status === 408 || e.status === 429 || (typeof e.status === "number" && e.status >= 500);
  return transientWord || transientStatus;
}

/**
 * Single-shot text generation. Backward compatible: existing callers pass
 * (system, user); new callers may pass per-call model/temperature/maxTokens.
 *
 * Streams under the hood (`messages.stream().finalMessage()`): streaming carries
 * no SDK HTTP-timeout ceiling, so large outputs (long scripts/packages) are safe
 * up to the model's real cap. maxTokens is a ceiling, not a target — you're billed
 * only for tokens actually generated.
 *
 * The (static) system prompt is sent as a cached block: repeated calls with the
 * same system prompt within the 5-minute TTL bill it at ~0.1x instead of full
 * input price. It silently no-ops when the prompt is under the model's cache
 * minimum (Sonnet 4.6: 2048 tokens) — watch the [anthropic] usage log to see
 * whether a call actually wrote/read the cache.
 */
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const model = opts.model ?? MODEL;
  const cap = MODEL_MAX_OUTPUT[model] ?? DEFAULT_MAX_OUTPUT;
  const requested = opts.maxTokens ?? 4096;
  const maxTokens = Math.min(requested, cap);
  if (requested > cap) {
    console.warn(`[anthropic] maxTokens ${requested} clamped to ${model} cap ${cap}.`);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_STREAM_ATTEMPTS; attempt++) {
    try {
      const stream = getAnthropic().messages.stream({
        model,
        max_tokens: maxTokens,
        temperature: opts.temperature,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage }],
      });
      const response = await stream.finalMessage();

      const u = response.usage;
      console.log(
        `[anthropic] ${model} input=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} ` +
          `cache_read=${u.cache_read_input_tokens ?? 0} output=${u.output_tokens}`
      );

      if (response.stop_reason === "max_tokens") {
        throw new Error(
          `Claude response truncated at the max_tokens limit (${maxTokens}, ${model} cap ${cap}). ` +
            "Raise maxTokens or ask for more concise output."
        );
      }

      const block = response.content[0];
      if (block.type !== "text") throw new Error("Unexpected response type from Claude");
      return block.text;
    } catch (err) {
      lastErr = err;
      const transient = isTransientStreamError(err);
      const msg = err instanceof Error ? err.message : String(err);

      // A mid-stream disconnect (undici "TypeError: terminated") or a transient
      // socket/5xx fault can't be resumed, so re-issue the whole call on a fresh
      // connection. Deterministic faults (max_tokens, bad shape, 4xx) rethrow now.
      if (transient && attempt < MAX_STREAM_ATTEMPTS) {
        const backoffMs = 800 * 2 ** (attempt - 1);
        console.warn(
          `[anthropic] ${model} streaming attempt ${attempt}/${MAX_STREAM_ATTEMPTS} failed ` +
            `(${msg}); retrying in ${backoffMs}ms`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      if (transient) {
        throw new Error(
          `Anthropic ${model} streaming connection dropped after ${attempt} attempt(s) (${msg}). ` +
            "Transient network fault — retry the run."
        );
      }
      throw err;
    }
  }
  // Unreachable: the loop either returns or throws. Satisfies the type checker.
  throw lastErr instanceof Error ? lastErr : new Error("Anthropic call failed");
}

/**
 * Parse a JSON object/array from a model response, tolerating json fences
 * or stray prose around the payload. Throws if no JSON can be recovered.
 */
export function parseJsonResponse<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through to extraction
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      // fall through
    }
  }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
  throw new Error("No JSON found in model response: " + trimmed.slice(0, 200));
}
