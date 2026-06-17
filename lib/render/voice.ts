/**
 * lib/render/voice.ts — narration synthesis (ElevenLabs).
 *
 * One call per render (full narration) to stay inside the free tier. Voice id
 * comes from ELEVENLABS_VOICE_ID (pick one in ElevenLabs → Voices); delivery
 * settings come from the script's voice_direction when present.
 */

import { generateVoice, generateVoiceWithTimestamps } from "@/lib/elevenlabs";
import { parseAlignment, type TimedWord } from "./captions";

export interface SynthOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
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

export async function synthesizeNarration(text: string, opts: SynthOptions = {}): Promise<Buffer> {
  const voiceId = resolveVoiceId(opts);
  if (!text.trim()) throw new Error("Cannot synthesize empty narration.");
  return generateVoice({
    text,
    voiceId,
    stability: opts.stability,
    similarityBoost: opts.similarityBoost,
  });
}

/** Narration audio + per-word timings, for word-synced (karaoke) captions. */
export async function synthesizeNarrationTimed(
  text: string,
  opts: SynthOptions = {}
): Promise<{ audio: Buffer; words: TimedWord[] }> {
  const voiceId = resolveVoiceId(opts);
  if (!text.trim()) throw new Error("Cannot synthesize empty narration.");
  const res = await generateVoiceWithTimestamps({
    text,
    voiceId,
    stability: opts.stability,
    similarityBoost: opts.similarityBoost,
  });
  return { audio: res.audio, words: parseAlignment(res.alignment) };
}
