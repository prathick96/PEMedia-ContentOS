---
name: using-git-worktrees
description: Use at the start of any feature/fix implementation to create an isolated workspace. Detect existing isolation before creating anything.
---

# Using Git Worktrees

## Core Principle

"Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness."

## Process

### Step 1: Detect Existing Isolation

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
```

If `GIT_DIR != GIT_COMMON` → already in a linked worktree. Skip creation, go to Step 2.

Also check for submodule false-positives:
```bash
git rev-parse --show-superproject-working-tree
```
If this returns a path, you're in a submodule — treat as normal repo.

### Step 2: Create Worktree (if needed)

**Step 2a — Try native tool first** (harness-provided worktree tool if available).

**Step 2b — Git fallback:**

Directory selection priority:
1. Explicit user preference
2. Existing project-local directory (verify it's git-ignored first)
3. Global legacy path (`~/.config/superpowers/worktrees/`)
4. Default: `.worktrees/<branch-name>`

```bash
git worktree add .worktrees/<feature-name> -b <branch-name>
```

**Safety check for project-local:**
```bash
git check-ignore -q .worktrees/ || echo "NOT IGNORED — add to .gitignore first"
```

### Step 3: Project Setup

```bash
cd <worktree-path>
npm install  # or equivalent
```

### Step 4: Verify Baseline

Run the test suite. If tests fail, get explicit user permission before proceeding.

## Critical Rules

- Never create a worktree inside an existing worktree
- Always verify project-local directories are git-ignored
- After removing a worktree: run `git worktree prune`
