import { BaseAgent, type AgentInput } from "./base";
import { scoreTopicQuality } from "@/lib/quality-gate";
import { parseJsonResponse } from "@/lib/anthropic";
import { ensureTtsNarration } from "./script-utils";
import { buildDistributionPlan, buildShortNarration, shouldCrossPromote } from "./distribution";
import type { VideoScript } from "@/lib/db/schema";

export class ProductionAgent extends BaseAgent {
  readonly type = "production" as const;

  readonly systemPrompt = `You are the Production Agent for PEMedia — a faceless, AI-produced content empire.
You take ONE topic and series and return a single, complete, production-ready package: a long-form
16:9 script AND the 9:16 vertical short cut derived from it. Every asset must be produceable with
synthetic voice + AI visuals + screen recordings + stock b-roll — no on-camera talent, no licensed footage.

Output VALID JSON only — no markdown, no commentary. Match this exact shape:
{
  "hook": string,                          // 0–5s. A specific claim, tension, or open loop. NOT "In this video".
  "sections": [
    {
      "title": string,                     // internal label for the beat
      "narration": string,                 // EXACT words spoken — clean prose, no markdown, no stage directions, TTS-ready
      "duration_target_secs": number,      // realistic at ~150 wpm
      "visual_direction": string,          // HOW to source visuals: "screen recording of X" | "AI 16:9 still" | "stock b-roll"
      "broll_keywords": string[],          // 2–4 concrete Pexels/Pixabay search terms (only if stock is used)
      "ai_image_prompts": string[],        // 1–2 detailed, style-consistent cinematic prompts for an AI image/video model, framed 16:9
      "on_screen_text": string             // short overlay text for this beat, or "" if none
    }
  ],
  "cta": string,                           // soft, value-first; give a reason to subscribe before asking
  "title_options": string[],              // exactly 3 SEO + curiosity titles, <=60 chars, no clickbait lies
  "description": string,                   // 500–800 chars, value summary + [AFFILIATE_LINK] placeholder
  "tags": string[],                        // 15–20 tags, specific-to-broad
  "chapters": [{ "time": string, "title": string }],   // "0:00" style; first chapter starts at 0:00
  "voice_direction": {
    "style": string,                       // e.g. "confident, dry, lightly amused"
    "pace": string,                        // e.g. "brisk with deliberate pauses before payoffs"
    "elevenlabs_settings": { "stability": number, "similarity_boost": number },  // 0–1
    "per_section_notes": string[]          // optional emphasis/pacing notes aligned to sections
  },
  "thumbnail_concept": {
    "composition": string,                 // subject placement, focal point, contrast plan
    "text": string,                        // <=4 words, readable at 120px wide
    "style_notes": string,                 // palette usage from brand colors, recurring motif
    "ai_image_prompt": string              // ready-to-use 16:9 prompt that renders the composition
  },
  "short_cut": {
    "hook": string,                        // 0–1s. Must land with sound OFF (captions carry it)
    "narration": string,                   // 30–45s of spoken words for the vertical; self-contained payoff
    "captions": string[],                  // burned-in on-screen text beats, in order
    "duration_target_secs": number,        // 30–45
    "visual_direction": string,            // reframed long-form b-roll or fresh 9:16 AI visuals
    "broll_keywords": string[],
    "ai_image_prompts": string[],          // framed 9:16 (vertical)
    "cta": string                          // platform-neutral ("never subscribe below" — it posts to 4 apps)
  }
}

CRAFT RULES — this is what separates a retained viewer from a swipe:
- HOOK: open a loop the brain needs closed. State a stake, a number, a contradiction, or a "you're doing X wrong".
  Banned openers: "In this video", "Today we're going to", "Let's talk about", "Have you ever".
- RETENTION: every section must escalate or pay off the hook's loop; re-hook every ~30s with a new micro-question.
  No filler ("as you can see", "without further ado"). Cut any sentence that doesn't add information or momentum.
- VOICE: write in the channel's brand voice. Second person ("you") for tech/how-to; third person for history/analysis.
  A blind reader must be able to tell this channel's script from generic narration.
- NARRATION is literally what the TTS speaks: expand symbols/numbers to spoken form, no headings, no "[pause]" markers
  (encode pacing in voice_direction/per_section_notes instead), no URLs read aloud.
- THE SHORT is the distribution engine, the long-form is the product. The short is NOT a trailer — it delivers a
  complete, satisfying payoff on its own, cut from the single most surprising 30–45s of the long-form. Hook in frame 1,
  captions readable with sound off, vertical 9:16 framing in every short ai_image_prompt.
- COMPLIANCE: 100% faceless + AI-producible. Movies = analysis only, never clips. Sports = stats/analysis only, never footage.
  Never depict real named people doing fabricated things. No copyrighted characters/footage/music in any prompt.`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { topic, series_id } = input;

    // ── Step 1: load series + channel context ─────────────────────────────────
    const { data: series } = await this.db
      .from("series")
      .select("*, channels(name, brand_doc, niche_id, niches(slug))")
      .eq("id", series_id)
      .single();

    // ── Step 2: Quality / Originality Gate ───────────────────────────────────
    // Runs BEFORE any script generation or video row creation.
    // A failed gate throws and the job is marked failed — no credits wasted.
    const channel = series?.channels as Record<string, unknown> | null;
    const nicheSlug =
      (channel?.niches as Record<string, unknown> | null)?.slug as string ?? "tech";

    const gate = await scoreTopicQuality({
      topic: topic as string,
      niche: nicheSlug,
      series_context: series?.episode_template ?? "",
      series_id: series_id as string | undefined,
      db: this.db,
    });

    if (!gate.passed) {
      throw new Error(
        `Quality gate FAILED (score ${gate.score}/100) — ${gate.reasons.join("; ")}` +
          (gate.dimensions.recommendations.length > 0
            ? ` | Suggestions: ${gate.dimensions.recommendations.slice(0, 2).join("; ")}`
            : "")
      );
    }

    // ── Step 3: Generate the full long-form + short package ───────────────────
    const prompt = `Write the complete production package for the topic: "${topic}"
Series: ${series?.name ?? "Unknown"}
Series format/template: ${series?.episode_template ?? "Standard explainer"}
Channel brand (name, voice, colors, persona): ${JSON.stringify(channel ?? {})}

Quality gate passed with score ${gate.score}/100.
Originality notes: ${gate.dimensions.reasoning}

Produce both the long-form script and the 9:16 short_cut. Output valid JSON only.`;

    // The full package (long-form + short cut + voice/visual/thumbnail prompts) is
    // large. generateText streams, so this is safe up to the model cap (Sonnet 64K);
    // 32K gives ample headroom for longer scripts. It's a ceiling — we're billed
    // only for tokens actually generated, so the larger budget costs nothing extra.
    const script = ensureTtsNarration(
      parseJsonResponse<VideoScript>(await this.callClaude(prompt, { maxTokens: 32000 }))
    );

    // ── Step 4: Resolve the 1-in-5 cross-promo for this channel's short ────────
    // Over-promoting the long-form on every short suppresses reach; only every
    // 5th short carries the 5s spoken CTA to YouTube. Count is per channel.
    const channelId = series?.channel_id as string | undefined;
    const channelName = (channel?.name as string) ?? "";
    const priorShortCount = await this.countChannelShorts(channelId);
    const crossPromote = shouldCrossPromote(priorShortCount);

    if (script.short_cut?.narration) {
      // Bake the operator-ready short narration (with promo tail when 1-in-5) back
      // into the long-form package so the manual editor can use it as-is.
      script.short_cut.tts_narration = buildShortNarration(script.short_cut, {
        crossPromote,
        channelName,
      });
    }

    // ── Step 5: Persist the long-form video row ───────────────────────────────
    const { data: video } = await this.db
      .from("videos")
      .insert({
        series_id,
        topic: topic as string,
        status: "SCRIPT_DONE",
        script,
        title: script.title_options?.[0] ?? (topic as string),
        description: script.description,
        tags: script.tags ?? [],
        chapters: script.chapters ?? [],
      })
      .select()
      .single();

    // ── Step 6: Materialise the vertical short as its own distribution row ─────
    // Wrapped so a missing migration 005 / insert error degrades gracefully —
    // the long-form still succeeds and the operator can produce it.
    const short = await this.createShortRow({
      script,
      crossPromote,
      seriesId: series_id as string,
      parentVideoId: video?.id as string | undefined,
      topic: topic as string,
    });

    return {
      video_id: video?.id,
      short_video_id: short.id,
      script,
      cross_promo_youtube: crossPromote,
      distribution: buildDistributionPlan(crossPromote),
      next_step: "voice_generation",
      quality: {
        score: gate.score,
        passed: gate.passed,
        flags: gate.flags,
      },
      ...(short.error ? { short_warning: short.error } : {}),
    };
  }

  /** Count vertical shorts already produced across all series of a channel. */
  private async countChannelShorts(channelId: string | undefined): Promise<number> {
    if (!channelId) return 0;
    const { data: chSeries } = await this.db
      .from("series")
      .select("id")
      .eq("channel_id", channelId);
    const seriesIds = (chSeries ?? []).map((s: { id: string }) => s.id);
    if (seriesIds.length === 0) return 0;
    const { count } = await this.db
      .from("videos")
      .select("id", { count: "exact", head: true })
      .in("series_id", seriesIds)
      .eq("is_short", true);
    return count ?? 0;
  }

  /**
   * Create the short's video row from the long-form package's `short_cut`.
   * Returns the new id, or an error string if there was no short or the insert
   * failed (e.g. migration 005 not yet applied) — never throws.
   */
  private async createShortRow(args: {
    script: VideoScript;
    crossPromote: boolean;
    seriesId: string;
    parentVideoId: string | undefined;
    topic: string;
  }): Promise<{ id?: string; error?: string }> {
    const cut = args.script.short_cut;
    if (!cut?.narration) return { error: "model omitted short_cut — no vertical short created" };

    const shortScript: VideoScript = {
      hook: cut.hook,
      sections: [],
      cta: cut.cta ?? "",
      title_options: args.script.title_options ?? [args.topic],
      description: args.script.description ?? "",
      tags: args.script.tags ?? [],
      chapters: [],
      tts_narration: cut.tts_narration ?? cut.narration,
      short_cut: cut,
    };

    try {
      const { data, error } = await this.db
        .from("videos")
        .insert({
          series_id: args.seriesId,
          topic: `${args.topic} — vertical short`,
          status: "SCRIPT_DONE",
          script: shortScript,
          title: args.script.title_options?.[0] ?? args.topic,
          tags: args.script.tags ?? [],
          is_short: true,
          parent_video_id: args.parentVideoId,
          cross_promo_youtube: args.crossPromote,
        })
        .select()
        .single();
      if (error) return { error: `short row insert failed: ${error.message}` };
      return { id: data?.id };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
