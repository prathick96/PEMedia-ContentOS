---
name: test-driven-development
description: Use for all new features, bug fixes, and refactors. Write the failing test FIRST, then implement.
---

# Test-Driven Development

## Core Rule

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

Write implementation before a test? Delete it and restart. No exceptions.

## The Three Phases

### RED
1. Write one minimal test demonstrating desired behavior
2. Verify it fails with the expected error
3. Do not write any production code yet

### GREEN
1. Write the simplest code possible to make the test pass
2. Do not over-engineer or add unrequested features
3. Done when the test passes — nothing more

### REFACTOR
1. Clean up code while keeping tests passing
2. Remove duplication
3. Improve clarity without changing functionality

## When TDD Applies

- New features
- Bug fixes
- Refactoring
- Any behavior change

## Why

Tests written after implementation pass immediately — they prove nothing. Watching tests fail first confirms they actually validate the intended behavior, not something adjacent to it.

Manual testing is unreproducible. Automated tests run identically every time and catch regressions.

## Rules

- Each test: one behavior, descriptive name, real code over mocks when feasible
- Never rationalize skipping TDD "just this once" — that's how shortcuts become habits
- Use real integrations where possible (mocks that diverge from prod cause prod failures)
