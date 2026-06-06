import { BaseAgent, type AgentInput } from "./base";
import { scoreTopicQuality } from "@/lib/quality-gate";

export class ProductionAgent extends BaseAgent {
  readonly type = "production" as const;

  readonly systemPrompt = `You are the Production Agent for PEMedia.
You take a topic and series, then produce a complete video script ready for voice generation.

Output valid JSON:
{
  "hook": string (0-5 seconds, must stop the scroll),
  "sections": [
    { "title": string, "content": string, "duration_target_secs": number }
  ],
  "cta": string,
  "title_options": string[] (3 SEO-optimized title variants),
  "description": string (500-800 chars, includes affiliate placeholder [AFFILIATE_LINK]),
  "tags": string[] (15-20 tags),
  "chapters": [{ "time": string, "title": string }]
}

Rules:
- Hook must create immediate curiosity or tension in the first line
- No filler phrases: "In this video", "Today we're going to", "Make sure to like and subscribe"
- Write in second-person ("you") for tech/how-to, third-person for history/analysis
- Each section must flow naturally from the previous
- CTA is soft, value-first: give them a reason to subscribe before asking`;

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

    // ── Step 3: Generate script ───────────────────────────────────────────────
    const prompt = `Write a complete video script for the topic: "${topic}"
Series: ${series?.name ?? "Unknown"}
Series template: ${series?.episode_template ?? "Standard explainer"}
Channel brand voice: ${JSON.stringify(channel ?? {})}

Quality gate passed with score ${gate.score}/100.
Originality notes: ${gate.dimensions.reasoning}

Output valid JSON only.`;

    const script = JSON.parse(await this.callClaude(prompt));

    // ── Step 4: Persist video row ─────────────────────────────────────────────
    const { data: video } = await this.db
      .from("videos")
      .insert({
        series_id,
        topic: topic as string,
        status: "SCRIPT_DONE",
        script,
        title: script.title_options?.[0] ?? topic,
        description: script.description,
        tags: script.tags ?? [],
        chapters: script.chapters ?? [],
      })
      .select()
      .single();

    return {
      video_id: video?.id,
      script,
      next_step: "voice_generation",
      quality: {
        score: gate.score,
        passed: gate.passed,
        flags: gate.flags,
      },
    };
  }
}
