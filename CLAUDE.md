@AGENTS.md

# ContentOS — PEMedia Autonomous Content Empire

## Project Identity

**ContentOS** is the command-and-control dashboard for PEMedia — an autonomous AI-powered content production system targeting $5,000 MRR through YouTube, TikTok, and adjacent monetization streams.

- **Owner:** Solo operator (Prathick / prathick96)
- **Goal:** Steady compounding growth — not viral spikes. Path to millionaire pace.
- **Phase:** 1 (Dashboard live against Supabase; agents runnable from the UI; local-only, no auth yet)
- **Stack:** Next.js 16 + TypeScript + Tailwind + Supabase + QStash + Claude API

---

## The Six Agents

Every feature you build serves one of these agents or presents their output in the dashboard.

| Agent | Role | Trigger | Output |
|-------|------|---------|--------|
| **CEO** | Orchestrator & Strategist | Daily 8am cron + manual | Task queue dispatched to all agents |
| **Scout** | Trend Intelligence | Daily from CEO | Ranked topic briefing (top 5 per niche) |
| **Creative** | Brand Identity + Series Architecture | Once per channel launch from CEO | Full channel profile: name, series, voice, colors |
| **Production** | Script → Voice → Video → Thumbnail | Per topic from CEO | Ready-to-publish video package |
| **Publisher** | Upload + Schedule via official APIs | Per ready video from queue | Published URLs on YouTube + TikTok |
| **Analytics** | Performance monitoring + strategy | Weekly from CEO | Performance report fed back to CEO |

**Communication pattern:** CEO is the only agent that talks to all others. All others are independent and receive only what they need from CEO. Creative Agent receives only `{ niche }` — it independently generates the full channel profile and brand document.

---

## Active Niches

| Niche | Phase | CPM | Copyright Risk | Note |
|-------|-------|-----|----------------|------|
| **Tech** | 1 (Active first) | $8–15 | Low | AI tools, gadgets, code, AI news |
| **World History** | 1 (Active first) | $4–8 | None | Public domain, evergreen |
| **Movies** | 2 | $4–8 | Medium | Analysis only — no clips ever |
| **Sports** | 2 | $3–6 | High | Stats/analysis only — no footage ever |
| **Current News** | Deferred (Month 6) | $2–5 | Very High | Analysis format only |

**Hard rule:** Movies and Sports must NEVER use actual footage or clips. AI-generated visuals only. ContentID strikes are channel killers.

---

## Database Schema (Supabase / PostgreSQL)

Schema file: `supabase/migrations/001_initial.sql`

Key tables:
- `niches` — niche registry
- `channels` — YouTube/TikTok channels linked to niches
- `series` — content series within channels (4 per Tech, 4 per History, 3 per Movies, 3 per Sports)
- `videos` — full video lifecycle
- `trend_signals` — Scout Agent captured topics
- `agent_jobs` — all agent execution records with input/output/duration
- `analytics_snaps` — daily channel stats snapshots
- `video_analytics` — per-video performance data
- `revenue_entries` — all revenue streams (adsense, affiliate, sponsor, membership, product)

**Video status flow:**
`IDEA → SCRIPT_PENDING → SCRIPT_DONE → VOICE_PENDING → VOICE_DONE → VIDEO_PENDING → VIDEO_DONE → THUMBNAIL_DONE → READY → SCHEDULED → PUBLISHED → ARCHIVED`

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Framework | Next.js 16 + TypeScript | Free |
| Styling | Tailwind CSS | Free |
| Database | Supabase (PostgreSQL + Realtime) | Free (500MB) |
| Auth | NextAuth.js beta + Google OAuth | Free |
| Job Queue | BullMQ + Upstash Redis | Free (10K cmds/day) |
| LLM (agents) | Anthropic Claude claude-sonnet-4-6 | ~$0.02/script |
| Voice | ElevenLabs API | Free (10K chars/mo) → $5/mo |
| Video gen | Muapi.ai (OpenGenAI backend) | Add when funded |
| Charts | Recharts | Free |
| YouTube | Data API v3 + Analytics API | Free |
| TikTok | Content Posting API | Free |
| Stock footage | Pexels API + Pixabay API | Free |
| Trend data | SerpAPI + Reddit API | Free (100/mo) |
| Hosting | Vercel | Free tier |

---

## Environment Variables

Copy `.env.example` to `.env.local` (git-ignored).

**Phase 1 (current):** `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`; optional for live trends: `YOUTUBE_API_KEY`, `REDDIT_USER_AGENT`  
**Phase 2:** QStash keys + `CRON_ADMIN_SECRET` (deploy-time), Google OAuth vars, `ELEVENLABS_API_KEY`  
**When funded:** `MUAPI_API_KEY`, `CREATOMATE_API_KEY`

---

## Development Workflow

### Before writing any code
1. Use `/brainstorming` — design the feature (no code until spec approved)
2. Use `/writing-plans` — produce a granular implementation plan
3. Use `/using-git-worktrees` — create an isolated workspace

### While implementing
4. Use `/subagent-driven-development` or `/executing-plans`
5. Use `/test-driven-development` — failing test FIRST, always
6. Use `/requesting-code-review` after each significant task
7. Use `/verification-before-completion` before claiming anything done

### After implementing
8. Use `/finishing-a-development-branch` — merge/PR/discard

### When things break
- Use `/systematic-debugging` — root cause first, no guessing

---

## Phase 1 Scope (Current — scaffold complete)

**Done in Phase 1** (see `docs/plans/phase-1-scaffold.md`):
- All dashboard pages read live Supabase data via `lib/db/queries.ts` (server-side,
  service-role client — RLS blocks the anon key; never ship the service key client-side)
- Approvals page (human-in-the-loop queue) with approve/reject from the UI
- Agents triggerable from the UI (Scout, CEO, Analytics; Creative from the Channels page)
- Scout grounded in free live sources: Hacker News + Reddit public JSON + YouTube API
  (`lib/trends/`), with model-only fallback flagged `claude_analysis`
- All agents parse LLM output with `parseJsonResponse` (fence/prose tolerant)
- Vitest unit tests (`npm test`) + GitHub Actions CI (typecheck/lint/test/build)
- Supabase migrations 001–003 applied; niches seeded

**Out of scope for Phase 1 (Phase 2+):**
- Authentication — REQUIRED before any public deploy (see `docs/deploy/vercel.md`)
- ElevenLabs voice, video assembly, thumbnails, uploads
- YouTube/TikTok OAuth + publishing
- Supabase Realtime live updates (refresh-based for now)

---

## Key Constraints — Never Violate

1. Never use actual movie clips or sports footage — ContentID strikes kill channels
2. Always add AI disclosure labels where platforms require them
3. Never post two videos within 18 hours on the same channel
4. Post via official APIs only: YouTube Data API v3, TikTok Content Posting API, Meta Graph API (Instagram Reels + Facebook Pages)
5. YouTube requires AI labels for synthetic content in news/health/electoral categories
6. Only add paid services when revenue exists to fund them

---

## Custom Slash Commands

| Command | Purpose |
|---------|---------|
| `/agent-run <agent>` | Trigger any agent manually from terminal |
| `/trend-brief [niche]` | Get Scout Agent trend briefing |
| `/produce-video --topic --series-id` | Trigger full production pipeline |
| `/weekly-report` | Run Analytics Agent weekly report |

---

## Superpowers Skills (in `.claude/skills/`)

All 12 skills installed. Use via `/skill-name`:

`/brainstorming` · `/writing-plans` · `/executing-plans` · `/subagent-driven-development`  
`/dispatching-parallel-agents` · `/systematic-debugging` · `/test-driven-development`  
`/verification-before-completion` · `/requesting-code-review` · `/receiving-code-review`  
`/using-git-worktrees` · `/finishing-a-development-branch`

---

## claude-mem Persistent Memory

Enable full semantic memory capture across sessions:

```bash
npx claude-mem install
```

Requires: Node.js 18+, Bun runtime. After install, prior session context auto-loads in new sessions. SQLite database stored locally, git-ignored.

---

## Related Projects

- **OpenGenAI** (`C:\Users\p.manivannan\Documents\OpenGenAI`) — the AI media generation engine this system builds on. Uses Muapi.ai backend for 200+ AI models.
- **Muapi.ai** — API backend for video generation, image generation, lip sync
- **awesome-claude-code** — https://github.com/hesreallyhim/awesome-claude-code
- **superpowers** — https://github.com/obra/superpowers
- **claude-mem** — https://github.com/thedotmack/claude-mem
