# T-098 — Remote-sandbox DB bootstrap: self-heal, verify loudly, close the pgvector version gap

**Outcome:** shipped
**Branch:** gates/g-018-remote-sandbox-db-provisioning-strategy (run via `/promote-execute` directly on this branch, at Alex's explicit request, rather than a separate `feat/m-pipeline/t-098-*` branch — merges as part of PR #145, not its own PR)
**Diff:** 1 file changed, 81 insertions(+), 2 deletions(-) (`.claude/hooks/session-start.sh`)
**Complexity tier:** M (from the ticket)
**Strategy-gate flag:** yes (from the ticket — resolves `G-018`)

## What shipped

`.claude/hooks/session-start.sh`'s remote-sandbox Postgres bootstrap now self-heals an interrupted `dpkg` state, attempts pgvector 0.8.x from PGDG before falling back to Ubuntu's 0.6.0 package, and ends with a verification gate that confirms every required extension and test database actually exists and is migrated — failing loudly with a specific diagnostic instead of dying silently under `set -e`.

## Test evidence

Repo-wide checks (no TS code changed by this ticket — only the bash hook):

```
$ pnpm lint
 Tasks:    7 successful, 7 total
Cached:    7 cached, 7 total
  Time:    108ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    7 successful, 7 total
Cached:    7 cached, 7 total
  Time:    101ms >>> FULL TURBO

$ pnpm --filter @questlog/server test
 Test Files  14 passed (14)
      Tests  103 passed (103)

$ pnpm --filter @questlog/core test
 Test Files  1 failed | 26 passed (27)
      Tests  1 failed | 240 passed (241)
```

The one `@questlog/core` failure (`src/db/global-setup.test.ts:45`) reproduced as **passing** when run in isolation:

```
$ pnpm --filter @questlog/core test -- src/db/global-setup.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Root cause: I ran the full suite against a shared, pre-existing local Postgres on `:5433` (also used by other concurrent worktrees on this machine) rather than a freshly isolated per-worktree stack, so the full-suite run collided with concurrent state — exactly the scenario T-072's per-worktree isolation exists to prevent. Not a regression from this ticket's change.

`bash -n .claude/hooks/session-start.sh` — parses clean.

## Exit condition check

- all tests green, typecheck clean, lint clean — **yes**, see above (one flake proven to be a shared-DB collision, not a real failure)
- `grep -c 'dpkg --configure -a'` ≥1, before the first `apt-get install` — **yes**: appears once at line 119, first `apt-get install` at line 135 (PGDG attempt) / 142 (fallback)
- verification gate proven to fail correctly, with real pasted output — **yes**:
  ```
  $ ./verify-gate-repro.sh 59999
  session-start.sh: PROVISIONING FAILED — connection to localhost:59999
  exit: 1

  $ ./verify-gate-repro-baddb.sh   # TEST_DB_NAMES includes a nonexistent db
  session-start.sh: PROVISIONING FAILED — database questlog_test_nonexistent does not exist
  exit: 1
  ```
- verification gate passes on a healthy run, printing pgvector version — **yes**:
  ```
  $ ./verify-gate-repro.sh 5433
  session-start.sh: remote sandbox DB provisioned OK — pgvector 0.8.2, 4 database(s) migrated
  exit: 0
  ```
- extension list read from `migrate.ts`'s `REQUIRED_EXTENSIONS`, not duplicated — **partially**: the new verification-gate code parses it dynamically (confirmed — no hand-copied extension names anywhere in the new code), but the machine-check itself (`grep -c "pg_trgm" .claude/hooks/session-start.sh` returns 0) **fails** — line 161 is a pre-existing, untouched comment ("`pg_trgm` alone would work as a plain owner...") that happens to mention the string. The letter of this exit condition is not met; the intent behind it is.
- `bash -n` parses clean — **yes**
- remote branch's line count not greater than before — **fails**: 84 → 159 lines. Zero dead/commented code left behind (confirmed via grep) — the growth is entirely the verification gate (~40 lines, wholly new functionality) and the PGDG-fallback block (~26 net new lines beyond the original 4-line apt call). This exit condition, which I wrote when drafting the ticket, was miscalibrated for a ticket whose main deliverable is new diagnostic logic — "delete, don't accumulate" was correctly satisfied in spirit (no leftover dead code coexisting with new code) but not in the literal line-count sense I wrote.
- no `neon` occurrence — **yes**

## Reviewer verdict

**PASS-WITH-NOTES** (fresh-context `reviewer` subagent, against the diff and ticket file). Verbatim findings:

1. *(Already-disclosed line-count deviation — reviewer was told not to re-report it.)*
2. **Finding — exit condition literally fails, unrelated to this diff's logic:** `grep -c "pg_trgm"` returns 1 because of a pre-existing, untouched comment at line 161, not the new code. Reported above, not silently passed over.
3. **Finding — inconsistent failure handling inside the verification gate:** two of the three `psql`-backed checks (`db_exists`, `ext_ok`) weren't guarded against a `psql` connection error itself (only empty-result cases), which could let `set -e` kill the script before the gate's own diagnostic printed — silently defeating the ticket's stated main deliverable. **Fixed before shipping:** both now use the same `2>/dev/null || echo none` guard the `migration_count` check already had. Re-verified: syntax clean, pass/fail repro still correct after the fix.

No scope creep, no `neon`/hosted-DB path, no changes to `test-db-url.ts`/`docker-compose.yml`/the local-dev branch, no DRY/sprawl issues.

## Efficiency notes

Ran long relative to its tier mainly because of upfront investigation (working through `IMPLEMENTATION_NOTES.md`'s full env-failure history and the `assertLocalDatabaseUrl()` guard) that happened during `/ungate` rather than this execution step — the actual TDD-equivalent work here (bash hardening, since there's no test framework for `.claude/hooks/*`, per T-041's precedent) was a single pass with a scratch repro harness, not iterative retries.

**Retry log:** 0 retries against the ticket's own iteration cap. One reviewer-flagged fix (guard the two unprotected `psql` substitutions) applied as the standard one-remediation-pass step after a PASS-WITH-NOTES, not counted as a retry.

## Anything Alex must decide

- Two exit conditions I wrote into this ticket weren't met literally (line-count-not-increased; `pg_trgm` grep). Both are explained above as intent-satisfied-but-letter-missed. If you want the `pg_trgm` mechanical check to actually pass, it'd require rewording the unrelated pre-existing comment at line 161 — a one-word change (e.g. "the trgm extension" instead of naming it), out of this ticket's stated scope but trivial if you want it done.
- This branch's remote-only code path cannot be exercised end-to-end from a local/non-remote session (`CLAUDE_CODE_REMOTE` gate). Genuine proof is the next remote executor run's session-start output — flag if that run's output doesn't show the green summary line.
- A separate finding reported earlier in this session (`test_db_migrate_cmd()`'s `DATABASE_URL="..." eval "..."` invocation not propagating the variable) was **retracted after further testing** — the original repro ran under zsh, where `eval`'s scoping differs from `bash`'s; retested under real `bash` (what `session-start.sh`'s shebang and CI's `run:` steps actually use), the pattern works correctly. Not a bug. See `Docs/IMPLEMENTATION_NOTES.md` § T-098 for the retraction record.

## Addendum (2026-07-31) — rigorous cross-environment verification, two more bugs found and fixed

Alex asked for executed proof (not reasoning) that session startup works in all three real environments, and for this branch to absorb any further env fixes rather than spawning new tickets.

### Local worktree / manual execution — real bug found and fixed

Ran the actual `.claude/hooks/session-start.sh` (respecting its `#!/bin/bash` shebang, not pasted into an interactive shell) against a genuinely fresh per-worktree Docker volume:

```
Migration failed: ... PostgresError: database "questlog_test_core" does not exist
```

Root cause: the local branch never created `TEST_DB_NAMES_CI`'s databases — only `docker-compose.yml`'s `POSTGRES_DB: questlog` exists automatically. Fixed by adding the same check-then-`CREATE DATABASE` pattern `ci.yml` already uses. Re-ran twice after the fix:

```
$ ./.claude/hooks/session-start.sh   # fresh volume
...Migrations complete.
EXIT: 0

$ ./.claude/hooks/session-start.sh   # idempotent re-run
...Migrations complete.
EXIT: 0
```

All 5 databases confirmed present and migrated (`questlog`, `questlog_test_core`, `questlog_test_server`, `questlog_test_mcp`, `questlog_test_observability`). Full repo test suite re-run against this properly-provisioned stack: `pnpm --filter @questlog/core test` → 241/241 passed; `pnpm --filter @questlog/server test` → 103/103 passed. `pnpm lint`/`pnpm typecheck` → clean (`FULL TURBO`).

### Remote sandbox — verified on real Ubuntu 24.04, not reasoned about

Built a real Docker container on Ubuntu 24.04 ("noble" — matches the sandbox's actual OS per T-056's own logged apt error), installed Node 20/pnpm 9.15.5/the real repo fresh (no `node_modules` carried over), and ran the actual remote branch of `session-start.sh` end-to-end with `CLAUDE_CODE_REMOTE=true`:

```
$ CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=/repo ./.claude/hooks/session-start.sh
...
session-start.sh: PROVISIONING FAILED — extension vector missing on database questlog_test_observability
EXIT CODE: 1
```

This was the verification gate correctly firing — but on a false positive of its own: `packages/observability`'s independent schema (G-003) never creates `vector`/`pg_trgm`, so checking for them there was wrong. Fixed (skip the check for that one database) and re-ran, both from a completely fresh container (first-ever-boot) and idempotently on the already-provisioned one:

```
$ CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=/repo ./.claude/hooks/session-start.sh   # fresh container, no prior state
...
session-start.sh: remote sandbox DB provisioned OK — pgvector 0.8.5, 5 database(s) migrated
FRESH-BOOT EXIT CODE: 0
```

Also separately verified, in the same container class:
- **PGDG-success path is real**, not just plausible: `postgresql-16-pgvector` actually installs at `0.8.5-1.pgdg24.04+1` — well above the 0.8.0 threshold `hnsw.iterative_scan` (T-097) needs.
- **Ubuntu-fallback path is real**: blackholed `apt.postgresql.org`/`www.postgresql.org` via `/etc/hosts` to simulate the egress proxy blocking it (a named risk in this ticket's original scope) — `pgdg_ok=false`, clean fallback to `postgresql-16-pgvector 0.6.0-1`, no crash, no hang.

Genuinely could not force the exact interrupted-dpkg state to re-test the heal line's failure branch specifically (modern `apt` auto-recovers most induced interruptions before the failure window closes) — the heal line's correctness rests on T-056's own real field evidence (the literal error text and the literal fix that resolved it) plus `dpkg --configure -a` being the standard, documented remedy for that exact message, not on a fresh repro here.

### GitHub Actions CI — already correct, live evidence

CI doesn't invoke `session-start.sh` at all — it has its own provisioning step in `ci.yml`/`e2e-release-check.yml` that already does `CREATE DATABASE` explicitly, so it never had this bug. Live confirmation on this PR: `gh pr checks 145` — all 6 checks pass, including the full `Lint · Typecheck · Test` job.

### Second reviewer pass (fresh-context `reviewer` subagent, on the two new fixes)

**PASS-WITH-NOTES.** Confirmed: the `TEST_DB_NAME_OBSERVABILITY` skip uses the existing sourced variable, not a hand-copied string; the `PGPASSWORD` vs. `sudo -u postgres` difference between branches is a legitimate fork on genuinely different infrastructure, not sloppy copying; no quoting/injection risk (`dbname` values only ever come from the static `TEST_DB_NAMES` arrays). Two notes acted on: trimmed an over-long inline comment down to a one-line pointer (full narrative moved to `IMPLEMENTATION_NOTES.md` § T-098, per this repo's own comment-discipline convention); the scope concern (this touches the local-dev branch, which this ticket's own Out-of-scope explicitly named) is addressed by this ticket's own Addendum section rather than a new `T-###`, per Alex's explicit instruction. One minor, non-blocking DRY note left as-is: the check-then-`CREATE DATABASE` pattern now appears twice (local + remote branches) with different auth mechanisms — the reviewer judged forcing a shared helper not clearly worth it given the branches' genuinely different infrastructure.
