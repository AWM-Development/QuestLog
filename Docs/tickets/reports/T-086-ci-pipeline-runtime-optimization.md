# T-086 — CI pipeline runtime optimization: cross-run turbo cache persistence + template-database provisioning

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-086-ci-pipeline-runtime-optimization
**Diff:** 7 files changed, 98 insertions(+), 10 deletions(-)
**Complexity tier:** not specified in ticket
**Strategy-gate flag:** not specified in ticket (no 🧠 gate encountered)

## What shipped

`ci.yml` and `e2e-release-check.yml` now persist Turborepo's local task cache (`.turbo/cache`) across CI runs via `actions/cache@v4`, so `lint`/`typecheck`/`build` cache-hit when their inputs haven't changed since the last run on a branch. Test-tier database provisioning now migrates once per schema family into a template database and clones the rest via `CREATE DATABASE ... TEMPLATE` instead of replaying a full migration per database (4 full migrations → 2 templated migrations + 4 near-instant clones).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (709 passed)
```
(`scripts/run-tests-quiet.sh`, run from the T-086 worktree, log at `tmp/test-logs/run.log`)

Additional verification not covered by the above (this ticket is CI-config-only, no application test files):

```
$ pnpm turbo test --force   # bypasses turbo cache, forces a real run against the template-cloned DBs
...
 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    14.623s
```

```
$ ./actionlint -color .github/workflows/ci.yml .github/workflows/e2e-release-check.yml
(no output — zero findings)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — met, see Test evidence above.
- **two consecutive CI runs on the same branch... show a turbo cache hit for lint/typecheck/build on the second run** — verified the *mechanism* locally with an isolated `--cache-dir`: first run `Cached: 0/17`, second run (no source changes) `Cached: 17 cached, 17 total >>> FULL TURBO`. The actual GitHub Actions run — confirming `actions/cache@v4` itself restores/saves correctly across two real workflow runs — is **not verified by me**; that requires the PR's own CI runs, which happen after this report is posted. Flagged under "Anything Alex must decide."
- **a source-changing commit... still shows the *other*, unaffected packages' tasks cache-hitting** — verified locally: touching `packages/core/src/lib/errors.ts` (content change, not just mtime) produced `core:lint`/`core:typecheck` + build-dependent packages (`server:build`/`web:build`/`mcp-stdio:build`, via turbo's `build.dependsOn: ["^build"]`) as cache misses, while unrelated packages' lint/typecheck stayed cache-hit. Content-scoped, not all-or-nothing.
- **a trace of the provisioning step's output shows exactly one `db:migrate` invocation followed by `TEST_DB_NAMES_CI.length` `CREATE DATABASE ... TEMPLATE` calls** — implemented as **two** `db:migrate` invocations (one per schema family: core, observability), not one — see "Anything Alex must decide" below for why. Still followed by exactly `TEST_DB_NAMES_CI.length` (4) `CREATE DATABASE ... TEMPLATE` calls, verified locally against real docker-compose Postgres.
- **`pnpm test` run against a template-cloned database passes identically to a directly-migrated database** — verified: `pnpm turbo test --force` against the template-cloned local databases passed all 709 tests, same as the pre-change baseline.
- **`ci.yml` and `e2e-release-check.yml` remain structurally parallel** — both got the cache step and the template-clone step; `e2e-release-check.yml`'s cache step is a documented no-op today (that workflow doesn't run lint/typecheck/build), kept for parallelism per this exit-condition bullet's own wording.

## Reviewer verdict

**PASS-WITH-NOTES.** Full verbatim findings:

> **Verification performed (not just read):**
> - Confirmed `.turbo/cache` (repo root) is turbo v2's real default cache dir empirically (`turbo run --verbosity=2` showed `cache_dir=.../.turbo/cache`), matching the `path:` used in the `actions/cache@v4` step (`.github/workflows/ci.yml:47-53`, `.github/workflows/e2e-release-check.yml:73-79`) and the claim in `Docs/IMPLEMENTATION_NOTES.md`'s T-086 entry.
> - Ran the exact provisioning script (`.github/workflows/ci.yml:83-99`) against a real docker-compose Postgres under `bash` (the shell GH Actions `run:` steps actually use). Confirmed: two templates created, `db:migrate` invoked exactly once per schema family with `DATABASE_URL` correctly scoped to each `eval`'d command (verified with a `bash -c 'FOO=bar eval ...'` probe — var-prefix-to-builtin propagation works under `bash`, unlike `zsh`). `\dt` on the clones confirms `questlog_test_core`/`_server`/`_mcp` get the core schema (13 tables) and `questlog_test_observability` gets the independent 2-table observability schema — the two-template split is functionally correct, not just plausible.
> - Confirmed `pnpm turbo build` (the net-new step, `.github/workflows/ci.yml:69-71`) actually succeeds locally across all 7 packages.
> - Confirmed out-of-scope files are untouched: no diff to `packages/core/src/db/test-db-url.ts`, `global-setup.ts`, or any `tsconfig*.json`; `TEST_DB_NAMES`/`TEST_DB_NAMES_CI` arrays in `scripts/test-db-names.sh` are unchanged, only new template constants/function appended.
> - `scripts/test-db-names.sh:36-58`'s `test_db_template_name()` mirrors `test_db_migrate_cmd()`'s case-split via a second function rather than a duplicated switch — satisfies DRY and `.claude/rules/scripts.md`'s "don't duplicate helpers" guidance.
> - Comment discipline: `e2e-release-check.yml:85-86` uses the one-line-pointer pattern rather than duplicating `ci.yml`'s fuller rationale — correctly follows "write once, pointer at each site."
>
> **Deviations from the ticket's literal wording — all pre-cleared by task context and independently confirmed sound:** two template databases instead of one; net-new `pnpm turbo build` step; no-op cache step in `e2e-release-check.yml`.
>
> **Minor notes (not blocking):** the "Why: Docs/tickets/T-086" comment pointer isn't a resolvable path (actual file is under `in-progress/`, will move to `done/`) — findability isn't impaired since `Docs/IMPLEMENTATION_NOTES.md § T-086` is cited alongside. Milestone/notes/changelog were already updated ahead of the review step in the diff — a routine-ordering observation, not a diff-quality finding.
>
> No functionality gaps, no scope creep beyond what's pre-cleared, no test theater, no DRY violations.
>
> PASS-WITH-NOTES

## Efficiency notes

Ran long relative to a typical ticket, mostly on infrastructure discovery rather than back-and-forth fixing: confirming turbo v2's actual on-disk cache location empirically (docs alone weren't authoritative enough to trust for a CI cache path), then hitting a false alarm where the harness's own shell (zsh) made the pre-existing `VAR=val eval "$(cmd)"` provisioning pattern *look* broken (env var not propagating to the migrate subprocess) — re-tested explicitly under real `bash` (what GitHub Actions `run:` steps actually use) and confirmed it was a zsh-only artifact, not a real bug. Also discovered turbo v2 transparently shares one cache directory across all `git worktree` checkouts of this clone ("shared worktree cache"), which meant naive local before/after cache-hit tests were contaminated by other tickets' worktrees until isolated with `--cache-dir`.

**Retry log:** 0 retries against the iteration cap (no failed Red/Green cycle — this ticket is CI-config-only, verified by direct execution rather than a written test suite, so the cap's Red/Green framing doesn't map cleanly onto it). The zsh-vs-bash false alarm above cost investigation time but never produced a failing implementation attempt that needed to be redone.

## Anything Alex must decide

1. **Two template databases, not one.** The ticket's exit condition says "exactly one `db:migrate` invocation." I used two (one per schema family — `packages/observability`'s schema is independent of core/server/mcp's, per T-071/G-003) because cloning it from the wrong template would produce a database with the wrong tables. Full rationale in `Docs/IMPLEMENTATION_NOTES.md § T-086`. Reviewer confirmed this is correctness-required, not a scope liberty — flagging since it's still a literal deviation from the ticket's own exit-condition wording.
2. **Added a `pnpm turbo build` step to `ci.yml`** that didn't exist before this ticket. Needed because the exit condition asks for a cache-hit proof on `build` specifically, and `ci.yml` never ran it. This is a real, if small, behavior change to the PR gate (build failures will now block PRs that previously wouldn't have hit this check) — worth a conscious yes/no rather than a silent side effect.
3. **The actual GitHub Actions `actions/cache@v4` restore/save behavior across two real CI runs is unverified by me** — I verified the underlying turbo caching mechanism locally (cache-dir isolation, content-scoped invalidation) but couldn't verify GitHub's own cache-action plumbing without this PR's CI actually running twice. Worth checking the Actions log on this PR's second run (or an empty-commit re-run) before considering this ticket's caching exit condition fully proven, per the ticket's own "confirmed by reading the Actions log, not just 'the step succeeded'" wording.
