---
name: brainstorming
description: Use before ANY implementation. Refines ideas through questions, explores alternatives, and produces a written spec for approval before a single line of code is written.
---

# Brainstorming

## Hard Gate

**Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it.**

## Process (9 Steps)

1. Explore project context (files, docs, recent commits)
2. Offer visual companion only if needed (separate message, user must consent)
3. Ask clarifying questions — ONE at a time
4. Propose 2–3 approaches with trade-offs
5. Present design in sections, get approval after each
6. Write design doc to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
7. Self-review spec: check for placeholders, contradictions, scope creep, ambiguity
8. User reviews written spec
9. Invoke writing-plans skill (the only skill invoked after this one)

## Key Principles

- **One question per message** — never ask multiple at once
- **Multiple-choice preferred** over open-ended questions
- **YAGNI ruthlessly** — remove anything not needed now
- **Incremental validation** — present, get approval, proceed
- **Design for isolation** — clear boundaries, single purpose per unit

## Anti-Pattern Warning

Projects are never "too simple" to skip design. Even small features need a brief spec to expose unexamined assumptions.

## Visual Companion

Only offer as a standalone message if mockups/diagrams would genuinely help. User must consent. Use browser for visual content; terminal for text-based decisions.
