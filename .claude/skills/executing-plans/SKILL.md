---
name: executing-plans
description: Use when you have a written implementation plan to execute with review checkpoints. Prefer subagent-driven-development if subagents are available.
---

# Executing Plans

## Overview

Load plan → review critically → execute all tasks → report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Superpowers works better with subagent support. If available, use `superpowers:subagent-driven-development` instead.

## Process

### Step 1: Load and Review Plan
1. Read the plan file completely
2. Identify any questions or concerns
3. If concerns exist: raise them before starting
4. If no concerns: create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as `in_progress`
2. Follow each step exactly as written
3. Run verifications as specified
4. Mark as `completed`

### Step 3: Complete Development

After all tasks complete:
- Announce: "I'm using the finishing-a-development-branch skill."
- Use `superpowers:finishing-a-development-branch`

## Stop Conditions

**STOP immediately when:**
- Blocker: missing dependency, failing test, unclear instruction
- Plan has critical gaps preventing progress
- Instruction is genuinely ambiguous
- Verification fails repeatedly (3× = architectural problem)

**Ask for clarification rather than guessing.**

## Integration

- **Required before:** `superpowers:writing-plans` (creates the plan)
- **Required before:** `superpowers:using-git-worktrees` (isolated workspace)
- **Required after:** `superpowers:finishing-a-development-branch`
