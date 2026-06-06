---
name: agent-run
description: Trigger a specific PEMedia agent (ceo|scout|creative|production|publisher|analytics) with optional arguments
---

Run the specified agent via the API. Usage: /agent-run <agent-name> [--niche <niche>] [--topic <topic>] [--channel-id <id>]

Valid agents: ceo, scout, creative, production, publisher, analytics

Call: POST /api/agents/<agent-name> with the provided arguments as JSON body.
After triggering, poll the agent_jobs table for the job status and stream results to the terminal.
