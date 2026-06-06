---
name: produce-video
description: Trigger the full production pipeline for a topic on a given series
---

Trigger the Production Agent to create a video. Usage: /produce-video --topic "<topic>" --series-id <id>

Steps executed by the Production Agent:
1. Script generation (Claude API)
2. Voice generation (ElevenLabs)
3. Visual sourcing (Pexels/Muapi)
4. Video assembly (Creatomate)
5. Thumbnail generation (OpenGenAI Image Studio)

Call POST /api/agents/production with { "topic": "<topic>", "seriesId": "<id>" }
Stream job progress to terminal. Final output: video record in DB with status READY.
