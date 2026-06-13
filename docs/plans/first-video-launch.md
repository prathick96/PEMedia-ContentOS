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
