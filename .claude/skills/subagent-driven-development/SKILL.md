---
name: subagent-driven-development
description: Use when executing a plan with mostly independent tasks. Dispatches a fresh subagent per task with two-stage review (spec compliance then code quality).
---

# Subagent-Driven Development

## Core Principle

Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration.

Each subagent receives precisely crafted context — never your session history.

## When to Use

You have an implementation plan with mostly independent tasks and subagent support is available.

## Per-Task Sequence

1. Dispatch **implementer subagent** with full task text + relevant context
2. Answer any questions before implementation starts
3. Implementer implements, tests, commits, self-reviews → returns status
4. Dispatch **spec compliance reviewer** subagent
5. If spec issues: implementer fixes → re-review
6. Dispatch **code quality reviewer** subagent
7. If quality issues: implementer fixes → re-review
8. Mark task complete

After all tasks: dispatch final code reviewer → use `finishing-a-development-branch`.

## Implementer Status Codes

- `DONE` — proceed to spec compliance review
- `DONE_WITH_CONCERNS` — read concerns, address correctness before review
- `NEEDS_CONTEXT` — provide missing info, re-dispatch
- `BLOCKED` — never force retry, escalate or provide more context

## Model Selection

Use least powerful model that can handle each role:
- Mechanical (1–2 files): cheaper/faster model
- Integration (multiple files): standard model
- Architecture/design: most capable model

## Continuous Execution

Do NOT pause between tasks to check in. Execute all tasks from plan without stopping unless:
- Genuinely BLOCKED
- Ambiguity prevents progress
- All tasks complete

## Red Flags

Never: start on main/master, skip reviews, proceed with unfixed issues, dispatch parallel implementers, start quality review before spec compliance passes.
