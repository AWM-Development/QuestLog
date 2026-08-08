# QuestLog — v1.6 Milestones (Pipeline Robustness)

**Location:** `Docs/milestones/MILESTONES_V1_6_MCP.md`
**Status:** Placeholder, same convention as `v1.5` — three of the four milestones below are still fully gated; `M-ROBUST.1` has a real ticket (`T-153`) as of `G-026`'s resolution. Not yet a task source `CLAUDE.md` points to; gets added there once at least one milestone below has real tasks (mirrors `MILESTONES_V1_5_MCP.md`'s own Status line). Scoped entirely to the pipeline itself (how tickets get built), not to QuestLog the product. `v1.5` was already reserved for `G-022`/`G-023` (MCP app polish, inventory management) before this doc was opened, so this work takes the next free slot rather than colliding with it.
**Created:** 2026-08-02, opened directly by `G-020`'s Q4 follow-through (`Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Resolution) rather than resolving a single gate the way v1.4 opened from `G-012` — `G-020` deliberately left Q4's five candidates un-ticketed and un-scoped, logging them as roadmap; this doc is the home for what happens once each is actually decided.

## Why v1.6 exists

`G-020` (the pipeline audit gate) resolved Q1 (portability) and Q2 (CI-enforced invariants) directly into `M-PIPELINE` (`Docs/milestones/MILESTONES_V1_1_MCP.md`, M-PIPELINE.8–19) since both were already answerable. Q4 — which adjacent surfaces earn a milestone of their own — was answered differently: all five candidates (second runner lane, Slack, external tracker, review bots, CI-event triggers) were logged as roadmap rather than picked from, per Alex's explicit call to keep the option open without prematurely narrowing. None of the five had a knowable Scope yet, so none could be ticketed directly — each first needs its own 🧠 decision, filed here as `G-026`–`G-029` (Slack and the external tracker grouped under one gate, `G-027`, since both are "visibility surface" decisions with a similar push/mirror shape).

This doc exists so those four gates' eventual resolutions have a milestone to land in, rather than each spawning its own successor doc the way `G-012` → v1.4 did. `M-PIPELINE` itself stays the home for pipeline work that's already scoped and shippable (its own backlog from `G-020` Q1/Q2, plus whatever else surfaces the same way M-PIPELINE.6/.7 did — found during a morning review, not planned). v1.6 is specifically the *not-yet-scoped* pipeline-robustness surface.

**Open gates:**
- `G-026` — resolved (`Docs/tickets/gated/resolved/G-026-second-runner-parallel-execution-lane.md`); drafted `T-153`.
- `G-027` (`Docs/tickets/gated/G-027-external-visibility-surfaces-slack-tracker.md`) — blocks M-ROBUST.2.
- `G-028` (`Docs/tickets/gated/G-028-automated-review-bots-second-opinion.md`) — blocks M-ROBUST.3.
- `G-029` (`Docs/tickets/gated/G-029-ci-event-driven-triggers.md`) — blocks M-ROBUST.4.

---

## Milestone M-ROBUST: Pipeline Robustness — Runner Fan-out, External Visibility, Review Automation

**Goal:** decide and, once decided, build the four Q4 candidates `G-020` logged but didn't ticket — each currently blocked on its own gate, not on code.

**Context:** No PRD section covers this — entirely pipeline-internal scope, same as `M-PIPELINE`/`M-AUDIT`/`M-OBS` before it. See `G-020`'s Resolution for the full research and rationale behind treating these as roadmap rather than immediate scope.

### Tasks

- [ ] **M-ROBUST.1 — Second runner as a parallel execution lane** (T-153)
  Devin cloud fan-out, one ticket at a time, alongside the nightly Claude Code executor. `T-069`'s claim-push mutex is trusted as-is for cross-lane ticket collision safety (no additional lane-assignment rule). Sequenced after `T-109`'s cost adapter lands — see `T-153`'s `Blocked on:` — per `G-026`'s resolution.

- [ ] **M-ROBUST.2 — External visibility surfaces: Slack delivery + ticket-tracker mirror** (Gated on: G-027)
  `/lineup`/blocked-run/`/ungate` delivery to Slack, and whether an external tracker (Linear/Jira) mirrors `Docs/tickets/` without displacing it as canonical. Two candidates under one gate — see `G-027`.

- [ ] **M-ROBUST.3 — Automated review bots as a second opinion** (Gated on: G-028)
  A second reviewer (hosted bot or a differently-prompted second subagent) alongside the existing `reviewer` subagent — advisory or merge-gating, and which mechanism. Likely sequenced after `T-114`'s red-check CI job, since `reviewer.md`'s value is clearest once CI already covers what it currently has to check by hand.

- [ ] **M-ROBUST.4 — CI-event-driven triggers** (Gated on: G-029)
  A `develop` merge re-running the promotion sweep immediately, and/or CI red on `develop` opening a fix session automatically — complementing, not replacing, the nightly cron scheduler.

### Ordering constraint

No task here depends on another — each is gated independently and can resolve in any order. `M-ROBUST.3` has a soft sequencing preference (after `T-114`, per its gate's Notes) but isn't hard-blocked on it; `/ungate` can still resolve `G-028` earlier and simply scope `M-ROBUST.3`'s eventual ticket(s) to land after `T-114` merges. None of these four are auto-promoted or picked up by the nightly executor — each stays in `gated/` until `/ungate` resolves it, same as any other 🧠 gate.
