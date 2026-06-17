# Phase 1 Scaffold — Implementation Plan

> **Status:** ✅ Complete (2026-06-13) · **Owner:** Prathick (solo operator)
> **Goal:** ContentOS runs locally against live Supabase: every dashboard page shows real
> data, agents are triggerable from the UI, the human-approval loop has a UI, Scout uses
> real (free) trend sources, and the repo has tests + CI + a deploy checklist.

## Decisions (operator-confirmed 2026-06-13)

| Decision | Choice |
|----------|--------|
| Auth | **None this phase.** App is localhost-only. Auth is a hard blocker on the deploy checklist — the agent APIs spend money and approve publishes. |
| Deploy target | **Local dev, deploy-ready.** Verified Vercel checklist produced, no deploy this session. |
| Live smoke test | **Approved.** Scout + CEO end-to-end against live Supabase + Anthropic (cents). |
| Trend data | **No Reddit OAuth needed.** Use keyless/free sources: Hacker News (Algolia, no key), Reddit public JSON (no key, just User-Agent), YouTube Data API (key already in `.env.local`). SerpAPI optional later. |

### Why not Reddit OAuth / SerpAPI?
Reddit's public `*.json` endpoints (e.g. `reddit.com/r/history/top.json?t=week`) need no
credentials at low request rates — only a descriptive User-Agent, which is already in
`.env.local`. Hacker News' Algolia API is fully open. YouTube's `mostPopular` +
`search` endpoints are free (10k units/day) and the key is already configured. That
covers all five niches at $0 with no new accounts. SerpAPI (100 searches/mo free) can be
added later purely as an enrichment source — it is not on the critical path.

## Found-state summary (review of 2026-06-13)

- All 6 agents, council, quality gate, approvals, QStash queue: **implemented**.
- Supabase: migrations 001–003 **applied**, niches **seeded** (verified live).
- RLS blocks the anon key → all dashboard reads must use the **server client** in
  server components. Never ship the service key to the browser.
- `node_modules` absent — app never ran on this machine.
- Dashboard pages: static placeholders. No approvals UI at all.
- No tests, no CI. Agents use brittle `JSON.parse` instead of the robust
  `parseJsonResponse` that already exists in `lib/anthropic.ts`.
- `.env.local` missing: `NEXT_PUBLIC_APP_URL`, QStash keys (deploy-time only),
  `CRON_ADMIN_SECRET` (deploy-time only).

## Milestones

### A — Make it run
- [x] `npm install` clean
- [x] Read `node_modules/next/dist/docs/` (AGENTS.md mandate — Next 16 breaking changes)
- [x] `npm run build` green; fix any type/route-handler API drift
- [x] Add `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env.local`
- [x] Dev server boots; `/` → `/dashboard`

### B — Data layer
- [x] `lib/db/queries.ts`: typed server-side read helpers (stats, jobs, videos-by-status,
      trends, channels+series, approvals, revenue, schedule, council log, gate results)
- [x] All dashboard pages render dynamically (no stale cache)

### C — Wire every page to live data (empty states preserved)
- [x] **Overview**: live KPIs, latest agent run per type, pending-approvals banner, niche table from DB
- [x] **Pipeline**: kanban from `videos` grouped into stage buckets
- [x] **Trends**: signals by niche, score, source badge, used/unused; Run Scout button
- [x] **Channels** + detail: channels, brand doc, series; **Series** detail: videos
- [x] **Agents**: last-run status, duration, Run buttons → `/api/agents/*`, recent job log with expandable input/output
- [x] **Approvals (new page + nav)**: pending queue, payload + council verdict, Approve/Reject → `/api/approvals`
- [x] **Revenue**: summary cards, Recharts monthly/source breakdown, entries table
- [x] **Schedule**: upcoming scheduled/published videos, 18-hour-rule guard visibility, cron status
- [x] **Settings**: env-key health (names only, never values), niche registry, phase badge

### D — Real trend sources (free tier, keyless-first)
- [x] `lib/trends/sources.ts`: Hacker News (tech), Reddit public JSON (per-niche subs), YouTube mostPopular/search (per-niche category)
- [x] `lib/trends/fetcher.ts`: aggregate with per-source graceful failure
- [x] Scout rework: ground Claude's scoring in fetched raw signals; fall back to model-only with an explicit `model_generated` flag; correct `source` values into `trend_signals`

### E — Robustness + tests + CI
- [x] All agents use `parseJsonResponse` (fence/prose tolerant) instead of `JSON.parse`
- [x] Fix `TrendSignal.source` type drift (schema.ts vs scout)
- [x] Vitest: `parseJsonResponse`, quality-gate `computeScore` + hard-fail rules, trend source mappers (mocked fetch)
- [x] `npm run typecheck` script; GitHub Actions: typecheck + lint + test + build

### F — Verify + ship
- [x] Build, lint, tests green (fresh run)
- [x] Live smoke: Scout run + CEO run via the UI → rows in `agent_jobs`, `trend_signals`, `council_decisions`
- [x] Docs: README phase status, deploy checklist `docs/deploy/vercel.md` (env vars, QStash cron, **AUTH REQUIRED warning**)
- [x] Update CLAUDE.md phase + sidebar phase badge

## Verification results (2026-06-13)

- `npm run typecheck` / `lint` / `test` (31 tests) / `build` — all green.
- All 11 dashboard routes render 200 with live Supabase data.
- **Live Scout run (tech+history):** topics grounded in real Hacker News signals; rows in
  `trend_signals` + `agent_jobs`. Wikipedia trending added mid-build as the keyless
  source for non-tech niches (data lags 1–3 days; fetcher walks back) — verified live
  for history (grounded in 2026 FIFA World Cup trending articles).
- **Live CEO run:** full council convened (2 strategic decisions persisted,
  confidence 0.86–0.87), task queue generated, `agent_jobs` completed in ~139s.
- **Bug found & fixed during smoke test:** CEO/chairman JSON truncated at the 4096
  `max_tokens` default → parse failure. Raised to 8192 for CEO + chairman calls and
  `generateText` now throws a descriptive error on `stop_reason: "max_tokens"`.
- **Source caveats found:** Reddit public JSON returns 403 from this network (kept as
  best-effort; degrades gracefully). The configured `YOUTUBE_API_KEY` is **API-restricted**
  — Google blocks `videos.list`. Operator action: enable YouTube Data API v3 for the key
  in console.cloud.google.com → APIs & Services → Credentials.

## Explicitly out of scope (Phase 2+)
- Auth (NextAuth Google) — required before any public deploy
- ElevenLabs voice, video assembly, thumbnails (Production beyond script)
- YouTube/TikTok upload, OAuth token storage
- Supabase Realtime live-updating UI (poll/refresh is fine now)
- SerpAPI enrichment, Coolify provisioning (Council Brief 002)
