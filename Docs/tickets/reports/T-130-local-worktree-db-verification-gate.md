# T-130 — Verification gate for the local worktree DB-provisioning path

**Outcome:** shipped
**Branch:** fix/m-efficiency/t-130-local-worktree-db-verification-gate
**Diff:** 2 files changed, +121/-54 lines (`.claude/hooks/session-start.sh`, new `scripts/db-readiness.sh`)
**Complexity tier:** S
**Strategy-gate flag:** yes — drafted directly by `/ungate` resolving G-035

## What shipped

The local (non-remote) branch of `.claude/hooks/session-start.sh` now verifies its own database provisioning at the end of the create/migrate loop — a database that's missing, missing a required extension, or has no applied migrations now fails the hook loudly with a named diagnostic, instead of silently exiting 0. The underlying "is this database ready" check moved out of the remote branch's own inline definition into a new shared, sourceable file (`scripts/db-readiness.sh`), parameterized by an injected psql-runner function so each branch keeps its own connection details (docker-compose non-superuser locally, native superuser remotely) without duplicating the check itself.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (749 passed)
```

Plus live, non-Vitest verification of the bash script itself (no existing test harness covers `session-start.sh`; T-098/T-125/T-127 established this same live-verification convention for this file):

```
--- healthy worktree, full modified hook run ---
EXIT CODE: 0
...
Migrations complete.

--- db_readiness_issue() in isolation, dropped questlog_test_observability ---
database questlog_test_observability does not exist

--- db_readiness_issue() in isolation, questlog_test_core with migrations table cleared ---
database questlog_test_core has no applied migrations (drizzle.__drizzle_migrations empty or missing)

--- fault-injection harness: real create-loop + real gate, test_db_migrate_cmd
    overridden to no-op for observability ("left unmigrated") ---
loop exit: 0 (loop itself is oblivious to the fault — the injected no-op reports success)
session-start.sh: PROVISIONING FAILED — database questlog_test_observability has no applied migrations (drizzle.__drizzle_migrations empty or missing)
HARNESS EXIT CODE: 1

--- final real hook run after restoring state ---
EXIT CODE: 0
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output above.
- **`db_readiness_issue()` (or equivalent) is called from both branches of `session-start.sh`, confirmed via `grep`, not duplicated** — `grep -n "db_readiness_issue" .claude/hooks/session-start.sh scripts/db-readiness.sh` shows one definition (`scripts/db-readiness.sh:32`) and two call sites (`session-start.sh:103` local, `session-start.sh:236`/`273` remote).
- **A deliberately broken worktree (one `TEST_DB_NAMES_CI` database dropped or left unmigrated) causes the local branch to exit non-zero with a diagnostic naming the specific database and the specific unmet criterion — demonstrated live** — the fault-injection harness above runs the real, committed create-loop and gate logic verbatim (only `test_db_migrate_cmd` is overridden, to simulate "left unmigrated" since `db:migrate`'s own idempotent extension/migration-ensure step makes an organically-dropped database self-heal before the gate ever sees it broken): exits 1 with `PROVISIONING FAILED — database questlog_test_observability has no applied migrations (...)`. Separately, direct calls to the real `db_readiness_issue()` against a genuinely-dropped database and a database with its migrations table cleared both return the correct diagnostic in isolation.
- **A normal, already-healthy worktree still exits 0 with no behavior change to the successful path** — confirmed both before any change (baseline) and after, on the same worktree.

## Reviewer verdict

**FAIL**, from the `reviewer` subagent's first pass — but every blocking finding was that the ticket's Definition-of-Done paperwork (milestone checkbox, `IMPLEMENTATION_NOTES.md` entry, `CHANGELOG.md` entry, this report) hadn't landed yet at review time. Per `EXECUTOR_ROUTINE.md`, Step 5 (review) runs *before* Step 7 (wrap-up), which is exactly when that paperwork is produced — so those findings reflect the pipeline's own ordering, not a defect in the diff. All four are done as part of this same commit/wrap-up.

The reviewer's one genuine code-quality finding (non-blocking, "worth a one-line comment"): `db_readiness_issue()`'s existence check always queries against `$TEST_DB_NAME_DEV` rather than the database actually being checked (correct, since `pg_database` is a cluster-wide catalog — any existing database's connection can look up any other), but this silently depends on `$TEST_DB_NAME_DEV` itself already existing, which the reviewer noted wasn't documented anywhere. Addressed in the one remediation pass: added a comment explaining the two different reasons this holds per branch (docker-compose's `POSTGRES_DB` creates it locally before the hook ever runs; it's `TEST_DB_NAMES`'s own first array entry remotely, checked in order). Confirmed via `shellcheck`: no new findings (only pre-existing info-level `SC1091`/`SC2016` notices), and via `grep`: the "not duplicated" exit condition holds.

## Efficiency notes

Most of the ticket's cost was in verification design, not implementation — `db:migrate`'s own idempotent "always ensure extensions, always apply pending migrations" behavior means the local branch's create/migrate loop is already fully self-healing for every failure class the gate checks, so the ticket's own suggested repro ("drop a database, re-run the hook") doesn't actually exercise the gate — the loop silently fixes it first. Recognizing that and designing a fault-injection harness (real create-loop + real gate code, with only the migrate-command mapping overridden for one database) that could actually prove the gate independently of the loop's own self-healing took more thought than the extraction/wiring itself, which was mechanical once the design was settled. Also cost real turns: rediscovering the exact zsh-vs-bash word-splitting gotcha `IMPLEMENTATION_NOTES.md` § T-098 already documents (this session's own interactive shell is zsh; the hook's shebang is bash) — an early isolated test of the extracted `required_extensions` parsing showed a `for` loop iterating once over both extension names concatenated by a literal newline, which only reproduced because it was tested by pasting into the interactive shell instead of via `bash -c`. Switching to `bash -c` immediately resolved it and cost one wasted verification cycle, not a real bug.

**Retry log:** 0 retries against the ticket's iteration cap (3). One post-review remediation pass (comment-only, addressing the reviewer's non-blocking code-quality note) — not counted as a cap retry since it wasn't a Step 4 Red/Green failure.

## Anything Alex must decide

None.
