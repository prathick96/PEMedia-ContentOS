# Council Brief 003 — The Autonomous YouTube Pipeline (Step 1)

> **Convened:** 2026-06-14 · **Mode:** strategic · **Decision owner:** Prathick
> **Question:** Architect a high-quality, durable, autonomous YouTube-first pipeline
> (Scout → Analytics → CEO → Creative → Production → **QA Reviewer (new)** → Publisher),
> create-and-post to one existing channel as Step 1. Resolve: (1) hands-off auto-publish vs
> human-in-the-loop; (2) the operator's request to "bury the AI thumbprint to avoid YouTube
> flagging"; (3) true autonomy on a ~$0 budget with no video-assembly layer yet; (4) where the
> QA gate sits and what it enforces.

This brief was produced by running the council seats' mandates directly (the live `/api/council`
route does the same when the dev server is up; rerun it to persist a `council_decisions` row).

---

## Seat opinions

**Strategist** — Concentrate on one excellent channel. The moat is a recognizable editorial
voice and a ranking back-catalog, not the pipeline. Ship Step 1 end-to-end on one channel before
generalizing. *Confidence 0.8.* Risk: chasing full automation before the content proves out wastes
the operator's scarcest resource — attention.

**Growth** — Distribution beats production. Long-form on YouTube is where RPM lives; shorts are the
discovery funnel (the 1-in-5 cross-promo is correct). Auto-publishing *consistently* matters more
than auto-publishing *instantly* — cadence is the algorithm signal at 0 subs. *Confidence 0.75.*
Risk: a hands-off pipeline that ships slop kills the channel faster than slow manual quality.

**Risk & Compliance (veto seat)** — **Hiding AI provenance is a hard NO.** YouTube's 2026 policy
*requires* disclosure of realistic synthetic media; undisclosed synthetic content that's caught =
Partner Program suspension. The thing that actually gets AI channels removed is the *inauthentic /
mass-produced content* policy — defended by genuine quality + variety + a human in the loop, not by
concealment. Do **not** ship a single fully-hands-off upload before QA + human approval have a track
record. *Confidence 0.9.* This seat blocks any "evade detection" design.

**Finance** — True autonomy is **not** free: there is no render layer yet, and human-like voice +
visuals + stitching cost something. But it's cheap. Stay on free tiers (ElevenLabs free, Pexels/
Pixabay, YouTube Audio Library, self-hosted ffmpeg/Remotion) until revenue funds the next tier.
Minimum viable spend to go autonomous: **$0–5/mo** (ElevenLabs Starter only when free credits run
out). Never pre-fund capacity ahead of demand. *Confidence 0.8.*

**Tech & Production** — The QA Reviewer is the linchpin: a programmatic gate that scores the
*finished package* and blocks slop *before* the Publisher, so we can earn our way to hands-off.
Build it first (done — `lib/qa-review`). The missing layers are voice render, visual generation,
stitch/render, and YouTube OAuth+upload. Sequence them; don't boil the ocean. *Confidence 0.8.*

---

## Chairman synthesis — the decision

**Build a *supervised*-autonomous pipeline for one channel, earn your way to hands-off, and never
hide AI.** Decisively:

1. **Disclosure is non-negotiable (Risk veto upheld).** We do **not** evade YouTube's AI detection
   or compliance. The "human touch" is reinterpreted as: humanized voice, real editorial variety, a
   QA gate that rejects slop, and human sign-off — *plus* honest AI disclosure, which **protects**
   the channel from strikes. The QA Reviewer scores `compliance_disclosure` such that any attempt to
   conceal provenance is a **hard fail → reject**, never a reward.

2. **Autonomy is staged, not a switch.** The pipeline runs end-to-end automatically *up to* the
   Publisher; the existing human publish-approval stays **ON** for every upload until the QA Reviewer
   has a clean track record (target: ~10 consecutive human-approved `auto_publish` verdicts on the
   channel). Then we let `auto_publish` skip the human gate while `needs_human_review` / `reject`
   still pause. This is the safe path to the operator's zero-touch goal.

3. **QA Reviewer placement.** Production (script + assets) → **QA Reviewer** → READY → Publisher. It
   enforces, on a finished package: hook, retention, **human-ness of narration**, **originality**
   (anti-inauthentic-content), thumbnail, metadata, the vertical short, **AI-disclosure integrity**,
   and **copyright safety**. Thresholds: ≥78 auto_publish · 58–78 human review · <58 reject. Hard
   fails: compromised disclosure, copyright exposure. (Shipped: `lib/qa-review/*`,
   `lib/agents/qa-reviewer.ts`, migration `006`.)

4. **Copyright-safe asset path (the cheapest that won't get videos removed):**
   - **Voice:** ElevenLabs (free 10k chars/mo → $5 Starter). Pick a warm, non-robotic voice; tune
     `voice_direction` (stability/similarity) per script. Human-like ≠ undisclosed.
   - **Music:** **YouTube Audio Library only** (pre-licensed) — zero ContentID risk. Never use
     "free" music from elsewhere without a license.
   - **Visuals:** AI-generated stills/clips + screen recordings (most credible for tech) + Pexels/
     Pixabay (CC0). **Never** real movie/sports footage or other channels' content.
   - **Thumbnails:** AI-generated from `thumbnail_concept.ai_image_prompt`, text set in Canva.

5. **Step 1 is buildable now**, in this order (see roadmap).

**Preserved dissent (Risk):** do not flip *any* upload to hands-off until QA has earned it; one bad
autonomous upload can suspend the account that funds everything.

---

## Roadmap — to autonomous create-and-post (one channel)

| # | Capability | Status | Notes |
|---|-----------|--------|-------|
| 0 | Script + 9:16 short package (Production) | ✅ done | best-in-class prompt, voice_direction, thumbnail_concept |
| 1 | **QA Reviewer gate** | ✅ done | `lib/qa-review`, agent, migration 006 |
| 2 | **YouTube OAuth connect** (this channel) | ✅ built | `lib/youtube.ts`, `/api/auth/youtube/{connect,callback}`, migration 007; live consent pending operator |
| 3 | Voice render (ElevenLabs) | ✅ built | `lib/render/voice.ts` — full-narration TTS in the render pipeline |
| 4 | Render/stitch → MP4 | ✅ v1 | `lib/render/*` + `/api/render`: brand-color bg + word-timed burned captions via ffmpeg; 16:9 long-form + 9:16 short. AI/stock b-roll = upgrade |
| 5 | Thumbnail image generation | ⏳ | from `thumbnail_concept` (needs an image-gen provider) |
| 6 | **YouTube resumable upload** | ✅ built | `uploadVideo()` + `/api/youtube/test-upload`; wire into Publisher next |
| 7 | Vertical short export + IG/FB cross-post | ⏳ | Meta Graph API (start Business verification now) |
| 8 | Pipeline orchestration (QStash cron) | ⏳ | Scout→…→QA→Publisher, human approval gate between QA and live |

Earn hands-off (step 2→ auto_publish) only after QA's track record clears the bar in §2.

## Render layer v1 — how to run it

`POST /api/render { "video_id": "<uuid>", "include_short": true }` turns a video row's script
into an MP4 (stored on `video_url`, status → `VIDEO_DONE`), ready for the Publisher's upload.

**What v1 produces:** ElevenLabs narration over a brand-colored background with word-timed,
burned-in captions, assembled by ffmpeg — 16:9 long-form + an optional 9:16 short. Fully
autonomous, free-tier, copyright-safe (no third-party footage or music). It is deliberately
minimal; stock/AI b-roll and music are the next upgrade (the engine is built to slot them in).

**Prerequisites (operator, once):**
1. **Install ffmpeg** (includes ffprobe) and ensure both are on PATH — verify with `ffmpeg -version`.
2. **ElevenLabs:** add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` to `.env.local` (pick a warm,
   non-robotic voice in ElevenLabs → Voices; copy its id). Restart the dev server.
3. Background color comes from the channel's `brand_doc.brand_colors.primary` automatically.

**Pipeline position:** Production (script) → **`/api/render` (this)** → QA Reviewer → Publisher.
Output `video_url` is the local file path the Publisher's `uploadVideo` reads.

**v1 limitations (tracked):** captions are scene-level proportional, not word-synced (upgrade:
ElevenLabs timestamp API); visuals are color cards, not b-roll; no background music.

---

## How to connect your YouTube account (capability #2)

This is the unlock for autonomous upload. **Start it now — the sensitive-scope step has lead time.**

**A. Google Cloud (once):**
1. console.cloud.google.com → create a project (e.g. "PEMedia ContentOS").
2. APIs & Services → Library → enable **YouTube Data API v3**.
3. OAuth consent screen → **External** → fill app name/email → add **your Google account as a Test
   user**. Scopes to add: `…/auth/youtube.upload`, `…/auth/youtube` (updates/thumbnails),
   `…/auth/youtube.readonly` (stats).
4. Credentials → Create credentials → **OAuth client ID** → type **Web application** → Authorized
   redirect URI: `http://localhost:3000/api/auth/youtube/callback` (add the Vercel URL later).
5. Copy the **Client ID** + **Client secret** into `.env.local`:
   `GOOGLE_CLIENT_ID=…` and `GOOGLE_CLIENT_SECRET=…`.

**B. Connect the channel (once the OAuth code in capability #2 is built):**
6. Visit `http://localhost:3000/api/auth/youtube/connect` → Google consent → it redirects to the
   callback, which exchanges the code for a **refresh token** and stores it (new `channel_oauth`
   table) against your channel row.
7. The Publisher then uses that refresh token server-side (no VPN, no browser) to upload via the
   YouTube Data API — fully autonomous.

**⚠️ The lead-time caveat:** while the consent screen is in **"Testing"**, Google refresh tokens for
sensitive scopes **expire after 7 days** — fine for development, not for unattended weekly posting.
For a non-expiring token you must set the app to **"In production"**, which requires Google
verification of the sensitive `youtube.upload` scope (privacy-policy URL + a few days' review). Begin
this in parallel with the same urgency as Meta Business verification.

---

## What we will NOT do
- Conceal, obfuscate, or strip AI disclosure to evade detection. (Risk veto — channel-killer.)
- Flip any upload to fully hands-off before QA earns the track record in §2.
- Pre-fund paid services ahead of revenue (Finance).
- Real movie/sports footage or unlicensed music — ever (ContentID).
