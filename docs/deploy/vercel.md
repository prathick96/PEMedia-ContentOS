# Vercel Deploy Checklist — ContentOS

> **Status:** NOT yet deployed. Phase 1 runs locally.
> **HARD BLOCKER:** the app has **no authentication**. The agent API routes spend
> Anthropic credits and resolve approvals. Deploying this publicly as-is hands your
> wallet and your publish pipeline to anyone who finds the URL.

## 0. Pre-deploy blockers (must do first)

- [ ] **Add auth.** Minimum bar: NextAuth v5 Google sign-in with an email allowlist
      (`paddhu.xd96@gmail.com`), middleware/proxy protecting `/dashboard/*` and every
      `/api/*` route except `/api/queue` (QStash-signature-verified already).
      Interim alternative: a bearer-secret check on all mutating routes.
- [ ] Confirm Supabase RLS stays ON for all tables (anon key reads are already blocked;
      the dashboard reads via the service key server-side only).

## 1. Vercel project

- [ ] Import the GitHub repo into Vercel (framework auto-detects Next.js 16).
- [ ] Node 20.9+ runtime (Vercel default is fine).

## 2. Environment variables (Vercel → Settings → Environment Variables)

Phase-1 required:

| Var | Source |
|-----|--------|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase.com → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same (server-only; never expose) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` — no trailing slash |
| `YOUTUBE_API_KEY` | console.cloud.google.com (Scout trend source) |
| `REDDIT_USER_AGENT` | any descriptive string, e.g. `contentOS/1.0` |

Cron + queue (needed for the daily CEO run):

| Var | Source |
|-----|--------|
| `QSTASH_TOKEN` | upstash.com → QStash → API Keys |
| `QSTASH_CURRENT_SIGNING_KEY` | upstash.com → QStash → Signing Keys |
| `QSTASH_NEXT_SIGNING_KEY` | same |
| `CRON_ADMIN_SECRET` | `openssl rand -base64 32` |

## 3. Register the daily CEO cron (after first deploy)

```bash
curl -X POST https://<your-app>.vercel.app/api/admin/schedule \
     -H "Authorization: Bearer $CRON_ADMIN_SECRET"
```

Verify with GET on the same URL. The schedule fires daily 08:00 UTC at `/api/queue`
(QStash-signed, idempotent schedule id `ceo-daily-orchestration`).

## 4. Known platform limits (plan around these)

- **Function timeout:** CEO runs convene the council (~7 sequential/parallel Claude
  calls) and can exceed Vercel Hobby's limit. Pro (~300s) is enough for CEO/Scout.
  Real video production (voice + render) will NOT fit serverless — that's the
  Coolify VPS trigger per Council Brief 002 (provision when Production goes live).
- **QStash free tier:** 500 messages/day — far above current needs.

## 5. Post-deploy verification

- [ ] `/` redirects to `/dashboard`, Overview shows live KPIs.
- [ ] Settings page shows all required keys "set".
- [ ] Trigger Scout from the Trends page → signals appear, `agent_jobs` row completed.
- [ ] `GET /api/admin/schedule` (with bearer) shows the cron registered.
- [ ] Next morning: CEO job appears in `agent_jobs` with `triggered_by: "cron"`.
