# T-197 — Auto-merge workflow for XS/D low-risk ticket PRs

Milestone ref: M-AUTOPILOT.6 (`Docs/milestones/MILESTONES_V1_6_MCP.md`)

Blocked on: T-192 — must be merged into develop first

Complexity tier: M

Strategy-gate flag: no

Priority: P1

Branch: feat/m-autopilot/t-197-auto-merge-low-tier-prs

Context files (load ONLY these):
  - .github/workflows/ticket-status-ledger.yml
  - .github/workflows/ci.yml
  - scripts/ci-scope-guard.sh
  - AGENTS.md § Hard rules for autonomous runs
  - Docs/tickets/TICKET_SPEC.md § Complexity tier field note

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Alex approved (2026-10-17) auto-merging the lowest-risk executor PRs. Add `.github/workflows/auto-merge-low-tier.yml` plus a small tested decision script.
  1. Decision script `scripts/auto-merge-eligible.sh <base> <head> <pr-title>` (+ tests) prints `ELIGIBLE` or `INELIGIBLE: <reason>` and exits 0/1. ELIGIBLE only when ALL hold: head branch matches `feat|chore|fix|refactor/<group>/t-###-*`; the PR's ticket file (found via the `T-###` in the branch) declares `Complexity tier: XS` or `D`; every changed file passes the tier's own bar (D: all `.md`; XS: exactly one file); and **no changed path is in the protected set**: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.github/**`, `scripts/**`, `Docs/tickets/EXECUTOR_ROUTINE.md`, `Docs/tickets/TICKET_SPEC.md`, `Docs/tickets/GATE_SPEC.md`, `Docs/milestones/**`. Branches starting `tickets/` are always INELIGIBLE (merging a ticket-filing PR is Alex's Priority confirmation).
  2. Workflow: on `pull_request` (opened/synchronize/ready_for_review) run the script; if ELIGIBLE, enable GitHub auto-merge (`gh pr merge --auto --squash`) so GitHub merges only after every required check is green; if INELIGIBLE, do nothing (log the reason). Never uses a PAT; `permissions: contents: write, pull-requests: write` only.
  3. `AGENTS.md`: amend the "never merge a PR yourself" rule to state the executor still never merges, and that the only merge path is this workflow's GitHub auto-merge for the eligible set, citing `.github/workflows/auto-merge-low-tier.yml`.
  4. Ticket report lists the one-time repo settings Alex must apply (Settings -> General -> allow auto-merge; branch protection on `develop` requiring the `ci.yml` checks) — verify the required-check names against `ci.yml`.

Out of scope: Auto-merging any S/M/L ticket; merging `tickets/*` filing PRs; merging to `main`; changing CI checks; the executor merging anything directly.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - script tests cover: D docs-only eligible; D touching a protected path ineligible; XS single-file eligible; XS two files ineligible; M-tier ineligible; `tickets/*` branch ineligible; missing ticket file ineligible
  - the workflow file passes `actionlint` (or the repo's existing workflow lint) and contains no step that merges without `--auto`
  - `AGENTS.md` change cites the workflow path and keeps "Never merge a PR yourself" intact for agents

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_6_MCP.md (M-AUTOPILOT.6),
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
