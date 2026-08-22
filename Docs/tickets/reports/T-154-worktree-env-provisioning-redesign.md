# T-154 — One shared Postgres instance + worktree-suffixed database names

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-154-worktree-env-provisioning-redesign
**Diff:** 16 files changed, +343/-67 lines (combined with T-131, shipped in the same PR — see that ticket's own report)
**Complexity tier:** L
**Strategy-gate flag:** no

## What shipped

Replaced the per-worktree Postgres container (checksum-derived port, `scripts/worktree-postgres-env.sh`) with one shared, long-lived Postgres instance and worktree-suffixed database names. `packages/core/src/db/test-db-url.ts`'s new `resolveWorktreeDbSuffix()` derives the isolation key from `process.cwd()` instead of an env var — the actual fix for the recurring bug class, since there's no longer a sourcing step to forget. `docker-compose.yml` pins `name: questlog`; `.claude/hooks/session-start.sh`, `scripts/test-db-names.sh`, `scripts/db-readiness.sh`, and `scripts/reap-worktree.sh` all updated to match. `scripts/worktree-postgres-env.sh` deleted.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (851 passed)
```

## Exit condition check

- "the exact T-109 reproduction... resolves and passes against the correct worktree-suffixed database" — `env -i PATH="$PATH" HOME="$HOME" npx vitest run src/ingest-db.test.ts` from `packages/observability` (fully stripped environment, no `QUESTLOG_PG_PORT`, no `CLAUDE_PROJECT_DIR`, nothing sourced) passed: `✓ src/ingest-db.test.ts (9 tests) 81ms`.
- "two concurrent worktrees' test databases coexist on the one shared instance without collision" — `SELECT datname FROM pg_database WHERE datname LIKE '%__env_redesign'` returned all four suffixed test databases (`questlog_test_core__env_redesign`, `_server`, `_mcp`, `_observability`) distinct from any other live worktree's own suffixed set on the same instance.
- "T-131's own exit condition... passes against the redesigned session-start.sh" — see `Docs/tickets/reports/T-131-worktree-secret-propagation.md`'s own Exit condition check section; all three of its live-verification runs passed against this ticket's rewritten `session-start.sh`.
- All tests green, typecheck clean, lint clean — see Test evidence above.

## Reviewer verdict

N/A — shipped as part of an interactive session with Alex present throughout (Alex's own explicit direction: "we are going to do it together interactively"), not an autonomous nightly run; Alex reviewed the diff directly rather than via the `reviewer` subagent.

## Efficiency notes

The design work (deriving isolation from `cwd` instead of an env var) took longer to reason through than to implement — the actual code change is small once the right primitive was chosen. Two real bugs were caught during live verification, not by inspection, both worth calling out since they'd otherwise have shipped silently:

1. `ensure_database_provisioned()` only passed `DATABASE_URL`, but `packages/observability/src/db/migrate.ts` checks `OBSERVABILITY_DATABASE_URL` first — once T-131's `.env` propagation put a real hosted `OBSERVABILITY_DATABASE_URL` into a worktree for the first time in this same session, the provisioning loop silently started migrating the real Neon branch instead of the local test database. Fixed by exporting both.
2. The `.env`-propagation verification's own `>>` append corrupted the primary checkout's real `.env` (missing trailing newline on the prior line) — caught and fixed immediately via a direct `nl -ba .env` check before continuing, primary `.env` confirmed restored to its original content afterward.

Both are documented in `Docs/IMPLEMENTATION_NOTES.md` § T-154 so neither has to be rediscovered.

**Retry log:** 0 retries against this ticket's own iteration cap (no Red/Green/Refactor loop — this is infra/tooling work verified by direct execution against real Postgres, not a TDD-shaped application-code change). The two bugs above were caught and fixed within the same live-verification pass, not via a failed-and-retried approach.

## Anything Alex must decide

None. One follow-up noted for visibility, not a decision needed now: `T-138` (runner-neutral `CLAUDE_PROJECT_DIR` default for `session-start.sh` itself, for a hypothetical non-Claude-Code runner) closed won't-fix as a direct consequence of this ticket — see its own report if that gap ever becomes real.

## Postscript (2026-08-20) — design revised before merging

This PR sat closed-without-merging for 11 days, then was revived and reconsidered against how Alex actually works (3-4 concurrent worktree sessions routinely). The shared-instance mechanism described above (`docker-compose.yml` pinned to `name: questlog`, isolation via worktree-suffixed database names) was **replaced** before merging: a shared instance means a Postgres restart/crash takes down every concurrent worktree session at once, not just the one that caused it. What actually shipped keeps this ticket's real fix (deriving isolation from `process.cwd()`, no env var to lose) but goes back to one dedicated Postgres container per worktree, with the *port* — not the database name — derived the same cwd-based way, plus a collision safety check (`session-start.sh` fails loudly if two worktrees' derived ports ever collide, verified live). Everything above this postscript is the original 2026-08-09 session's own record, left as written; see `Docs/IMPLEMENTATION_NOTES.md` § T-154 for what actually shipped.
