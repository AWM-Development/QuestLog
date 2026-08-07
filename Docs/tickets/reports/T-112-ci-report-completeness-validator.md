# T-112 — CI report-completeness validator against `REPORT_TEMPLATE.md`

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-112-ci-report-completeness-validator
**Diff:** 9 files changed, +532/-2 lines
**Complexity tier:** M
**Strategy-gate flag:** yes

## What shipped

A new `report-guard` CI job that hard-fails a ticket-implementation PR (`feat/*` branch) when a newly-added `Docs/tickets/reports/` file isn't structurally complete against `REPORT_TEMPLATE.md`: a required `## ` heading missing, a leftover `<...>` template placeholder, or a `## Test evidence` section with no recognizable tool-output marker (`PASS`/`FAIL`/`✓`/a file:line pattern). The check logic (`validateReportStructure`) is generic over the required-headings list so `T-115` can reuse it for `BLOCKED_TEMPLATE.md`'s shape without duplicating it.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (799 passed)
```

New test file alone:
```
 ✓ |core| src/ci/report-guard.test.ts (19 tests) 3ms

 Test Files  1 passed (1)
      Tests  19 passed (19)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — `scripts/run-tests-quiet.sh` output above: lint pass, typecheck pass, test pass (799 passed).
- **a synthetic PR adding a report missing `## Reviewer verdict` fails the job** — `report-guard.test.ts` "fails a synthetic PR adding a report missing ## Reviewer verdict" (strips that section from a fully-shaped fixture, asserts `result.ok === false` and a failure mentioning `## Reviewer verdict`).
- **a synthetic PR adding a report with a leftover `<Pasted actual output...>` placeholder fails the job** — `report-guard.test.ts` "fails a synthetic PR adding a report with a leftover <Pasted actual output...> placeholder" (swaps real-looking test output for the literal placeholder string, asserts `result.ok === false`).
- **a synthetic PR adding a fully-shaped report (all headings, real-looking test output, no placeholders) passes** — `report-guard.test.ts` "passes a synthetic PR adding a fully-shaped report" (asserts `result.ok === true`, `result.failures` empty).

## Reviewer verdict

**PASS-WITH-NOTES.**

> **DRY: `gitAddedFiles` in `report-guard.ts` duplicates `gitChangedFiles` in `scope-guard.ts` almost line-for-line.**
> `packages/core/src/ci/report-guard.ts:535-559` reimplements the same "parse `git diff --name-status` output into `{path, status}[]`" logic already present at `packages/core/src/ci/scope-guard.ts:126-148`. The two are identical except for the type name (`ReportGuardChangedFile` vs `ChangedFile`) and the omission of the `R: "renamed"` status-map entry. Per `CLAUDE.md`'s "extract on the second occurrence, not the fifth" and `.claude/rules/scripts.md`'s "Don't duplicate helpers across scripts" ... this should have been lifted into `guard-utils.ts` alongside the already-shared `readRepoFile`/`resolveRepoRoot`... Not a functional bug — worth a follow-up consolidation, not a blocker.
>
> **Type duplication alongside it.** `ReportGuardChangedFile`/`ReportGuardChangeStatus` duplicate `scope-guard.ts`'s already-exported `ChangedFile`/`ChangeStatus` types rather than importing them.

Everything else checked out clean: pattern conformance with `gate-guard.ts`/`scope-guard.ts`'s shape and `ci.yml` job shape, exit condition directly exercised by named tests (19/19 passing, independently re-run), required headings matching `REPORT_TEMPLATE.md` verbatim, scope discipline (stops short of the `BLOCKED_TEMPLATE.md`/`ci.yml` wiring deferred to `T-115` while still building the reusable validator generically), no semantic/truth validation added (correctly out of scope), and comment/test quality (concrete assertions, not `toBeDefined()`-style theater).

Per `EXECUTOR_ROUTINE.md` Step 5, a PASS-WITH-NOTES proceeds straight to wrap-up — no remediation pass required. The DRY note is real and worth fixing, but it's a follow-up-sized nit (extract `gitChangedFiles`'s parser + `ChangedFile`/`ChangeStatus` types into `guard-utils.ts`, reused by both `scope-guard.ts` and `report-guard.ts`), not a functional gap.

## Efficiency notes

Went smoothly — the ticket's Context files (`REPORT_TEMPLATE.md`, `BLOCKED_TEMPLATE.md`, `ci.yml`'s guard-job shape, the resolved `G-020` excerpt) were exactly what was needed, and reading `scope-guard.ts`/`gate-guard.ts` plus their test files gave a precise, copy-adjacent shape to follow. The one self-inflicted hiccup was two `extractSection` test expectations written with a miscounted newline in the initial RED test — caught immediately on the first green run, fixed by correcting the test (not the implementation, which was right), no separate investigation needed.

**Retry log:** 1 retry: 1 `genuine_bug_caught_by_test` — not a bug in `extractSection` itself, but the test-writing pass produced two assertions with an off-by-one on the expected leading-newline count (`"\nPASS everything\n"` vs. the correct `"\n\nPASS everything\n\n"`, since the section starts right after the heading text and the fixture's `join("\n")` puts a blank line before the content); the test run's failure diff made the correct value immediately obvious.

## Anything Alex must decide

Reviewer's DRY note (`gitAddedFiles`/`ReportGuardChangedFile`/`ReportGuardChangeStatus` duplicating `scope-guard.ts`'s equivalents) is a reasonable candidate for a small follow-up ticket — consolidate the git-diff-parsing helper and the `ChangedFile`/`ChangeStatus` types into `guard-utils.ts`, same move `T-111`'s own report already made for `resolveRepoRoot`/`readRepoFile`. Not blocking this ticket's exit condition. Otherwise: none.
