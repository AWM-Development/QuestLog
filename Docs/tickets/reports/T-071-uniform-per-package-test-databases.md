# T-071 — Uniform per-package test databases; delete `turbo.json`'s cross-package `dependsOn`

**Outcome:** shipped
**Branch:** chore/m-pipeline/t-071-uniform-per-package-test-databases
**Diff:** 14 files changed, +64/-48 lines

## What shipped

`packages/core` and `apps/server` no longer share `questlog_test` — each now runs its default and e2e test tiers against its own physical database (`questlog_test_core`, `questlog_test_server`), matching `questlog_test_mcp`'s existing isolation. `turbo.json`'s `test.dependsOn: ["^test"]`, the ordering that stood in for isolation between those two packages, is deleted entirely. CI provisioning in `ci.yml`/`e2e-release-check.yml` collapsed from two separate hardcoded steps into one generic loop over a new `TEST_DB_NAMES_CI` array (`scripts/test-db-names.sh`) — a future DB-touching package needs one name added there, not a new workflow step.

## Test evidence

```
$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    92ms >>> FULL TURBO

$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    102ms >>> FULL TURBO

$ pnpm test
@questlog/core:test:  Test Files  27 passed (27)
@questlog/core:test:       Tests  236 passed (236)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  102 passed (102)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/mcp:test:       Tests  39 passed (39)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
 Tasks:    5 successful, 5 total
Cached:    5 cached, 5 total
  Time:    95ms >>> FULL TURBO
```

One flake observed mid-run on an earlier pass: `packages/core`'s `global-setup.test.ts` failed once with an FK-violation error inside `truncateAllTables` — this is T-060's known, explicitly out-of-scope race (confirmed by re-running the file in isolation: passed cleanly, 5/5). Not related to this ticket's database-naming change; all subsequent full runs (including the final `pnpm test` above) were green.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **`packages/core` and `apps/server` each run against a distinct physical database, confirmed by a scripted check** — inserted a fixture row into `questlog_test_core`, confirmed count=0 for that row in `questlog_test_server` and count=1 in `questlog_test_core`, then cleaned up.
- **`grep -c 'dependsOn' turbo.json` shows no `dependsOn` on the `test` task** — the one remaining `dependsOn` in the file belongs to the unrelated `build` task (`"dependsOn": ["^build"]`, untouched); `"test": {}` has none. Confirmed via `pnpm turbo run test --dry=json`: every package's `test` task shows `"dependencies": []`.
- **`pnpm turbo test` passes with no ordering between core/server** — confirmed via the same `--dry=json` trace and by observing all 5 packages' test tasks execute concurrently in the real run.
- **A hypothetical 5th test-tier name works with zero further workflow edits** — temporarily added `TEST_DB_NAME_HYPOTHETICAL` to `scripts/test-db-names.sh`'s `TEST_DB_NAMES_CI` array and ran the exact loop body from `ci.yml`/`e2e-release-check.yml` locally: the database was created and migrated with no changes to either workflow file. Reverted after.
- **`pnpm turbo test:e2e` / dry-run trace confirms core and server no longer share a physical e2e database** — `packages/core/vitest.e2e.config.ts` and `apps/server/vitest.e2e.config.ts` now point at `questlog_test_core`/`questlog_test_server` respectively; `--dry=json` for `test:e2e` shows zero dependencies for every package.
- **CI trace shows exactly one loop-driven provisioning mechanism per workflow file, no `questlog` (dev) database ever created/migrated, no leftover special-cased step** — read both files in full post-edit: each has exactly one `Provision and migrate test-tier databases` step, `TEST_DB_NAMES_CI` excludes `TEST_DB_NAME_DEV` by construction, and the former MCP-specific step and top-level migration step are both gone.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim findings:

1. `.github/workflows/ci.yml:66-73` and `.github/workflows/e2e-release-check.yml:72-78` — the "Provision and migrate every test-tier database" comment block duplicates explanatory prose across both call sites instead of a one-line pointer, per `CLAUDE.md`'s "WHY only, once." Minor — both blocks do end with a genuine pointer to `IMPLEMENTATION_NOTES.md § T-027`.
2. `.github/workflows/ci.yml:21-23` and `.github/workflows/e2e-release-check.yml:41-43` — same issue, smaller scale: the bootstrap-`POSTGRES_DB` comment is copy-pasted verbatim across both files.
3. `.claude/rules/db.md:31` — "Test database: `questlog_test` on `:5433`" was now stale after the per-package split; not in this ticket's listed context files, so flagged as a follow-up rather than a blocking finding.

Findings 1–2 (comment duplication) were left as-is — cosmetic, and the reviewer explicitly called them minor with a working pointer already present. Finding 3 was fixed in a follow-up commit on this branch: `.claude/rules/db.md` and its mirrored `.cursor/rules/db.mdc` now describe the per-package databases.

## Anything Alex must decide

None. No 🧠 gate was hit — G-008 already resolved this ticket's strategy question before execution. No scope judgment calls beyond what's documented above (the two left-as-is comment-duplication notes).
