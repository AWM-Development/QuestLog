# QuestLog — v1.10 Milestones (Production Readiness)

**Location:** `Docs/milestones/MILESTONES_V1_10_MCP.md`
**Status:** CANONICAL task source for v1.10 — `M-RELEASE.1`/`M-RELEASE.2` already have real tickets (moved in from `v1.1`'s `M-AUDIT`, not newly filed). `M-RELEASE.3`–`M-RELEASE.6` are Alex-proposed scope with no ticket filed yet — write them (via `ticket-writer`) when this milestone is actually opened, not before. None of the six is eligible for autonomous nightly execution; all stay interactive/Alex-present.
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

- [ ] **M-RELEASE.3 — Repo-public checklist** (no ticket yet)
  A short, concrete pre-flip checklist: no secrets/`.env` values ever committed, no leaked API keys anywhere in history, a `LICENSE` file present, a `CONTRIBUTING.md` if outside contributions are wanted. Could land as its own ticket or as a manual runbook Alex works through by hand — Alex's call when this is scoped for real.

- [ ] **M-RELEASE.4 — Re-skim T-038's security review for the public-repo threat model** (no ticket yet)
  `T-038` (M-AUDIT.2, already done) reviewed the OAuth shim and remote-MCP surface as a black box. Going public changes the threat model slightly — anyone can now read the shim's source, not just probe the live endpoint — so a quick re-skim of that report's findings against "attacker has the source" is worth doing before the flip, not a full re-review from scratch.

- [ ] **M-RELEASE.5 — CI/CD secrets audit for public Actions logs** (no ticket yet)
  A final pass confirming no `develop`/`main` GitHub Actions workflow logs or build artifacts leak Fly/Neon/Voyage tokens or other secrets, since public repos get public Actions logs by default (private repos don't).

- [ ] **M-RELEASE.6 — Fold `Docs/DEPLOY_READINESS.md`'s caveats into T-039's review** (no ticket yet)
  `DEPLOY_READINESS.md` already flags things like "upgrade Neon off Free tier before real campaign data goes in" — worth folding those caveats into M-RELEASE.1's (`T-039`) scalability review rather than leaving them as a separate, easy-to-forget doc once that review lands.

### Ordering constraint

All six tasks trigger once every other MCP-roadmap milestone (`v1.1` through `v1.9`, plus any further MCP-scope version opened before this one) is in `done/`. Re-check for anything newer spawned since before pulling any of them into an interactive session — the same discipline `T-039`'s original trigger condition already called for, just widened in scope. None of the six depend on each other except loosely: `M-RELEASE.6` reads more naturally as part of `M-RELEASE.1`'s review, and `M-RELEASE.4` is easiest right after `M-RELEASE.1`/`M-RELEASE.5` are fresh in mind — but none are hard blockers on one another.
