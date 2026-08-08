# T-114 — Red-check CI job: a PR's new tests must fail against `develop`'s pre-change implementation

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-114-ci-red-check-job
**Diff:** 6 files changed, +487/-1 lines
**Complexity tier:** L
**Strategy-gate flag:** yes (no unresolved 🧠 gate encountered in Scope — the flag marks this as `G-020`'s highest-risk candidate, already resolved by that gate's own resolution; nothing left to gate here)

## What shipped

A new CI job, "Red-Check (TDD Enforcement)": for a ticket-implementation PR, it identifies the PR's added/modified test file(s), checks out a temporary worktree of `develop`'s pre-change source, copies each touched test file's PR content onto it (never the PR's implementation changes), and runs just that file there — requiring at least one non-exempt touched test file to fail. A touched file whose assertion count is unchanged or lower than `develop`'s version (a pure test-only refactor) is exempt and never run. This is TDD enforced as a CI job rather than only a written rule (`G-020` § Resolution, Q2).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (824 passed)
```

`packages/ci` package alone (`pnpm --filter @questlog/ci run test`):
```
 ✓ src/red-check-guard.test.ts (13 tests) 3ms
 ✓ src/gate-guard.test.ts (15 tests) 4ms
 ✓ src/scope-guard.test.ts (12 tests) 4ms
 ✓ src/report-guard.test.ts (24 tests) 4ms
 ✓ src/guard-utils.test.ts (4 tests) 1029ms

 Test Files  5 passed (5)
      Tests  68 passed (68)
```

`actionlint -color .github/workflows/ci.yml` — no output, clean.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — see Test evidence above (`scripts/run-tests-quiet.sh`, full monorepo).
- **a synthetic PR whose new test genuinely exercises new behavior (fails against unmodified `develop` source, passes with the PR's own implementation) passes this job** — verified two ways: (1) `red-check-guard.test.ts`'s `"passes a synthetic PR whose new test genuinely exercises new behavior..."` case (mocked `runTestFileAgainstPreChangeSource` returning `true`). (2) A **live** run of the actual orchestration: `bash scripts/ci-red-check-guard.sh 5cc4823 feat/m-pipeline/t-114-ci-red-check-job` from this ticket's own commit (whose new `red-check-guard.test.ts` imports a module that doesn't exist at the pre-pickup commit `5cc4823`) — real `git worktree add` + symlinked `node_modules` + `pnpm exec vitest run` correctly failed against that pre-change source and the job printed `✅ Red-check passed.`
- **a synthetic PR whose "new" test passes against `develop`'s pre-change source unmodified (i.e. doesn't actually test anything new) fails this job** — verified two ways: (1) `red-check-guard.test.ts`'s `"fails a synthetic PR whose 'new' test passes against develop's pre-change source unmodified"` case. (2) Live: added a scratch commit with `packages/ci/src/smoke-trivial.test.ts` (`expect(1).toBe(1)`, true regardless of any implementation), ran `bash scripts/ci-red-check-guard.sh HEAD~1 feat/m-pipeline/t-114-ci-red-check-job` — real orchestration correctly reported `❌ none of this PR's touched test files (packages/ci/src/smoke-trivial.test.ts) fail against develop's pre-change implementation...` and exited non-zero. Scratch commit then `git reset --hard`'d out before pushing (not part of the shipped diff).
- **a synthetic PR that only refactors existing test files with an unchanged/lower assertion count is exempted, not failed** — `red-check-guard.test.ts`'s `"exempts a synthetic PR that only refactors an existing test file..."` case asserts both `result.ok === true` and that `runTestFileAgainstPreChangeSource` was never even called for the exempted file.

## Reviewer verdict

PASS — reviewer subagent's verbatim summary:

> All tests pass. This is a well-executed ticket: tight scope match, real (verified working) end-to-end mechanism, tests exercise real branches with genuine assertions (not theater), consistent with sibling guard patterns, no scope creep, no DRY violations, no duplicated rationale beyond the established repo convention.
>
> Summary of what I verified:
> - `packages/ci/src/red-check-guard.ts` and `.test.ts` follow the exact Shape-1 layout/testing pattern of `scope-guard.ts`/`report-guard.ts` (branching logic exported and unit-tested; real git/vitest orchestration left untested per the documented `db:migrate.ts`-precedent exception in `.claude/rules/scripts.md`).
> - Manually ran `pnpm --filter @questlog/ci run red-check-guard origin/develop feat/m-pipeline/t-114-ci-red-check-job` and independently reproduced the worktree-checkout + `pnpm exec vitest run` path by hand — confirmed the orchestration genuinely works (git worktree add, node_modules symlinking, and vitest execution against pre-change source all functioned, correctly reporting a fail signal for a genuinely-new test file).
> - `.github/workflows/ci.yml:346-391` (red-check job) mirrors the `pr` job's postgres service block and the `gate-guard`/`scope-guard`/`report-guard` jobs' `HEAD_BRANCH` env-injection pattern (avoiding expression injection).
> - `scripts/ci-red-check-guard.sh` matches the thin-entry-point shape of `ci-scope-guard.sh`/`ci-gate-guard.sh`/`ci-report-guard.sh`.
> - Diff is scoped tightly to exactly the 5 files needed; no scope creep, no unrelated changes, no edits to `tdd-loop/SKILL.md` (respecting Out of scope).
> - Test file exercises all four exit-condition scenarios (new-behavior test passes job, unmodified-pre-change test fails job, assertion-count-exempt refactor passes job, plus branch/no-test-file trivial passes) with real assertions on `result.ok`/`result.exempted`/`result.failures`, not `toBeDefined()`-style theater.
> - No duplicated helper logic vs. sibling guard files (`findNodeModulesDirs`/`linkNodeModules`/`packageDirFor` are new and unique to this job's real-worktree need).
> - Comment headers follow the same file-header convention already established by `scope-guard.ts`/`report-guard.ts`; no rationale duplicated from `IMPLEMENTATION_NOTES.md` (nothing written there yet for T-114, as expected pre-Step-7).
>
> No findings worth flagging.
>
> PASS

## Efficiency notes

Ran long by turn count for an L-tier ticket, mostly reading precedent (`scope-guard.ts`, `report-guard.ts`, `gate-guard.ts`, `guard-utils.ts`, `report-guard.test.ts`) before writing anything — `Context files:` only named `ci.yml`, `tdd-loop/SKILL.md`, and the G-020 resolution excerpt, none of which show the actual `packages/ci/` code pattern this ticket needed to match. Reading the sibling guards wasn't optional (the ticket's own Scope text says "Logic lives in `packages/ci/src/report-guard.ts`... `scripts/ci-report-guard.sh` is the same kind of thin, reusable entry point" — describing a pattern this ticket had to follow but whose source wasn't in Context files) — flagged as a scoping gap below rather than skipped. Time also went into two live smoke-test runs of the real worktree+vitest orchestration (beyond the unit-tested pure logic) specifically because this ticket's exit condition describes end-to-end behavior ("checks out a temporary worktree... runs just those test files"), not just the branching logic — worth the cost given this is `G-020`'s explicitly highest-risk candidate.

One format-only Biome autofix (`npx biome check --write .`) on the two new files — not counted as a retry (mechanical formatting, not a Red/Green iteration).

**Retry log:** 0 retries against the iteration cap. The single Biome format pass isn't a retry — no Red/Green cycle failed and was re-attempted; lint caught a formatting nit on the first `scripts/run-tests-quiet.sh`-equivalent check and it was auto-fixed in one command.

## Anything Alex must decide

- **The red-check job doesn't distinguish a "real" behavioral test failure from a module-resolution/import error** when the touched test file references something that doesn't exist yet in pre-change source (the common case for a brand-new test + brand-new implementation file pair) — any failure counts as the desired red signal. This matches the ticket's explicitly conservative scope ("a simple grep-based heuristic," "most novel and highest-risk candidate") and both failure kinds are equally valid proof the test didn't already pass against old code, but flagging in case Alex wants finer-grained failure-reason parsing as a follow-up.
- **The red-check job's CI cost**: it spins up its own Postgres service and runs a full `pnpm install` (via `setup-repo`) plus a real `git worktree add` + symlinked-`node_modules` + `pnpm exec vitest run` per PR — heavier than `gate-guard`/`scope-guard`/`report-guard` (metadata-only, no DB, no second install). Scope didn't call for optimizing this, and `T-128` (CI Actions minutes audit, already queued) is the natural place to revisit if it turns out to matter.
- No `G-###` gate filed — no unresolved 🧠 checkpoint was hit; `G-020` already resolved the strategic question this ticket implements.
