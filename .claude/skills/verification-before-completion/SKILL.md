---
name: verification-before-completion
description: Use before claiming any task is complete. Fresh verification evidence required — previous runs don't count.
---

# Verification Before Completion

## Core Rule

**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

## The 5-Step Gate

Before claiming success on anything:

1. **Identify** the verification command
2. **Run** it fresh (not a cached/previous result)
3. **Read** the full output and exit codes
4. **Verify** the output actually matches the claim
5. **Only then** make the claim — attach the evidence

## What Does NOT Count

- Previous test runs (must be fresh)
- Linter passing (does not prove compilation or runtime)
- "It should work" reasoning
- Agent self-reports without independent verification
- Partial checks ("the main path works")

## Red Flags

If you catch yourself about to write any of these — stop:
- "should work"
- "this looks right"
- "I believe it's done"
- Any completion claim without a terminal command run immediately before

## Applies To

- Task completion
- Bug fixes ("the bug is fixed")
- Test passing claims
- Requirement fulfillment
- Feature completion
- Deployment success

## Attach Evidence Format

```
Verification: `npm test`
Output: 12 passing (1.2s)
Exit code: 0
Claim: All tests pass ✓
```
