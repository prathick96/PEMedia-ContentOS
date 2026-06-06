---
name: council
description: Convene the PEMedia LLM council for a strategic decision, or run a tactical gate (channel_launch|topic_greenlight|series_kill)
---

Convene the multi-persona LLM council — Strategist, Growth, Risk & Compliance, Finance, Tech &
Production, synthesized by a Chairman. See docs/strategy/council-brief-001.md for the design.

Strategic decision (open question):
  /council <your strategic question>
  → POST /api/council with { "question": "<question>", "context": { ...optional state... } }

Tactical gate (binary approve/reject at a pipeline checkpoint):
  /council --gate <channel_launch|topic_greenlight|series_kill> <short description>
  → POST /api/council with { "gate": "<kind>", "payload": { ...the proposal... } }

Report back the chairman's decision/verdict, confidence (0–1), ranked actions, and any preserved
dissents. Every convene is logged to the council_decisions table for audit.
