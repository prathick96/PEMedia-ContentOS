// ElevenLabs TTS API client
// Free tier: 10,000 chars/month (~5-7 videos)
// Starter: $5/mo — unlock after first $50 affiliate revenue

export interface VoiceGenerationOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export async function generateVoice(opts: VoiceGenerationOptions): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: opts.modelId ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: opts.stability ?? 0.5,
          similarity_boost: opts.similarityBoost ?? 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs API error: ${err}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

/** Per-character timing alignment returned by the with-timestamps endpoint. */
export interface VoiceAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface VoiceWithTimestamps {
  audio: Buffer;
  alignment: VoiceAlignment | null;
}

/**
 * Generate voice AND per-character timestamps in one call. Powers word-synced
 * (karaoke) captions. Returns the decoded audio plus the alignment, or
 * alignment: null if the API omits it.
 */
export async function generateVoiceWithTimestamps(
  opts: VoiceGenerationOptions
): Promise<VoiceWithTimestamps> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: opts.text,
        model_id: opts.modelId ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: opts.stability ?? 0.5,
          similarity_boost: opts.similarityBoost ?? 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs with-timestamps error: ${await response.text()}`);
  }

  const data = (await response.json()) as { audio_base64?: string; alignment?: VoiceAlignment };
  if (!data.audio_base64) throw new Error("ElevenLabs returned no audio_base64");
  return {
    audio: Buffer.from(data.audio_base64, "base64"),
    alignment: data.alignment ?? null,
  };
}

export async function getVoices(): Promise<{ voice_id: string; name: string }[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  const data = await response.json();
  return data.voices ?? [];
}
