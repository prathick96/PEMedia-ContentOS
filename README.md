# ContentOS — PEMedia Autonomous Content Empire

> Command-and-control dashboard for an AI-powered content production system targeting $5,000 MRR through YouTube, TikTok, and adjacent monetization.

## What This Is

ContentOS is the dashboard and agent orchestration layer for PEMedia. It autonomously:
- Finds trending topics in 5 niches (Tech, History, Movies, Sports, News)
- Generates scripts, voiceovers, and videos using AI
- Publishes to YouTube and TikTok on a human-like schedule
- Monitors analytics and adapts strategy continuously

Built by a solo operator. Designed for steady compounding growth, not viral spikes.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in at minimum: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to the CEO Dashboard.

## Phase 0 (Current)

The dashboard shell is built. No live APIs yet. All pages show empty states with clear CTAs for what comes next.

**Next steps:**
1. Create Supabase project → run `supabase/migrations/001_initial.sql`
2. Get Anthropic API key → add to `.env.local`
3. Trigger Creative Agent for Tech + History niches → channels get names and series
4. Produce first 3 videos manually → validate niche before automating

## Architecture

```
6 AI Agents:
  CEO Agent        — orchestrator, runs daily at 8am
  Scout Agent      — trend intelligence, feeds CEO
  Creative Agent   — brand/channel identity from niche name
  Production Agent — script → voice → video → thumbnail
  Publisher Agent  — YouTube + TikTok upload via official APIs
  Analytics Agent  — performance monitor, weekly report to CEO
```

See [CLAUDE.md](./CLAUDE.md) for full architecture documentation.

## Tech Stack

- **Next.js 16** (App Router + TypeScript)
- **Tailwind CSS** (utility-first, dark theme)
- **Supabase** (PostgreSQL + Realtime + Storage)
- **BullMQ + Upstash Redis** (agent job queue)
- **Anthropic Claude claude-sonnet-4-6** (all agent intelligence)
- **ElevenLabs** (AI voice generation)
- **YouTube Data API v3** + **TikTok Content Posting API**

## Integrated Tools

- **superpowers** (obra/superpowers) — 12 development skills in `.claude/skills/`
- **claude-mem** (thedotmack/claude-mem) — persistent memory: `npx claude-mem install`
- **awesome-claude-code** (hesreallyhim/awesome-claude-code) — reference resource

## Revenue Target

$5,000 MRR in 13–18 months. Millionaire pace from steady compounding, not viral shortcuts.

| Month | Revenue Target |
|-------|---------------|
| 1–2 | $0 (building) |
| 3–4 | $50–200 |
| 5–6 | $200–600 |
| 7–9 | $500–1,500 |
| 10–12 | $1,500–3,500 |
| 13–18 | **$5,000+** |
