import { BaseAgent, type AgentInput } from "./base";
import { refineTopicUntilPass, summariseAttempts } from "@/lib/quality-gate/refine";
import { parseJsonResponse } from "@/lib/anthropic";
import { ensureTtsNarration } from "./script-utils";
import { checkScriptLength, lengthRevisionNote } from "./script-length";
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

LENGTH & STRUCTURE — non-negotiable targets (the package is rejected and regenerated if missed):
- LONG-FORM total spoken narration (hook + all section narration + cta) = 900–1200 words → 6–8 minutes at ~150 wpm.
  Distribute as ~5–8 sections. Do NOT pad to fill time and do NOT overshoot — every word earns its place.
- SHORT (short_cut.narration) = 75–100 words → 30–40 seconds. A self-contained payoff, not a trailer.
- EVERY video (long AND short) must be built as three parts:
    (1) HOOK — a tension/stake/open loop in the first 5s,
    (2) CONTENT — escalating payoff that delivers on the hook,
    (3) ENDING — a distinct, retention-driving close that lands the payoff and earns the follow (NOT a flat "subscribe").

CRAFT RULES — this is what separates a retained viewer from a swipe:
- HOOK: open a loop the brain needs closed. State a stake, a number, a contradiction, or a "you're doing X wrong".
  Banned openers: "In this video", "Today we're going to", "Let's talk about", "Have you ever".
- RETENTION: every section must escalate or pay off the hook's loop; re-hook every ~30s with a new micro-question.
  No filler ("as you can see", "without further ado"). Cut any sentence that doesn't add information or momentum.
- ENDING: the cta (long-form) and short_cut.cta (short) ARE the ending beat — make them a satisfying button that
  rewards finishing and gives a concrete reason to follow, not a generic sign-off.
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

    // ── Step 2: Quality Gate WITH regeneration loop ──────────────────────────
    // Runs BEFORE any script generation or video row creation. A failing topic
    // isn't a dead end: the gate's own reasoning + recommendations are fed to the
    // Topic Editor, which reframes to a sharper angle, then re-scores — bounded by
    // maxAttempts. The threshold never moves; this raises the quality of what gets
    // produced, it doesn't lower the bar. Only a topic that PASSES proceeds.
    const channel = series?.channels as Record<string, unknown> | null;
    const nicheSlug =
      (channel?.niches as Record<string, unknown> | null)?.slug as string ?? "tech";

    const refinement = await refineTopicUntilPass({
      topic: topic as string,
      niche: nicheSlug,
      series_context: series?.episode_template ?? "",
      series_id: series_id as string | undefined,
      db: this.db,
      maxAttempts: 3,
    });

    if (!refinement.passed) {
      const v = refinement.verdict;
      throw new Error(
        `Quality gate FAILED after ${refinement.attempts.length} attempt(s) — best ${v.score}/100. ` +
          `${v.reasons.join("; ")}` +
          (v.dimensions.recommendations.length > 0
            ? ` | Try: ${v.dimensions.recommendations.slice(0, 2).join("; ")}`
            : "") +
          ` | Trail: ${summariseAttempts(refinement.attempts)}`
      );
    }

    // The topic that actually passed — may be a reframe of the original. Everything
    // downstream (script, rows, titles) is built from this, not the original input.
    const productionTopic = refinement.topic;
    const gate = refinement.verdict;
    const wasReframed = productionTopic !== (topic as string);

    // ── Step 3: Generate the full long-form + short package ───────────────────
    const prompt = `Write the complete production package for the topic: "${productionTopic}"
Series: ${series?.name ?? "Unknown"}
Series format/template: ${series?.episode_template ?? "Standard explainer"}
Channel brand (name, voice, colors, persona): ${JSON.stringify(channel ?? {})}

Quality gate passed with score ${gate.score}/100.
Originality notes: ${gate.dimensions.reasoning}

Produce both the long-form script and the 9:16 short_cut. Output valid JSON only.`;

    // Generate the package, validating LENGTH + STRUCTURE (6–8 min long-form, 30–40s
    // short, hook + content + ending). The model tends to overshoot, so a failing draft
    // is re-generated once with the concrete word-count miss fed back. generateText
    // streams (safe to the model cap); 32K is a ceiling, billed only on real output.
    let script = ensureTtsNarration(
      parseJsonResponse<VideoScript>(await this.callClaude(prompt, { maxTokens: 32000 }))
    );
    let lengthCheck = checkScriptLength(script);
    if (!lengthCheck.ok) {
      const revised = ensureTtsNarration(
        parseJsonResponse<VideoScript>(
          await this.callClaude(`${prompt}\n\nREVISION REQUIRED: ${lengthRevisionNote(lengthCheck)}`, {
            maxTokens: 32000,
          })
        )
      );
      // Keep the revision only if it's actually closer to spec; otherwise keep the first.
      const revisedCheck = checkScriptLength(revised);
      if (revisedCheck.ok || revisedCheck.issues.length < lengthCheck.issues.length) {
        script = revised;
        lengthCheck = revisedCheck;
      }
    }

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
        topic: productionTopic,
        status: "SCRIPT_DONE",
        script,
        title: script.title_options?.[0] ?? productionTopic,
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
      topic: productionTopic,
    });

    return {
      video_id: video?.id,
      short_video_id: short.id,
      script,
      // Topic provenance — the original input vs. what actually got produced.
      topic: productionTopic,
      original_topic: topic as string,
      reframed: wasReframed,
      refine_attempts: refinement.attempts.length,
      cross_promo_youtube: crossPromote,
      distribution: buildDistributionPlan(crossPromote),
      next_step: "voice_generation",
      quality: {
        score: gate.score,
        passed: gate.passed,
        flags: gate.flags,
      },
      // Length/structure outcome — long ≈6–8 min, short ≈30–40s (see script-length).
      length: {
        long_words: lengthCheck.longWords,
        short_words: lengthCheck.shortWords,
        est_long_secs: lengthCheck.estLongSecs,
        est_short_secs: lengthCheck.estShortSecs,
        on_target: lengthCheck.ok,
        ...(lengthCheck.issues.length > 0 ? { issues: lengthCheck.issues } : {}),
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
