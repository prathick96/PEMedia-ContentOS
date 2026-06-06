---
name: dispatching-parallel-agents
description: Use when you have 3+ independent problems or tasks that can be solved in parallel by specialized subagents without shared state.
---

# Dispatching Parallel Agents

## Core Concept

Delegate independent tasks to specialized agents with isolated context. Each agent handles one problem domain without inheriting your session history.

## When to Apply

Use when you have:
- 3 or more independent tasks with different domains
- Multiple failing tests with unrelated root causes
- Subsystems that operate independently
- No shared state between investigations

**Avoid when:** failures are interconnected, agents would touch shared files, or you need comprehensive system-wide context.

## The Process

### 1. Identify Domains
Group tasks by affected component. Each domain = one agent.

### 2. Write Focused Task Briefs
Each agent prompt must be:
- **Focused** — one problem domain only
- **Self-contained** — all necessary context included
- **Explicit** — desired output format specified
- **Bounded** — clear definition of done

### 3. Launch Concurrently
Dispatch all agents simultaneously. Do NOT wait for one before dispatching the next.

### 4. Integrate Results
- Review each summary
- Verify no conflicts between changes
- Run full test suite on combined result
- Merge/commit

## Agent Brief Template

```
You are working on: <component>
Problem: <specific issue>
Files involved: <list>
Goal: <what done looks like>
Constraints: <what NOT to change>
Output format: <summary structure>
```

## Key Advantages

- Narrows each agent's focus → fewer errors
- Prevents cross-contamination of context
- Significantly reduces total investigation time
- You retain coordination context while agents do implementation
