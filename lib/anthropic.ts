import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
 * Single-shot text generation. Backward compatible: existing callers pass
 * (system, user); new callers may pass per-call model/temperature/maxTokens.
 */
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const response = await anthropic.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
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
