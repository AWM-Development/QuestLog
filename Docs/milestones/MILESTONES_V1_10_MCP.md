# QuestLog — v1.10 Milestones (Production Readiness)

**Location:** `Docs/milestones/MILESTONES_V1_10_MCP.md`
**Status:** CANONICAL task source for v1.10 — both tasks below already have real tickets (moved in from `v1.1`'s `M-AUDIT`, not newly filed). Neither is eligible for autonomous nightly execution; both stay interactive/Alex-present, same as their original `M-AUDIT` design.
**Created:** 2026-08-07, per Alex — relocating `M-AUDIT.3`/`M-AUDIT.4` (`T-039`, `T-040`) out of `v1.1` into their own version slot, since their real trigger condition is broader than v1.1 (see below) and bundling them with v1.1's remote-MCP scope was misleading about when they actually run. Takes the next free version slot after `v1.9` (structured-content authoring, unrelated scope).

## Why v1.10 exists

`T-039` (scalability-into-v2 review) and `T-040` (portfolio polish pass) were originally filed under `v1.1`'s `M-AUDIT` milestone, gated on that version's own remote-MCP/CI-CD work landing first. Both are actually gated on something bigger: they only make sense once **all of the MCP-roadmap work is done** — not just v1.1, but v1.2 through v1.9 (and any further MCP-scope versions opened before this one) — because both tickets are judging the *whole* repo's readiness, not one version's slice of it.

The concrete trigger Alex has in mind for this milestone: **QuestLog going from a private repo to a public one**, once it's actually ready for someone outside the project to look at it. `T-040`'s portfolio-polish scope (README, architecture overview, demo script, commit-hygiene spot-check) is a direct pre-req for that switch. `T-039`'s scalability review is a natural companion — a final sanity check on the infrastructure decisions before the repo (and by extension the live deployment) is discoverable by anyone.

**The private→public repo switch itself is not a ticket** — it's a manual, one-click decision Alex makes once this milestone's tasks (and Alex's own judgment) say it's ready. Nothing here should auto-promote it.

## Milestone M-RELEASE: Production Readiness

**Goal:** confirm the repo and its infrastructure are ready to be shown to an outside audience — technically sound enough to hold up to scrutiny, and presented well enough to make a good first impression — before flipping the repository from private to public.

### Tasks

- [ ] **M-RELEASE.1 — Scalability-into-v2 review** (`T-039`, moved from `M-AUDIT.3`)
  Whether current infrastructure choices (Neon Free-tier compute, in-process MCP tool calls, single-instance assumptions) hold up against the deferred v2 web-app scope in `Docs/milestones/MILESTONES_V1_MCP.md`'s "Deferred to v2" table. Interactive, not autonomous — judging "will this scale" needs Alex's institutional context, not just what's in the rules docs.

- [ ] **M-RELEASE.2 — Portfolio polish pass** (`T-040`, moved from `M-AUDIT.4`)
  README quality, an architecture overview, demo script/screenshots, "how to run this" clarity for someone who has never seen the repo. Interactive — "does this read well to an outside reviewer" is a judgment call, not something to automate blind.

### Ordering constraint

Both tasks trigger once every other MCP-roadmap milestone (`v1.1` through `v1.9`, plus any further MCP-scope version opened before this one) is in `done/`. Re-check for anything newer spawned since before pulling either ticket into an interactive session — the same discipline `T-039`'s original trigger condition already called for, just widened in scope. `M-RELEASE.1` and `M-RELEASE.2` have no dependency on each other and can run in either order.
