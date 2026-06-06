---
name: trend-brief
description: Get today's trend briefing from the Scout Agent for a given niche
---

Trigger the Scout Agent for a trend briefing. Usage: /trend-brief [niche]

Valid niches: tech, history, movies, sports, news (default: all active)

Call POST /api/agents/scout with { "niche": "<niche>", "mode": "brief" }
Display the top 5 trending topics with scores and production feasibility ratings.
