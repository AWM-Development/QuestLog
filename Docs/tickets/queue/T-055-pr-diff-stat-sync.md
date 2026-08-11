# T-055 — PR diff-stat sync into the observability store

Milestone ref: M-OBS.4

Complexity tier: M

Priority: P0


Branch: feat/m-obs/t-055-pr-diff-stat-sync

Context files (load ONLY these):
  - packages/observability/src/schema/tables.ts (created by T-053 — the `files_changed`/`lines_added`/`lines_removed` placeholder columns this ticket populates)
  - packages/observability/src/ingest.ts (created by T-053 — the existing ingestion entry point this extends)
  - Docs/tickets/EXECUTOR_ROUTINE.md (branch/PR naming convention used to resolve a ticket id's PR)

Mockup: none

Model: sonnet

Scope: A sync job that, given a ticket id, looks up its merged PR via the GitHub API (`gh pr list`/`gh pr view` equivalent, using this repo's existing branch-naming convention `feat/<milestone-group>/t-###-<slug>` to find the PR) and writes its diff stats (files changed, lines added, lines removed) into that ticket's `ticket_runs` row in `packages/observability`'s store, so diff-size correlation doesn't require a manual `gh pr list` pull per ticket.
  - A pure function computing the correct GitHub search/query parameters from a ticket id (matching branch name pattern).
  - A function mapping a GitHub API PR response to the three diff-stat fields.
  - A script entry point: given a ticket id (or "all ticket_ids missing diff stats in the store"), fetches and upserts diff stats for each.
  - Uses the `gh` CLI (already assumed available in this environment, per `EXECUTOR_ROUTINE.md`) rather than a hand-rolled GitHub API client.

Out of scope:
  - No scheduling/cron wiring — this ticket only builds the script; whether/how it runs automatically (e.g. as a step in `EXECUTOR_ROUTINE.md`, or a separate scheduled job) is a follow-up decision, not bundled here.
  - No UI (M-OBS.5).
  - No retroactive backfill beyond what the "all missing" mode naturally covers when first run — no special historical-data migration.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - given a fixture ticket id and a mocked `gh pr view` JSON response with known diff stats, the sync function upserts the exact expected `files_changed`/`lines_added`/`lines_removed` values into a seeded `ticket_runs` row in a real local test DB
  - given a ticket id with no matching PR found, the function leaves the row's diff-stat fields null and does not error
  - the "all missing" mode, given a fixture store with two rows (one already populated, one null), only fetches and updates the null one

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
