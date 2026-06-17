/**
 * lib/render/voice.ts — narration synthesis (ElevenLabs).
 *
 * ElevenLabs' standard TTS endpoints cap a single request at 10,000 input
 * characters. Long-form narration routinely exceeds that, so we split on sentence
 * boundaries into sub-limit chunks, synthesize each (passing the adjacent chunk
 * text as previous_text/next_text so intonation stays continuous across the seam),
 * and let the render layer concatenate the audio. A short narration is a single
 * chunk — one request, identical to before.
 *
 * Voice id comes from ELEVENLABS_VOICE_ID (pick one in ElevenLabs → Voices);
 * delivery settings come from the script's voice_direction when present.
 */

import { generateVoice, generateVoiceWithTimestamps } from "@/lib/elevenlabs";
import { parseAlignment, type TimedWord } from "./captions";

export interface SynthOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  /** Max characters per TTS request. Defaults to ELEVENLABS_MAX_TTS_CHARS or 9000. */
  maxChars?: number;
}

/** One synthesized narration chunk: audio plus its chunk-local word timings. */
export interface NarrationChunk {
  audio: Buffer;
  /** Per-word timings relative to THIS chunk's start (the render offsets them). */
  words: TimedWord[];
}

/** Safe per-request character budget — under the 10k hard cap, with headroom. */
export const DEFAULT_TTS_CHUNK_CHARS = 9000;

function resolveMaxChars(opts: SynthOptions): number {
  if (opts.maxChars && opts.maxChars > 0) return opts.maxChars;
  const env = Number(process.env.ELEVENLABS_MAX_TTS_CHARS);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_TTS_CHUNK_CHARS;
}

function resolveVoiceId(opts: SynthOptions): string {
  const voiceId = opts.voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error(
      "ELEVENLABS_VOICE_ID is not set. Choose a voice in ElevenLabs → Voices and add its id to .env.local."
    );
  }
  return voiceId;
}

/**
 * Pure: split TTS-ready narration into chunks no longer than `maxChars`, breaking
 * on sentence boundaries so prosody isn't cut mid-thought. A single sentence longer
 * than the limit is hard-split on word boundaries (and, pathologically, on chars).
 * The concatenation of the returned chunks reproduces the narration content.
 */
export function splitForTts(text: string, maxChars = DEFAULT_TTS_CHUNK_CHARS): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Sentence-ish units, each keeping its terminal punctuation + trailing space.
  const sentences = clean.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) ?? [clean];

  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const unit of sentences) {
    if (unit.length > maxChars) {
      flush();
      for (const piece of hardSplit(unit, maxChars)) {
        if (piece.trim()) chunks.push(piece.trim());
      }
      continue;
    }
    if ((cur + unit).length > maxChars) flush();
    cur += unit;
  }
  flush();

  return chunks.filter(Boolean);
}

/** Hard-split an oversized unit on word boundaries (chars as a last resort). */
function hardSplit(text: string, maxChars: number): string[] {
  const tokens = text.split(/(\s+)/); // keep whitespace tokens
  const out: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    if (tok.length > maxChars) {
      if (cur.trim()) out.push(cur);
      cur = "";
      for (let i = 0; i < tok.length; i += maxChars) out.push(tok.slice(i, i + maxChars));
      continue;
    }
    if ((cur + tok).length > maxChars) {
      if (cur.trim()) out.push(cur);
      cur = tok;
    } else {
      cur += tok;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export async function synthesizeNarration(text: string, opts: SynthOptions = {}): Promise<Buffer> {
  const buffers = await synthesizeNarrationChunks(text, opts);
  return buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);
}

/**
 * Plain TTS, chunked. Returns one audio buffer per chunk (the render concatenates
 * them losslessly with ffmpeg; the convenience `synthesizeNarration` above does a
 * naive concat for callers that don't need per-chunk control).
 */
export async function synthesizeNarrationChunks(
  text: string,
  opts: SynthOptions = {}
): Promise<Buffer[]> {
  const voiceId = resolveVoiceId(opts);
  if (!text.trim()) throw new Error("Cannot synthesize empty narration.");
  const parts = splitForTts(text, resolveMaxChars(opts));

  const out: Buffer[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(
      await generateVoice({
        text: parts[i],
        voiceId,
        stability: opts.stability,
        similarityBoost: opts.similarityBoost,
        previousText: i > 0 ? parts[i - 1] : undefined,
        nextText: i < parts.length - 1 ? parts[i + 1] : undefined,
      })
    );
  }
  return out;
}

/** Narration audio + per-word timings (single chunk) — for short narrations. */
export async function synthesizeNarrationTimed(
  text: string,
  opts: SynthOptions = {}
): Promise<{ audio: Buffer; words: TimedWord[] }> {
  const chunks = await synthesizeNarrationTimedChunks(text, opts);
  if (chunks.length === 1) return chunks[0];
  return { audio: Buffer.concat(chunks.map((c) => c.audio)), words: chunks[0].words };
}

/**
 * Word-synced (karaoke) TTS, chunked. Each chunk carries audio + its chunk-local
 * word timings; the render concatenates the audio and offsets each chunk's timings
 * by the cumulative duration. Throws if any chunk fails so the caller can fall back
 * to plain TTS + proportional captions for the whole narration.
 */
export async function synthesizeNarrationTimedChunks(
  text: string,
  opts: SynthOptions = {}
): Promise<NarrationChunk[]> {
  const voiceId = resolveVoiceId(opts);
  if (!text.trim()) throw new Error("Cannot synthesize empty narration.");
  const parts = splitForTts(text, resolveMaxChars(opts));

  const out: NarrationChunk[] = [];
  for (let i = 0; i < parts.length; i++) {
    const res = await generateVoiceWithTimestamps({
      text: parts[i],
      voiceId,
      stability: opts.stability,
      similarityBoost: opts.similarityBoost,
      previousText: i > 0 ? parts[i - 1] : undefined,
      nextText: i < parts.length - 1 ? parts[i + 1] : undefined,
    });
    out.push({ audio: res.audio, words: parseAlignment(res.alignment) });
  }
  return out;
}
