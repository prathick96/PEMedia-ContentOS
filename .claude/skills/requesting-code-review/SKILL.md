---
name: requesting-code-review
description: Use after each task in subagent-driven development, after completing major features, and before merging to main.
---

# Requesting Code Review

## Core Principle

Review early, review often. Dispatch a code reviewer subagent with precisely crafted context — never your session history.

## When to Request

**Mandatory:**
- After each task in subagent-driven development
- After completing a major feature
- Before merge to main

**Optional:**
- When stuck (fresh perspective helps)
- Before refactoring (baseline check)
- After fixing a complex bug

## How to Request

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

Dispatch code reviewer subagent with:
- `{DESCRIPTION}` — brief summary of what was built
- `{PLAN_OR_REQUIREMENTS}` — what it should do
- `{BASE_SHA}` — starting commit
- `{HEAD_SHA}` — ending commit

## Acting on Feedback

- **Critical:** Fix immediately, do not proceed
- **Important:** Fix before continuing to next task
- **Minor:** Note for later
- **Wrong:** Push back with technical reasoning

## Red Flags

Never:
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Accept feedback without verifying it's technically correct for THIS codebase
