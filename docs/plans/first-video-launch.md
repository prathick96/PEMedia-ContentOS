# First Video Launch Plan — Tech Channel

> **Status:** Ready to execute · **Created:** 2026-06-14 · **Owner:** Prathick
> **Goal:** First Tech video live on YouTube within ~5 days, at $0 incremental spend,
> assembled manually. Per the README roadmap and Council Brief 001: the first 3 videos
> are manual — they validate the niche and the pipeline before any automation money is spent.
> **Guardrail (Council Brief 002):** nothing — no tooling, no OpenClaw, no Coolify —
> outranks getting this video published.

## Why manual first

Voice/video/upload automation (Phase 2–3) only pays off if the content works. Three
manual videos tell you: does the Creative Agent's brand hold up, do the Production
Agent's scripts retain viewers (>45% avg view duration is the Analytics threshold),
and which series format earns the automation investment.

## Day 0 — Launch the channel (~1–2 h, ≈$0.10 API)

1. **ContentOS → Channels → "Launch Tech channel (Creative Agent)".** The council
   gates the launch; the channel lands in `building` status.
2. **Review the brand doc** on the channel detail page (name, tagline, voice, colors,
   thumbnail style, 3–4 series). If the name is weak, reject the approval and re-run —
   cheaper to iterate now than after the YouTube channel exists.
3. **Approvals page → approve `launch_channel`.**
4. **Create the real YouTube channel** (youtube.com → Create channel) with the
   generated name + tagline. Upload avatar/banner made in Canva free using
   `brand_colors`. **Verify the channel by phone immediately** — unverified channels
   can't upload >15 min videos or custom thumbnails, and verification is instant.
5. **ElevenLabs free account** (10K chars/month ≈ 2 videos at 4–5 min). No code needed
   for video #1 — the web UI is enough. Add `ELEVENLABS_API_KEY` to `.env.local` anyway
   for Phase 2.

## Day 1 — Topic + script (~1 h, ≈$0.05 API)

6. **Trends page → Run Scout** (or use the existing signals — 15 are already captured,
   YouTube source now works too). Pick the highest-scoring topic that *you* find
   genuinely interesting — operator conviction shows in the final cut.
7. **Run Production** for that topic + a series id (from the channel page):
   `/produce-video --topic "<topic>" --series-id <uuid>` or
   `POST /api/agents/production {"topic": "...", "series_id": "..."}`.
   The quality gate scores it first (pass ≥60, hard-fails on copyright/AI-producibility);
   if it fails, take the gate's recommendations and pick the next topic.
   Output: full script on the video row (`SCRIPT_DONE`) — hook, sections, CTA,
   3 title options, description, tags, chapters.

## Day 1–2 — Voice + visuals (~3–5 h, $0)

8. **Voice:** paste the narration (hook → sections → CTA) into the ElevenLabs web UI,
   one section per generation for easier editing. Target 700–900 words ≈ 4–5 min.
9. **Visuals — tech niche priority order:**
   1. **Screen recordings** of the actual tool/product (OBS, free) — most original and
      most credible for tech; this is what beats "AI slop" channels.
   2. AI-generated stills/clips for concepts.
   3. Pexels/Pixabay b-roll as filler (keys already configured; manual download is fine).
   - **Never:** movie clips, sports footage, other channels' content. (Hard rule.)
10. **Assemble** in CapCut Desktop or DaVinci Resolve (both free): voice track down
    first → visuals matched to script sections → auto-captions → music from the
    **YouTube Audio Library only** (pre-licensed).
11. **Thumbnail:** Canva free, follow `thumbnail_style_guide` from the brand doc;
    ≤4 words of text, readable at 120px wide, matches the title you'll pick.

## Day 2–3 — Publish (manual upload, ~30 min)

12. **YouTube Studio upload** (manual — the Publisher API path is Phase 3):
    - Title: best of the script's 3 `title_options`
    - Description: from script — replace or delete `[AFFILIATE_LINK]` (Amazon
      Associates needs an account; fine to skip for video #1), paste chapters
    - Tags from script; category: Science & Technology
    - **"Altered content" disclosure: YES** (synthetic voice — this is mandatory, not optional)
    - Not made for kids · visibility: schedule for a morning slot
13. **Record reality in ContentOS:** set the video row's `youtube_id`,
    `status = 'PUBLISHED'`, `published_at` (Supabase Studio SQL editor for now —
    a dashboard edit form is a Phase 2 nicety).

## Multi-platform distribution (added 2026-06-14)

One production, five surfaces. The long-form video is the product; the vertical cut is the
distribution engine.

**Account setup (Day 0, after the name is approved):**
1. **Check the @handle on all four platforms first** (youtube.com, instagram.com, tiktok.com,
   facebook.com — 5 minutes). If it's taken anywhere, pick the next name candidate and update
   the channel row. Do this BEFORE creating any account.
2. Create: YouTube channel · Instagram **Creator** account · TikTok account ·
   Facebook **Page** (same name/handle/avatar everywhere). Creator/Page types matter —
   personal accounts can't use the posting APIs in Phase 3.

**Per video (manual until Phase 3):**
- Long-form (16:9) → YouTube
- One 30–45s vertical cut (9:16, burned-in captions, self-contained payoff, platform-neutral
  CTA) → YouTube Shorts + Instagram Reels + TikTok + Facebook Reels — same file, four uploads
- AI-disclosure: YouTube "altered content" = YES; TikTok AI-generated label = ON; mention
  AI narration in IG/FB caption
- The 18-hour rule applies per channel per platform, not across platforms — same-day
  cross-posting of the same video is fine

**Cross-promo rule — 1 in every 5 shorts (added 2026-06-14):**
The short is the distribution engine; the long-form is the product. But ending *every*
short with "watch the full video on YouTube" reads as spam and suppresses reach. So only
**1 short in every 5** ends with a ~5-second spoken CTA driving viewers to the YouTube
long-form ("Want the full breakdown? The complete video is on YouTube — search <Channel>.").
The other 4 are fully self-contained.
- The rule is deterministic and automatic: the Production Agent counts the channel's prior
  shorts and flags every 5th one (`cross_promo_youtube = true` on the short's video row;
  `shouldCrossPromote()` in `lib/agents/distribution.ts`).
- The promo short's narration is generated **with the 5s tail already appended** — in the
  Production output it's `script.short_cut.tts_narration`. For the other four, that field is
  just the self-contained narration. So the editor never decides this by hand; paste whatever
  `tts_narration` says.
- The CTA is platform-neutral (names the channel, points to YouTube, "link in description") —
  the identical audio plays on all four surfaces, so it can't say "below" or "in bio".

**Phase 3 automation note:** posting APIs are YouTube Data API v3, TikTok Content Posting
API, and Meta Graph API (Instagram Reels + Facebook Pages — requires a Meta app + Business
verification; start that approval process early, it takes days–weeks). Migrations
`004_platforms.sql` (IG/FB channels + per-platform post ids) and `005_shorts.sql` (shorts as
their own distribution rows: `is_short`, `parent_video_id`, `cross_promo_youtube`) extend the
schema for this — **apply both in the Supabase SQL editor after 001–003.**

## Best-in-class scripting / voice / video (Production Agent output)

`POST /api/agents/production` (or `/produce-video`) now returns one package that drives the
entire manual workflow below. The quality gate scores the topic first (pass ≥60); on pass the
agent emits a long-form 16:9 script **and** the 9:16 short cut in a single call. Fields on
`script` (the `videos.script` JSON), and how the manual editor uses each:

**Script → screen / editor:**
- `hook` — the literal first 0–5s. If it doesn't open a curiosity loop, reject and re-run.
- `sections[]` — each beat carries: `narration` (exact spoken words), `duration_target_secs`,
  `visual_direction` (screen-rec vs AI still vs stock), `broll_keywords` (paste into Pexels/
  Pixabay), `ai_image_prompts` (paste into the AI image/video generator, 16:9), `on_screen_text`.
- `chapters`, `title_options` (pick 1 of 3), `description` (replace/delete `[AFFILIATE_LINK]`),
  `tags`.

**Voice (ElevenLabs):**
- `tts_narration` is the full hook → sections → CTA as one TTS-ready string — paste it straight
  in (or section-by-section for easier re-takes). It contains no markdown or stage directions.
- `voice_direction` gives `style`, `pace`, and concrete `elevenlabs_settings`
  (`stability`, `similarity_boost`) — set those sliders to match. `per_section_notes` flags
  where to emphasise / pause.

**Visuals:** work top-down per section — screen recording first (most credible for tech),
then `ai_image_prompts`, then `broll_keywords` as filler. Never movie clips / sports footage /
other channels' content (hard rule).

**Thumbnail:** `thumbnail_concept` gives `composition`, `text` (≤4 words), `style_notes`, and a
ready-to-use `ai_image_prompt`. Generate it, then set text in Canva to match the chosen title.

**The vertical short:** `script.short_cut` is the 30–45s 9:16 cut — `hook` (lands with sound
off), `narration`, `captions[]` (burn these in), `ai_image_prompts` (9:16), and
`tts_narration` (paste into ElevenLabs — already includes the 5s YouTube CTA tail **iff** this
is the 1-in-5 promo short; see the cross-promo rule above). One vertical export → four uploads.

## Cadence after video #1 ("when to post")

- **Video #1: within 72 h of starting Day 0.** Speed beats polish here — a published
  imperfect video teaches more than an unpublished perfect one.
- **Then 2 per week, fixed days** (e.g., Tue + Fri mornings). Consistency is the
  algorithm signal that matters at 0 subscribers; exact hour barely matters yet.
- **Never two posts within 18 h on the same channel** (hard rule, enforced later by
  the Publisher).
- After **3 videos / ~2 weeks**: compare avg view duration per video (target >45%),
  CTR, and pick the winning series. That decision gates Phase 2 spending (ElevenLabs
  Starter at first $50 affiliate revenue, per the revenue-unlock ladder).

## Cost summary

| Item | Cost |
|---|---|
| Creative launch + Production script (Claude) | ≈ $0.15 |
| ElevenLabs voice | $0 (free tier) |
| Visuals (screen rec + Pexels + AI stills) | $0 |
| Editing (CapCut/Resolve) + thumbnail (Canva) | $0 |
| **Total for video #1** | **≈ $0.15** |

## Explicitly NOT in this plan

- No new code or integrations (OpenClaw, Coolify, upload APIs) until 3 videos are live
- No paid services — the revenue-unlock ladder in the Revenue page governs upgrades
- No second channel until Tech shows retention signal
