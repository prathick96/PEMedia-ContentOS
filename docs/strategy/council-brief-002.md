# Council Brief 002 — Tooling, Skills & Self-Hosting Integration

> **Decision artifact** produced by the ContentOS LLM Council (multi-persona, single-model).
> **Date:** 2026-06-09 · **Status:** Ratified · **Owner:** Prathick (solo operator)
> **Convening question:** *Should ContentOS adopt Coolify (self-hosting) and five skill/plugin repos — anthropics/skills, obra/superpowers, anthropics/knowledge-work-plugins, Egonex-AI/Understand-Anything, Leonxlnx/taste-skill? For each: does it improve the product, performance, efficiency, stability, and robustness — and at what cost and risk?*

Five seats reasoned independently — **Strategist, Growth, Risk & Compliance, Finance, Tech/Production** — followed by a **Chairman** synthesis. Dissents are preserved, not averaged away. Every claim is grounded in the actual repos as inspected on 2026-06-09.

---

## 0. Chairman Synthesis — The Decision

**The headline:** Of the six candidates, exactly **one** changes the architecture (**Coolify**), exactly **one** is a near-pure product win (**taste-skill**, for the dashboard), two are **official, low-risk, cherry-pick** assets (**anthropics/skills**, **knowledge-work-plugins**), one is a **dev-time productivity tool** (**Understand-Anything**), and one is **already installed** (**superpowers**). **None of them publishes a video.** That single fact governs the sequencing.

**The one genuine architectural insight:** Coolify resolves the exact constraint that forced the Session 2 QStash rewire — serverless execution-time limits. Vercel's function timeout (10–60s hobby, ~300s Pro) **will** break the Production agent the moment real video generation runs, because voice + video-gen + assembly is a multi-minute job. Coolify gives an always-on host with no timeout, where long jobs and BullMQ workers run natively. This is the only item on the list that unblocks the critical path.

**Ratified tiered decision:**

| Tier | Item | Action |
|------|------|--------|
| **ADOPT NOW** | **taste-skill** | Vet `SKILL.md`, then adopt for the dashboard UI. Highest product-quality-per-effort. |
| **ADOPT NOW (cherry-pick)** | **anthropics/skills** | Use the official document skills (PDF/PPTX/XLSX) for the Analytics agent's weekly reports + exported brand docs. Don't bulk-install. |
| **KEEP** | **superpowers** | Already vendored (12 skills). Optionally re-sync the marketplace for updates. No urgent action. |
| **MINE FOR PATTERNS** | **knowledge-work-plugins** | Do **not** install as a dependency. Extract the Marketing + Data plugins' prompt/skill patterns into the Creative & Analytics agent system prompts. |
| **PILOT / STAGE** | **Coolify** | Stand up on a **cheap VPS — not a home machine** — as the always-on host for long-running agent jobs. Stage beside Vercel, validate, then decide cutover. Trigger: when Production needs >60s execution. |
| **DEFER** | **Understand-Anything** | Dev-time codebase navigation. Overkill for today's small codebase. Revisit when `lib/` doubles. Vet the install script before any use. |

**The overriding guardrail (unanimous):** every item here is a potential **tooling rabbit hole** pre-revenue. Timebox each integration. The only one allowed to interrupt the content critical path is Coolify, and *only because* it unblocks video production — everything else is adjacent polish that must wait its turn behind a published, monetizing channel.

---

## 1. What Each Repo Actually Is (verified 2026-06-09)

| Repo | What it is | Trust | Relevance to ContentOS |
|------|-----------|-------|------------------------|
| **coollabsio/coolify** | Open-source self-hosted PaaS (Vercel/Heroku alternative). Docker-based. Hosts Next.js, Postgres, Redis, 280+ services. | Established OSS | **Architectural.** Always-on host → no serverless timeout, BullMQ viable, self-host Supabase + Redis. |
| **anthropics/skills** | Official Anthropic skills repo. Document skills (DOCX/PDF/PPTX/XLSX), spec, template. Install via plugin marketplace. | **Official** | Analytics agent reports; exported brand docs. Partial overlap with already-available `anthropic-skills`. |
| **obra/superpowers** | The 12 dev-workflow skills (brainstorming, TDD, worktrees, etc.). | Trusted (in use) | **Already installed** in `.claude/skills/`. |
| **anthropics/knowledge-work-plugins** | 11 role plugins (Marketing, Data, Sales…) for Claude Cowork. Connector-heavy (Slack/Notion/HubSpot). | **Official** | Marketing + Data plugins map to Creative/Analytics — but as *pattern reference*, not runtime deps. |
| **Egonex-AI/Understand-Anything** | Codebase → interactive knowledge graph (tree-sitter + LLM). ~55k★, MIT, active. | 3rd-party | **Dev-time** code navigation, not product runtime. |
| **Leonxlnx/taste-skill** | Frontend design skill — stops "generic AI slop" UI. ~38k★, MIT, shell install via `npx skills add`. | 3rd-party | **Product.** Directly improves the dashboard (currently a shell). |

---

## 2. Seat Opinions

### 2.1 Strategist
The goal is a compounding content venture to $5k MRR. Rank every tool by distance to a published, monetizing video.
- **Coolify** is the only candidate on the critical path — it unblocks long-running production. But it is *infrastructure*, not *content*; adopting it before a single channel exists is solving a problem you don't yet have. **Stage it, don't front-load it.**
- **taste-skill** improves the operator's command center. A solo operator lives in that dashboard daily — its quality compounds in decision speed. Worth doing early because it's cheap.
- **knowledge-work-plugins** is a goldmine of *prompt patterns* (the Marketing plugin literally encodes brand-voice and content-quality discipline — exactly Brief 001's "originality is the moat"). But importing Cowork connectors into an autonomous backend is architecture mismatch. **Steal the prompts, leave the plumbing.**
- **Understand-Anything / anthropics/skills** are productivity multipliers, not strategy movers. Background tier.

**Dissent (Strategist → Risk):** I'd go further than "pilot" on Coolify — the timeout wall is *certain*, not hypothetical. Staging it now (idle, validated) is cheaper than discovering it mid-launch.

### 2.2 Growth
- **taste-skill** is the clearest growth-adjacent win: a polished dashboard isn't user-facing, but a design skill that enforces typography/spacing/motion **also raises the bar on any AI-generated visual asset** — thumbnails, channel art, on-screen lower-thirds. CTR on YouTube is thumbnail-driven; design taste is not cosmetic, it's conversion.
- **knowledge-work-plugins → Marketing** encodes campaign + brand-voice workflows that the Creative agent currently improvises. Folding those patterns in tightens brand consistency across a series — the thing that converts viewers to subscribers.
- **Coolify/Understand-Anything** have no direct growth lever.

### 2.3 Risk & Compliance
This is where caution earns its seat.
- **Third-party supply chain:** `taste-skill` (100% shell, installs via `npx skills add <repo>`) and `Understand-Anything` (multi-agent pipeline + `install.sh/ps1`) **execute third-party code/instructions**. High star counts are not a security audit. **Mandatory: read the SKILL.md / install script before running; pin a commit; never enable auto-update on third-party skills.**
- **Coolify is a security *posture* change.** Moving off Vercel means *you* now own patching, TLS, firewalling, secrets, backups, and uptime. Given Session 2's secret-leak incident, the operator's secret-hygiene track record argues for **extra discipline** before self-hosting exposed services. A misconfigured self-hosted Supabase is a far bigger blast radius than a Vercel env var.
- **"Host locally" is the sharpest risk.** If "locally" means a home/dev machine, an autonomous 24/7 system inherits that machine's uptime, power, and network — which **defeats the word "autonomous."** A $5/mo VPS is non-negotiably better than a home box for the always-on tier.
- Official repos (anthropics/skills, knowledge-work-plugins) carry minimal trust risk.

**Dissent (Risk → Strategist):** disagree with staging Coolify "now." Pre-revenue, every hour on infra is an hour not spent getting the first video live. **Defer Coolify until a real job actually times out on Vercel** — let the constraint prove itself before paying the ops tax.

### 2.4 Finance
- **Coolify:** trades Vercel's $0 (hobby) / $20 (Pro) for a flat VPS (~$5–20/mo) + **ops time priced at the operator's scarcest resource: attention.** Pre-revenue, the *time* cost dominates the *dollar* cost. Financially neutral on cash, **negative on focus** until the timeout actually blocks revenue. Self-hosting Supabase + Redis later consolidates 3 bills into 1 — a real saving *at scale*, not now.
- **Skills/plugins:** all free, MIT/Apache. Only cost is integration time. taste-skill + cherry-picked document skills are hours, not days — cheap.
- **knowledge-work-plugins connectors** would imply paid SaaS (HubSpot, etc.) — **another reason to take patterns, not plumbing.** Zero new SaaS spend.
- **Understand-Anything** burns LLM tokens to build/refresh the graph — small but nonzero recurring cost for a tool with no revenue line. Defer.

### 2.5 Tech / Production
- **Coolify is the correct long-term substrate** for this system. The Production agent's pipeline (script → ElevenLabs voice → video gen → assembly) is inherently long-running and stateful — the *opposite* of what serverless wants. Always-on + BullMQ workers (Path B, already stubbed in `agent-worker.ts`) is the natural home.
  - **Sub-decision — do we revert the QStash rewire?** *No.* QStash schedules remain the cleanest cron mechanism and fire fine against a Coolify endpoint. The clean hybrid: **QStash for scheduling + light fan-out; Coolify-hosted BullMQ workers for heavy video jobs.** Or go all-in Coolify (BullMQ repeatable jobs for cron, drop QStash) for one-box simplicity. Decide at integration time — both are valid; do **not** rip out working code speculatively.
- **taste-skill** plugs straight into the dashboard build with near-zero architecture impact (it shapes generated TSX, which you review).
- **anthropics/skills document skills** are a direct fit for the Analytics agent emitting PDF/PPTX weekly reports.
- **Understand-Anything** is genuinely useful *later* — once `lib/` has agents + council + quality-gate + scheduling + queues, a dependency graph aids impact analysis. Today the codebase fits in one head. Premature.
- **superpowers** stays; consider re-syncing the marketplace to catch new skills, but the vendored copy works.

**Tech dissent on its own enthusiasm:** I want Coolify, but I concede Risk's and Finance's point — wanting the *right* architecture is not the same as needing it *this week*. The trigger should be empirical (first >60s job), not aesthetic.

---

## 3. Resolved Tensions

| Tension | Resolution |
|--------|-----------|
| Strategist/Tech "stage Coolify now" vs Risk/Finance "defer until it blocks revenue" | **Compromise: provision, don't migrate.** Spin up a VPS + Coolify in an afternoon, deploy a throwaway test of a long job to *confirm* it solves the timeout, then leave it idle. Cut over only when Production goes live. Costs ~$5 and one afternoon; removes launch-day surprise. **Never on a home machine.** |
| Adopt knowledge-work-plugins vs not | **Neither — mine it.** Extract Marketing/Data prompt patterns into agent prompts. No connectors, no Cowork runtime, no new SaaS. |
| Trust third-party skills (taste, Understand-Anything) | **Conditional adopt:** human review of SKILL.md/scripts first, pin commit, no auto-update. taste-skill clears the bar (product value, low runtime risk); Understand-Anything defers on *need*, not trust. |
| Revert QStash now that Coolify enables BullMQ | **No.** Keep QStash for cron; add BullMQ workers on Coolify for heavy jobs. Don't delete working infrastructure speculatively. |

---

## 4. Integration Sequence (when the operator chooses to act)

1. **taste-skill → dashboard.** Review `SKILL.md`, install pinned, rebuild the dashboard shell with it. (~half day)
2. **anthropics/skills (docs) → Analytics agent.** Wire PDF/PPTX export into the weekly report path. (~hours)
3. **knowledge-work-plugins → prompt harvest.** Lift Marketing brand-voice + Data reporting patterns into Creative/Analytics system prompts. (~hours)
4. **Coolify → provision-and-validate (not migrate).** $5 VPS, Coolify install, deploy a long-job smoke test, confirm timeout is gone, leave idle. (~one afternoon)
5. *(Deferred)* **Understand-Anything** when codebase grows; **superpowers** marketplace re-sync any time.

**None of steps 1–4 should precede getting the first Tech channel's first video produced and queued.** They run *in parallel with* or *in service of* that — never instead of it.

---

## 5. Bottom Line

- **Adopt now:** taste-skill (dashboard), anthropics/skills document skills (reports). Free, low-risk, real product lift.
- **Harvest:** knowledge-work-plugins prompt patterns. Free, no new dependencies.
- **Provision-and-validate, don't migrate:** Coolify on a VPS — the only architectural move, justified solely by the certain serverless-timeout wall. Home-machine hosting is rejected.
- **Defer:** Understand-Anything (need, not trust). **Keep:** superpowers.
- **Do not:** install knowledge-work-plugin connectors, revert QStash, auto-update third-party skills, or let any of this outrank shipping the first video.

> The venture is won by published, original, monetizing content — not by the toolchain around it. Adopt what removes a real blocker (Coolify's timeout) or cheaply sharpens the daily cockpit (taste-skill); harvest patterns for free; defer the rest until the codebase or the constraint actually demands it.
