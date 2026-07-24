# T-043 — Deduplicate the local test-database name list across CI and session-start.sh

**Outcome:** shipped
**Branch:** chore/pipeline/t-043-dedupe-test-db-provisioning-list
**Diff:** 5 files changed, +29/-10 lines

## What shipped

`scripts/test-db-names.sh` is now the single source of truth for the local Postgres test-database names (`questlog`, `questlog_test`, `questlog_test_mcp`), previously hand-copied with cross-referencing comments in three places. `.github/workflows/ci.yml` and `.github/workflows/e2e-release-check.yml` now source it instead of hardcoding `questlog_test_mcp` (including moving `DATABASE_URL` construction from the step's `env:` block into the `run:` script, since `env:` can't see a variable sourced inside `run:`). `.claude/hooks/session-start.sh` still hand-lists the names — see "Anything Alex must decide" below.

## Test evidence

```
$ pnpm lint
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    2.917s

$ pnpm typecheck
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    28.715s

$ pnpm test
@questlog/mcp:test: No test files found, exiting with code 0
@questlog/server:test:  Test Files  33 passed (33)
@questlog/server:test:       Tests  275 passed (275)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    41.999s
```

No app code touched, so this is the expected no-op confirming nothing broke.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — pasted above, no-op as expected.
- **`grep -rn "questlog_test_mcp" .github/workflows/ session-start.sh` shows the literal appearing in exactly one canonical file, other call sites referencing it** — partially met. After the fix, the literal is gone entirely from `ci.yml`'s and `e2e-release-check.yml`'s executable `run:`/`env:` blocks (only a descriptive comment remains in `ci.yml:73`, plus the canonical `scripts/test-db-names.sh` itself). `.claude/hooks/session-start.sh:113` still hand-lists the literal — could not be edited in this sandbox (see below), so the three-way duplication is down to two (session-start.sh + the canonical file), not one.
- **A CI run (or local dry-run reproducing the same steps) still successfully provisions and migrates all three databases** — verified via local dry-run: dropped and recreated `questlog_test_mcp` using the exact sourced-variable command from the updated `ci.yml` step, then ran `pnpm --filter @questlog/server db:migrate` against it — completed with `Migrations complete.` `session-start.sh`'s own provisioning loop is unchanged (still hardcodes the three names) and continues to work as before, since it wasn't touched.
- Also ran `actionlint` (downloaded fresh, matching `ci.yml`'s own `actionlint` job) against both edited workflow files — clean, no findings.

## Reviewer verdict

**PASS-WITH-NOTES**, verbatim:

> **Scope check.** The ticket named three call sites (`ci.yml`, `e2e-release-check.yml`, `.claude/hooks/session-start.sh`). The diff correctly creates `scripts/test-db-names.sh` as the canonical source and updates the two workflow files to source it (`.github/workflows/ci.yml:77-82`, `.github/workflows/e2e-release-check.yml:77-82`). The third file's non-update is pre-documented as an environment-level sandbox restriction (consistent with the T-027 precedent cited in `Docs/IMPLEMENTATION_NOTES.md:784`), and `Docs/IMPLEMENTATION_NOTES.md:787-790` / `CHANGELOG.md:13` both disclose this honestly rather than silently claiming full completion — per the task brief, not treated as a finding.
>
> **Implementation correctness.**
> - `scripts/test-db-names.sh` defines `TEST_DB_NAME_DEV`/`TEST_DB_NAME_UNIT`/`TEST_DB_NAME_MCP` and a `TEST_DB_NAMES` array — matches the ticket's suggested shape.
> - Both workflows correctly moved `DATABASE_URL` construction from the step-level `env:` block into the `run:` script itself (`.github/workflows/ci.yml:78-81`, `.github/workflows/e2e-release-check.yml:78-81`), which is required — GitHub Actions' `env:` block is evaluated before `run:` executes and can't see a variable sourced inside the script. This is the correct fix, not a mistake, and it's called out accurately in `Docs/IMPLEMENTATION_NOTES.md:786`.
> - Verified: `bash -n scripts/test-db-names.sh` passes; both workflow YAML files parse validly; `source scripts/test-db-names.sh` runs correctly since neither step sets a `working-directory` override (default is repo root, where the script lives).
> - Verified via grep that the literal `questlog_test_mcp` no longer appears in either workflow's executable `run:` blocks — only as descriptive prose in a comment (`.github/workflows/ci.yml:73`) and in the canonical file itself, satisfying the exit condition's grep check.
> - No scope creep: `git diff --stat` shows only the 5 expected files touched.
>
> **Notes (non-blocking):**
> - `.claude/hooks/session-start.sh:110-112` — the comment "List also duplicated in ci.yml and e2e-release-check.yml — update all three" is now stale: those two files no longer hand-duplicate the list, they source `scripts/test-db-names.sh`. Since this file couldn't be edited in this sandbox, the comment is a natural side effect of the documented restriction rather than a new oversight, but it will read as inaccurate to the next person editing this file and should be tightened once the restriction lifts.
> - `scripts/test-db-names.sh:9` — the `TEST_DB_NAMES` array is defined but currently unused by any consumer (neither workflow references it, only the three scalar vars); it's write-only until `session-start.sh` can eventually source the file. Harmless, just worth knowing it's not yet exercised.
>
> No test theater, no functionality gap against the ticket's actual (achievable-in-sandbox) scope, no rule-file deviations found for the paths touched (no `.claude/rules/*.md` governs `.github/workflows/` or `scripts/` shape specifically).

## Anything Alex must decide

1. **`.claude/hooks/session-start.sh` could not be edited in this sandbox.** Attempting the same sourcing change made to `ci.yml`/`e2e-release-check.yml` was rejected by a tool-permission restriction — this file is the repo's registered `SessionStart` hook command (`.claude/settings.json`), and this is the same restriction `Docs/IMPLEMENTATION_NOTES.md § T-027` already hit for a comment-only edit to this exact file. Net effect: the name list is deduped from three copies to two (`session-start.sh` + the new canonical `scripts/test-db-names.sh`), not to one. `session-start.sh`'s own comment at lines 110-112 is now slightly stale (still says the list is "also duplicated in ci.yml and session-start.sh," which is no longer true for the two CI files) — a one-line manual edit for whoever next has file access:
   ```
   for dbname in questlog questlog_test questlog_test_mcp; do
   ```
   → source `scripts/test-db-names.sh` and iterate `"${TEST_DB_NAMES[@]}"`, same as the two workflow files.
2. **Pre-flight backlog promotion, folded into this branch.** Before picking up T-043, this run's Step 1 pre-flight found that T-028 (the sole blocker for T-031/T-032/T-033) had merged, and promoted all three from `backlog/` to `queue/` (clearing their `Blocked on:` lines). Per the routine's branch rules (never push `develop` directly), these commits live on local `develop` and ride along in this PR rather than a separate one — they're pipeline hygiene, unrelated to T-043's own scope, called out here so the diff doesn't look like unexplained scope creep.
3. No 🧠 gates encountered in this ticket's scope.
