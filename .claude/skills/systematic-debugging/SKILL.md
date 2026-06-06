---
name: systematic-debugging
description: Use when debugging any issue. Enforces root-cause-first discipline. NO fixes without investigation.
---

# Systematic Debugging

## The Central Mandate

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Random patches mask underlying problems. Three failed fix attempts = stop and reconsider the architecture.

## Four Sequential Phases

### Phase 1: Root Cause Investigation
- Read error messages and stack traces completely
- Reproduce the issue with documented steps
- Review recent changes that correlate with the problem
- Add diagnostic logging across component boundaries
- Trace data flow backward from the failure point

### Phase 2: Pattern Analysis
- Find similar working implementations nearby
- Read reference implementations completely (no skimming)
- Catalog every difference between working and broken code
- Understand all dependencies and assumptions

### Phase 3: Hypothesis and Testing
- Formulate specific, testable theories
- Make minimal changes to validate each hypothesis separately
- If a test fails: form a new hypothesis, don't pile on fixes

### Phase 4: Implementation
- Write a failing test case BEFORE fixing
- Implement one root-cause solution
- Verify nothing else breaks
- **Stop at 3 failed fixes** — reconsider architectural soundness

## Red Flags (Protocol Violation)

Stop immediately if you catch yourself thinking:
- "I'll investigate later"
- "Just try changing X"
- Attempting multiple changes simultaneously
- Proposing solutions before understanding the issue

## Key Insight

After 3 failed attempts, the architecture itself may be flawed. Stop treating symptoms. Rethink the design.
