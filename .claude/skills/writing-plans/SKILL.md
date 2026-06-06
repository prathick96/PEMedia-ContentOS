---
name: writing-plans
description: Use when you have a spec/requirements and need a detailed implementation plan with granular tasks sized for 2-5 minutes of focused work.
---

# Writing Plans

## Core Purpose

Produce a complete implementation plan where engineers never need context beyond the document itself.

## Key Principles

- **TDD approach** — tests drive implementation, each task fails first
- **Granular decomposition** — 2–5 minutes per task
- **Explicit over implicit** — every file path, code block, and command is exact (no "TBD")
- **Frequent commits** — after each logical step
- **DRY and YAGNI** — no repetition, no speculative features

## Plan Structure

```
# Plan: <Goal>

## Architecture
<tech stack + key design decisions>

## File Structure
<map of files to create/modify>

## Tasks

### Task 1: <name>
Files: create/modify/test
Steps:
  1. <exact step with code block>
  2. <exact step>
Test: `<exact command>` → expected output
Commit: `git commit -m "<message>"`
```

## Self-Review Checklist

Before handing off, verify:
- [ ] No placeholder like "implement similar to Task N"
- [ ] Every file path is explicit
- [ ] Every test command has expected output
- [ ] No task depends on unexplained context
- [ ] Gaps and risks documented

## Execution Handoff

After plan is written, offer two paths:
1. **Subagent-driven** — fresh agent per task (use `superpowers:subagent-driven-development`)
2. **Inline** — sequential execution with checkpoints (use `superpowers:executing-plans`)
