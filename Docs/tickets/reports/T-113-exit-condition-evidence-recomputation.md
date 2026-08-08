# T-113 — Exit-condition evidence recomputation

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-113-exit-condition-evidence-recomputation
**Diff:** 9 files changed, +502/-4 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

A new `exit-condition-guard` CI job that, for a ticket-implementation PR adding a report to `Docs/tickets/reports/`, recomputes whether that report's `## Exit condition check` bullets actually cite real files/tests present in the diff — rather than trusting the agent's prose. A bullet citing a specific `*.test.ts[x]` file (and, usually, a quoted test name) is checked against the PR's actual diff and that file's content; a bullet naming no specific file is flagged "unverifiable mechanically," not failed. Logic lives in `packages/ci/src/exit-condition-guard.ts`, wired into `.github/workflows/ci.yml` alongside its sibling guards (`gate-guard`, `scope-guard`, `report-guard`).

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (822 passed)
```

`packages/ci`'s own suite (the package this ticket's code lives in):

```
✓ src/gate-guard.test.ts (15 tests) 4ms
✓ src/scope-guard.test.ts (12 tests) 4ms
✓ src/report-guard.test.ts (24 tests) 4ms
✓ src/exit-condition-guard.test.ts (11 tests) 3ms
✓ src/guard-utils.test.ts (4 tests) 929ms

Test Files  5 passed (5)
     Tests  66 passed (66)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output above: lint pass, typecheck pass, test pass (822 passed), full monorepo run.
- **a synthetic PR whose report claims a test at a file:line that doesn't exist in the diff fails the job** — `exit-condition-guard.test.ts` "fails a synthetic PR whose report claims a test at a file that doesn't exist in the diff" (report cites `packages/ci/src/nope.test.ts:84`, which isn't in the synthetic diff), asserting `result.ok === false` and a failure message naming `nope.test.ts`.
- **a synthetic PR whose report correctly cites a real test file/name present in the diff passes** — `exit-condition-guard.test.ts` "passes a synthetic PR whose report correctly cites a real test file/name present in the diff" (report cites `example.test.ts` `"does the thing correctly"`, both present in the synthetic diff), asserting `result.ok === true` and `result.failures` empty.
- **a synthetic PR with a purely behavioral (non-file-citing) exit-condition bullet passes with an "unverifiable mechanically" annotation, not a failure** — `exit-condition-guard.test.ts` "passes with an unverifiable-mechanically annotation for a purely behavioral bullet, not a failure", asserting `result.ok === true`, `result.failures` empty, and `result.unverifiable.length === 1`.

## Reviewer verdict

**PASS.** Verbatim:

> Everything checks out: the implementation is structurally consistent with sibling guards (gate-guard.ts, scope-guard.ts, report-guard.ts), correctly reuses `findTicketFile` and adds `parseBulletList` to the shared `guard-utils.ts` rather than duplicating, the CI job wiring in `.github/workflows/ci.yml` matches the established shape exactly, and the wrapper script mirrors `ci-report-guard.sh`. Tests exercise all four of the ticket's exit conditions with real assertions against synthetic diffs (not `toBeDefined()`-style theater), and a live `vitest run`/`tsc`/`biome` pass confirms green. No scope creep beyond the declared Scope, and the T-055/T-114 boundaries are respected (no diff-stat sync, no test execution).
>
> Minor observations (non-blocking):
>
> - `packages/ci/src/guard-utils.ts:58-77` (`parseBulletList`) has no direct unit test in `guard-utils.test.ts`; it's only exercised indirectly through `exit-condition-guard.test.ts`, and none of those fixtures cover the continuation-line-merge branch (`bullets[bullets.length - 1] += ...`) at `guard-utils.ts:73`. Low risk since the merge logic is simple, but it's the one code path in this diff with zero test coverage, direct or indirect.
> - `packages/ci/src/exit-condition-guard.ts:73` (`checkBulletCitation`) matches a cited file by `path.endsWith(citedPath)`, so a bullet citing a bare filename (e.g. `example.test.ts`) would match any file with that basename anywhere in the diff, not necessarily the one the report author meant. Same weak-matching tradeoff the ticket's "grep-shaped, not semantic" framing implies is acceptable, so not a real gap, just worth a human's awareness.

## Efficiency notes

Straightforward implementation once the three sibling guard jobs (`gate-guard.ts`, `scope-guard.ts`, `report-guard.ts`) were read for precedent — the ticket's own Context files pointed at `T-055`'s ticket for the boundary and `ci.yml`/`G-020` for the job shape, but the actual code pattern (DI'd deps, Shape 1 dual-mode script, `realDeps`/`printResult`/`import.meta.url` guard) had to be inferred from the existing `packages/ci/src/` siblings rather than being spelled out in the ticket — reading those three files first (not in the declared Context files list, but directly implied by "same detection as T-111/T-112") avoided reinventing an inconsistent shape. No environment issues, no failed approaches.

**Retry log:** 0 retries.

## Anything Alex must decide

None. The reviewer's two non-blocking notes (missing direct unit test for `parseBulletList`'s continuation-merge branch; weak `endsWith` file-citation matching) are recorded above for awareness but don't block shipping — both were explicit, considered tradeoffs (see `IMPLEMENTATION_NOTES.md` § T-113), not oversights.
