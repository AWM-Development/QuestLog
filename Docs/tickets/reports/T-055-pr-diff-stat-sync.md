# T-055 — PR diff-stat sync into the observability store

**Outcome:** shipped
**Branch:** feat/m-obs/t-055-pr-diff-stat-sync
**Diff:** 4 files changed, +417/-1 lines
**Complexity tier:** M
**Strategy-gate flag:** no

## What shipped

A sync script (`packages/observability/src/diff-stat-sync.ts`) that looks up a ticket's merged PR by its implementation-branch naming convention and writes files-changed/lines-added/lines-removed into that ticket's `ticket_runs` row, so diff-size correlation no longer needs a manual `gh pr list` pull per ticket. Runnable for a single ticket id or in "all missing" mode via `pnpm --filter @questlog/observability sync-diff-stats <T-###|all>`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (848 passed)
```
(`scripts/run-tests-quiet.sh`, full monorepo run, from this branch's tip.)

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above.
- **given a fixture ticket id and a mocked `gh pr view` JSON response with known diff stats, the sync function upserts the exact expected values into a seeded `ticket_runs` row in a real local test DB** — `diff-stat-sync-db.test.ts` "upserts the exact expected files_changed/lines_added/lines_removed from a mocked gh pr view response", run against `questlog_test_observability` (docker-compose Postgres, not mocked).
- **given a ticket id with no matching PR found, the function leaves the row's diff-stat fields null and does not error** — `diff-stat-sync-db.test.ts` "leaves the row's diff-stat fields null and does not error when no matching PR is found" (plus an added case: an *open*, not-yet-merged PR on a matching branch is likewise ignored).
- **the "all missing" mode, given a fixture store with two rows (one already populated, one null), only fetches and updates the null one** — `diff-stat-sync-db.test.ts` "given a store with one already-populated row and one null row, only fetches and updates the null one" — asserts the populated row's values are untouched and the mocked `gh` runner is never asked about its ticket (would throw on an unexpected invocation otherwise).

## Reviewer verdict

**PASS**

Verbatim (subagent `reviewer`):
> Scope check: All four Scope bullets are present — `ticketBranchPattern` (pure function, `diff-stat-sync.ts:18-21`), `mapPrViewToDiffStats` (`:42-48`), a CLI entry point supporting both a single ticket id and "all missing" (`:130-153`), and use of the `gh` CLI via `execFile` rather than a hand-rolled client (`:53-56`).
> Exit condition: All four machine-checkable items are covered by real tests against a local Postgres DB … verified by actually running them — 12/12 pass.
> Rule compliance: Follows `.claude/rules/scripts.md`'s dual-mode shape — guarded `import.meta.url` entry point, the CLI's own entry function is itself tested … and `db.$client.end()` is called in a `finally` block.
> No functionality gaps, no scope creep into cron/UI/backfill (all correctly left out per Out of scope), no test theater, no DRY violations introduced by this diff.

Two minor, non-blocking notes were raised (a docstring saying "upserts" when the function only updates; a test title that undersold what it demonstrated) — both fixed in a follow-up commit (`fix(T-055): clarify update-not-upsert docstring, rename confusing test`) before wrap-up, re-verified green.

## Efficiency notes

Ran interactively (`/promote-execute`), with a real environment blocker discovered during bootstrap: T-131's `.env`-propagation change broke local test-DB provisioning for `packages/observability` specifically (`OBSERVABILITY_DATABASE_URL` always wins over `DATABASE_URL` in `migrate.ts`, and `dotenv.config()` re-populates it from the now-propagated `.env` even when the provisioning loop tries to override it). Diagnosed and worked around locally (temporarily stripped the var from the worktree's own `.env`, migrated, restored it) rather than folding an infra fix into this ticket's diff. Documented in `IMPLEMENTATION_NOTES.md` § T-055 and flagged below — this is a real bug blocking every ticket's fresh-worktree bootstrap right now, not unique to T-055.

Implementation itself was straightforward once context was loaded — the three Context files named in the ticket (`tables.ts`, `ingest.ts`, `EXECUTOR_ROUTINE.md`) were sufficient; no extra files needed pulling in mid-ticket.

**Retry log:** 0 retries against the ticket's own iteration cap. One environment_setup detour (the T-131 provisioning bug above) resolved before Step 4 began, so it didn't consume any of the cap.

## Anything Alex must decide

- **The T-131 `.env`-propagation regression above needs a real fix**, not the local workaround this session used. Likely fix shape: `packages/observability/src/db/migrate.ts` should prefer an explicit `DATABASE_URL` override over `OBSERVABILITY_DATABASE_URL` when both are set (or `session-start.sh`'s local provisioning subshell should unset `OBSERVABILITY_DATABASE_URL` before invoking `db:migrate`). Not ticketed yet — flagging here first since it blocks every ticket's fresh-worktree bootstrap, not just this one.
- **M-OBS.4's milestone checkbox is intentionally left unchecked** — it covers both T-054 and T-055 jointly, and T-054 is still in `queue/`. Noted inline in `MILESTONES_V1_2_MCP.md` that T-055's half shipped.
