# Daily CEO Orchestration Cron

The CEO Agent runs automatically every morning via an Upstash QStash schedule.
This is the autonomous heartbeat of PEMedia: each day it convenes the LLM council,
reads overnight state, and dispatches the day's task queue to the other agents.

## How it works

```
QStash schedule (0 8 * * * UTC)
      │  signed HTTP POST { agentType: "ceo", triggeredBy: "cron", input: {...} }
      ▼
POST /api/queue            ← verifies QStash HMAC signature
      │  dispatches to CeoAgent
      ▼
CeoAgent.run(input, { triggeredBy: "cron" })
      │  records agent_jobs row with triggered_by = "cron"
      ▼
council convene → daily task queue
```

The schedule reuses the existing `/api/queue` receiver — scheduled invocations are
signed with the same QStash keys, so the signature check passes with no extra wiring.

## Prerequisites

| Env var | Purpose |
|---------|---------|
| `QSTASH_TOKEN` | Create/manage the schedule |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Verify cron calls at `/api/queue` |
| `NEXT_PUBLIC_APP_URL` | **Must be the deployed public URL** — QStash cannot reach `localhost` |
| `CRON_ADMIN_SECRET` | Protects the admin endpoint below |

## Activating the cron (once, after deploy)

```bash
# Register / update the daily schedule (idempotent)
curl -X POST https://your-app.vercel.app/api/admin/schedule \
     -H "Authorization: Bearer $CRON_ADMIN_SECRET"

# Inspect current schedule status
curl https://your-app.vercel.app/api/admin/schedule \
     -H "Authorization: Bearer $CRON_ADMIN_SECRET"

# Remove the schedule
curl -X DELETE https://your-app.vercel.app/api/admin/schedule \
     -H "Authorization: Bearer $CRON_ADMIN_SECRET"
```

Registration is idempotent — it uses the fixed schedule id `ceo-daily-orchestration`,
so re-running `POST` updates the existing schedule rather than creating duplicates.

## Changing the time

Edit `CEO_CRON` in `lib/scheduling/ceo-schedule.ts` (cron is in **UTC**), then
re-run the `POST` above. Current value: `0 8 * * *` (08:00 UTC daily).

## Verifying it ran

Each cron run inserts an `agent_jobs` row with `triggered_by = 'cron'` and
`agent_type = 'ceo'`. Query Supabase:

```sql
select started_at, status, duration_ms
from agent_jobs
where agent_type = 'ceo' and triggered_by = 'cron'
order by started_at desc
limit 10;
```
