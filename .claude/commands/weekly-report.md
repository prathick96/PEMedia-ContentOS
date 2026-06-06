---
name: weekly-report
description: Trigger the Analytics Agent to generate a weekly performance report across all channels
---

Run the Analytics Agent weekly report. Usage: /weekly-report [--channel-id <id>]

Pulls data from:
- YouTube Analytics API (views, watch time, CTR, revenue)
- Revenue entries table (all streams)
- Video analytics table (per-video performance)

Outputs:
- Top 5 performing videos this week
- Channel growth vs last week
- Revenue breakdown by stream
- Underperforming series alerts
- CEO Agent recommendations for next week

Call POST /api/agents/analytics with { "mode": "weekly", "channelId": "<id>|all" }
