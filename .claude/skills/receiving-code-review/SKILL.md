---
name: receiving-code-review
description: Use when receiving code review feedback. Verify before implementing. Technical rigor over performative agreement.
---

# Receiving Code Review

## Core Principle

Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
1. READ:      Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY:    Check against codebase reality
4. EVALUATE:  Technically sound for THIS codebase?
5. RESPOND:   Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

NEVER write:
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Thanks for catching that!"
- "Let me implement that now" (before verification)
- Any gratitude expression

INSTEAD: Just fix it. Show it in the code. Actions over words.

## Handling Unclear Feedback

If ANY item is unclear: STOP. Ask for clarification on ALL unclear items before implementing ANYTHING.

Partial understanding = wrong implementation.

## When to Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Conflicts with prior architectural decisions

**How:** Use technical reasoning, reference working tests/code, involve the human if architectural.

## Acknowledging Correct Feedback

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch — [specific issue]. Fixed in [location]."
✅ [Just fix it and show the code]
```

## External Reviewers

Check before implementing:
1. Technically correct for THIS codebase?
2. Breaks existing functionality?
3. Reason for current implementation?
4. Works on all platforms/versions in scope?
5. Does reviewer understand full context?
