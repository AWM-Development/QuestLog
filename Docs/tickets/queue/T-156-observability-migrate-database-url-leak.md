# T-156 — `ensure_database_provisioned` leaks `OBSERVABILITY_DATABASE_URL` past its own `DATABASE_URL` override

Milestone ref: M-BUG.2 (`Docs/milestones/MILESTONES_BUGS.md`)

Complexity tier: S

Strategy-gate flag: no

Priority: P1

Branch: fix/m-bug/t-156-observability-migrate-database-url-leak

Context files (load ONLY these):
  - scripts/db-readiness.sh (`ensure_database_provisioned`, the shared function both `session-start.sh` branches call)
  - packages/observability/src/db/migrate.ts (the connection-string resolution order this ticket doesn't change, only stops being silently overridden)
  - .claude/hooks/session-start.sh (both call sites: the local docker-compose branch's `ensure_database_provisioned local_psql_query local_create_database ...` loop, and the remote-sandbox branch's `ensure_database_provisioned remote_psql_query remote_create_database ...` loop — confirm both still pass through unaffected)
  - scripts/test-db-names.sh (`test_db_migrate_cmd`, which `ensure_database_provisioned` evals — confirms the observability case is `pnpm --filter @questlog/observability db:migrate`, the only case actually exercising `migrate.ts`)

## Relevant background
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-131, as of 2026-08-10

**`session-start.sh`'s local worktree-provisioning branch now copies the primary checkout's `.env` into a new worktree whenever that worktree doesn't already have its own** — `git worktree add` never carries gitignored files (`.env`/`.env.local`/`.env.*.local`) into the new worktree it creates, so any locally-scoped secret set only in the primary checkout (e.g. `OBSERVABILITY_DATABASE_URL`, provisioned per T-095's PR #196 review) never reached a ticket's own worktree, silently keeping `packages/observability`'s graceful-degradation path active on every ticket run indefinitely. [...] Copies the whole file, not an allowlist of variable names, per the ticket's own reasoning: the more general fix covers any current or future locally-scoped secret, not just this one.

That fix is what exposes this ticket's bug: since T-131, every fresh worktree's `.env` now carries the real, remote-Neon `OBSERVABILITY_DATABASE_URL` (whenever the primary checkout has one set). `packages/observability/src/db/migrate.ts`'s own `dotenv.config({ path: "../../.env" })` call loads it into `process.env` unconditionally (dotenv never overwrites an already-set var, but nothing upstream of that call has set this one yet), and `main()`'s connection-string resolution — `process.env.OBSERVABILITY_DATABASE_URL ?? process.env.DATABASE_URL ?? testDbUrl(...)` — puts it first in priority. Meanwhile `scripts/db-readiness.sh`'s `ensure_database_provisioned()` only ever sets `DATABASE_URL` for its migrate child process (`DATABASE_URL="$database_url" eval "$(test_db_migrate_cmd "$dbname")"`) — it never touches `OBSERVABILITY_DATABASE_URL`, so the ambient one from `.env` wins every time. Net effect: the `pnpm --filter @questlog/observability db:migrate` call this function makes for the `questlog_test_observability` case runs migrations against the real remote Neon `questlog_observability` database instead of the intended local one — silently, since the command still succeeds (against the wrong database), and `db_readiness_issue()`'s subsequent local-Postgres check then correctly reports `questlog_test_observability` as still unmigrated, which is the only externally visible symptom.

Scope: In `ensure_database_provisioned()` (`scripts/db-readiness.sh`), stop the migrate child process from inheriting an ambient `OBSERVABILITY_DATABASE_URL` — the function's whole contract is "this `$database_url` argument is authoritative for this database," and any other DB-selecting env var reaching the child process undermines that contract regardless of which var it happens to be named. Concretely: wrap the existing `eval "$(test_db_migrate_cmd "$dbname")"` call in a subshell that unsets `OBSERVABILITY_DATABASE_URL` before running it, e.g.:

```bash
ensure_database_provisioned() {
	local run_query="$1" create_fn="$2" database_url="$3" dbname="$4"
	local db_exists
	db_exists=$("$run_query" "$TEST_DB_NAME_DEV" "SELECT 1 FROM pg_database WHERE datname='${dbname}'")
	if [ "$db_exists" != "1" ]; then
		"$create_fn" "$dbname"
	fi
	(
		unset OBSERVABILITY_DATABASE_URL
		DATABASE_URL="$database_url" eval "$(test_db_migrate_cmd "$dbname")"
	)
}
```

`unset` inside a `( ... )` subshell only affects that subshell's environment (and anything it execs), never the calling `session-start.sh` process's own `OBSERVABILITY_DATABASE_URL` — so a legitimate later use of that var elsewhere in the same hook run is untouched. Setting it to empty (`OBSERVABILITY_DATABASE_URL=`) instead of `unset` would not fix this: `migrate.ts`'s `??` check treats an empty string as defined, not nullish, so it would still short-circuit past `DATABASE_URL`. This is the one call site that needs the unset — `test_db_migrate_cmd`'s non-observability branch (`pnpm --filter @questlog/server db:migrate`) never reads `OBSERVABILITY_DATABASE_URL` at all, so the unset is a no-op for every other `dbname` this function provisions, but keeping it unconditional (rather than branching on `dbname`) keeps the function's contract uniform and avoids a second, easy-to-miss desync point if a future database ever reads a similarly-named override var.

Leave `packages/observability/src/db/migrate.ts`'s own resolution order (`OBSERVABILITY_DATABASE_URL ?? DATABASE_URL ?? testDbUrl(...)`) unchanged — a developer running `pnpm --filter @questlog/observability db:migrate` directly (outside this hook) still legitimately wants `OBSERVABILITY_DATABASE_URL` to take priority when they've deliberately set it (e.g. to point at a real staging/remote observability DB), and that call path has no relationship to this bug. This ticket only closes the gap where the *automated provisioning* call path silently loses its own override.

Out of scope:
  - Any change to `migrate.ts`'s connection-string resolution order or to `dotenv.config()`'s call — see reasoning above.
  - A general audit of every other env var `ensure_database_provisioned`'s migrate child process might inherit ambiently — this ticket fixes the one now-confirmed leak (`OBSERVABILITY_DATABASE_URL`), not a hypothetical broader class.
  - Re-provisioning already-existing worktrees created between T-131 merging and this ticket shipping — Exit condition's repro/verification covers detection and the forward-looking fix; a worktree stuck with an unmigrated `questlog_test_observability` from this window self-heals the next time `session-start.sh` runs after this ticket lands (the fast-path pre-check in both `session-start.sh` branches already re-checks readiness and re-runs the create/migrate loop for anything still failing it).
  - `db_readiness_issue()` itself, or the verification-gate loops in `session-start.sh` that call it — those already correctly detect the unmigrated-database symptom; this ticket fixes the cause, not the detector.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - repro, before the fix (documented in the PR description or `IMPLEMENTATION_NOTES.md`, not required to re-run after — see below): from `packages/observability`, run `OBSERVABILITY_DATABASE_URL=<any local test-db URL, e.g. postgresql://questlog:questlog@localhost:<worktree-port>/questlog_test_observability> npx tsx src/db/migrate.ts` and confirm — against the unpatched `scripts/db-readiness.sh` — that a subsequent `ensure_database_provisioned`-driven call for this database still runs against whatever `OBSERVABILITY_DATABASE_URL` happens to be ambient in the shell, not the `$database_url` argument passed in
  - after the fix: with `OBSERVABILITY_DATABASE_URL` set to a *different* value than the local test-DB URL in the shell environment before `session-start.sh` runs (simulating a T-131-propagated remote Neon URL), confirm `ensure_database_provisioned`'s migrate child process actually connects to the local `$database_url` argument, not the ambient `OBSERVABILITY_DATABASE_URL` — e.g. by adding a temporary debug line or by confirming `questlog_test_observability`'s local Postgres instance gains new rows in `drizzle.__drizzle_migrations` after the call, while the ambient `OBSERVABILITY_DATABASE_URL`'s target database is untouched
  - re-run `db_readiness_issue local_psql_query questlog_test_observability` (or the remote-branch equivalent) after the above and confirm it reports no issue — the local database is genuinely migrated, not just believed to be

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_BUGS.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
