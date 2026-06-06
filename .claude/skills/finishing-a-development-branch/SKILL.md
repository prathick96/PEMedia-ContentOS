---
name: finishing-a-development-branch
description: Use when implementation is complete and all tests pass. Guides merge/PR/discard decision with cleanup.
---

# Finishing a Development Branch

## Core Principle

Verify tests → Detect environment → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill."

## Step 1: Verify Tests

Run the test suite first. If tests fail, stop — do not present options until they pass.

## Step 2: Detect Environment

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
```

| State | Menu |
|-------|------|
| Normal repo | 4 options |
| Named-branch worktree | 4 options |
| Detached HEAD worktree | 3 options (no merge) |

## Step 3: Present Options

**Normal/named-branch (4 options):**
```
1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work
```

**Detached HEAD (3 options):**
```
1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work
```

## Step 4: Execute

- **Option 1 (Merge):** checkout base → pull → merge → verify tests → cleanup worktree → delete branch
- **Option 2 (PR):** push branch → `gh pr create` → do NOT cleanup worktree
- **Option 3 (Keep):** report path, do NOT cleanup
- **Option 4 (Discard):** require typed `discard` confirmation → cleanup worktree → force-delete branch

## Critical Rules

- Never run `git worktree remove` from inside the worktree (cd to main root first)
- Run `git worktree prune` after removal
- Only cleanup worktrees under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`
- Options 2 and 3 always preserve the worktree
