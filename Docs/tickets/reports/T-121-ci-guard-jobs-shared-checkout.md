# T-121 — Consolidate ci.yml's guard jobs onto one shared checkout + diff

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-121-ci-guard-jobs-shared-checkout
**Diff:** 1 file changed, +124/-102 lines (`.github/workflows/ci.yml`)
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`ci.yml`'s `doc-sync`, `migration-guard`, `mockup-guard`, and `impl-notes-health` jobs — each of which used to independently run a full-history `actions/checkout@v5` and independently recompute the same PR changed-file diff — are now steps inside one `guards` job with a single shared checkout and a single diff computation exposed as a job output (`steps.changed-files.outputs.changed`). Each check step's logic is unchanged (same warning-only exit-0 paths for doc-sync/impl-notes-health, same hard exit-1 paths for migration-guard/mockup-guard), and each runs with `if: always()` so one check failing doesn't prevent the others from still running — reproducing the old independent-jobs behavior inside the single job.

## Test evidence

```
$ scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (843 passed)
```

```
$ actionlint .github/workflows/ci.yml
(no output — clean)
```

Local extraction-and-replay of all four check bodies against synthetic `CHANGED`/`PR_TITLE` inputs (one violation-path case and one pass-path case per check, 8 total):

```
PASS: doc-sync violation path
PASS: doc-sync pass path
PASS: migration-guard violation path
PASS: migration-guard pass path
PASS: mockup-guard violation path
PASS: mockup-guard pass path
PASS: impl-notes-health violation path
PASS: impl-notes-health pass path
All 8 guard-logic cases matched expected pass/violation-path behavior.
```

## Exit condition check

- **`ci.yml` has exactly one job performing `actions/checkout@v5` with `fetch-depth: 0` for the guard-check purpose (down from four)** — verified by inspection: `guards` job (`ci.yml`) has one `actions/checkout@v5` step with `fetch-depth: 0`; the four former jobs' own checkout steps are gone.
- **The changed-file diff is computed exactly once per workflow run, exposed as a job output consumed by each of the four check steps** — the "Compute changed files" step runs `git diff --name-only origin/${{ github.base_ref }}...HEAD` once and writes it to `steps.changed-files.outputs.changed` via the standard multiline `GITHUB_OUTPUT` heredoc form; all four check steps read that output via `env: CHANGED: ${{ steps.changed-files.outputs.changed }}` instead of recomputing it.
- **All four checks (doc-sync, migration-guard, mockup-guard, impl-notes-health's two sub-checks) still run and produce byte-identical pass/fail behavior to before the refactor** — verified two ways: (1) the check bodies in the diff are line-for-line identical to their pre-refactor form except for reading `$CHANGED` from an env var instead of a local `git diff` call; (2) the 8-case local replay above (violation path + pass path per check) confirms the extracted logic's exit codes and messages match the expected pre-refactor behavior for each.
- **All tests green, typecheck clean, lint clean** — see Test evidence above.

## Reviewer verdict

PASS-WITH-NOTES

Reviewer's verbatim findings:

> **Scope/exit condition:** All four checks' bodies (doc-sync, migration-guard, mockup-guard, impl-notes-health's two sub-checks) are byte-identical to their pre-refactor logic (verified line-by-line against the pre-image in the diff) — no exit-0/exit-1 semantics changed. Single shared checkout (`.github/workflows/ci.yml:102-104`) with one diff computation (`ci.yml:107-114`) replaces the four independent checkouts/diffs. `if: always()` is correctly applied to every check step after the diff-computation step (`ci.yml:117,140,174,187,206`), preserving the old cross-job independence (one guard's failure doesn't skip the others). The `GITHUB_OUTPUT` multiline heredoc pattern (`ci.yml:110-114`) is the standard, correct form. No scope creep — verified via `git show de38ad9`, the actual ticket commit touches only `ci.yml`.
>
> One edge case not covered: if the "Compute changed files" step itself fails, it lacks `if: always()`, so it's skipped rather than always running, and `steps.changed-files.outputs.changed` would be unset — each downstream check step (all `if: always()`) would still run with an empty `CHANGED` var and likely print false "passed" messages instead of surfacing the underlying failure. This is a narrow deviation from strictly byte-identical behavior in a failure path that almost never triggers in practice — worth a note, not a blocker.
>
> **Comment discipline:** `ci.yml:184` (Mockup Guard step) lost its original explanatory WHY-comment ("Docs/mockups/ is generated manually in Claude Design ... read-only to agents ... hard fail, not a warning") that used to sit directly above the old `mockup-guard` job. The new job-level comment only notes generically that "migration-guard/mockup-guard['s] hard exit-1 paths" are unchanged, without carrying forward the specific rationale for why mockup edits are a hard fail while doc-sync/impl-notes-health are warnings. Minor loss of documented context, not a functional issue.
>
> - `.github/workflows/ci.yml:117-208` — "Compute changed files" step lacks `if: always()`; if it fails/is skipped, downstream `if: always()` check steps still run with an empty `CHANGED`, potentially printing false-pass output instead of a clear failure. Narrow edge case, worth a glance.
> - `.github/workflows/ci.yml:184` — the original inline rationale comment explaining why Mockup Guard hard-fails (unlike doc-sync's warning-only path) was dropped during consolidation and not replaced with an equivalent pointer.

Per `EXECUTOR_ROUTINE.md` Step 5, PASS-WITH-NOTES proceeds straight to wrap-up — both notes are documented above and in "Anything Alex must decide" rather than remediated in a second pass.

## Efficiency notes

Straightforward, in-scope config-only ticket — no environment friction, no unexpected context gaps. `Docs/IMPLEMENTATION_NOTES.md` § T-121 records the one non-obvious decision made (why "Compute changed files" itself is excluded from the `if: always()` pattern applied to every step after it).

**Retry log:** 0 retries — this is an `S`-tier, config-only (docs/config-only fast path per `EXECUTOR_ROUTINE.md` Step 4), so there was no per-checkpoint Red/Green/Refactor loop to retry against; the change was made directly and verified once.

## Anything Alex must decide

Both reviewer notes are left as-is rather than remediated (PASS-WITH-NOTES per the routine goes straight to wrap-up):

1. The "Compute changed files" step doesn't carry `if: always()` — if checkout or the diff computation itself fails, the four downstream check steps (all `if: always()`) still run against an empty `$CHANGED` and would print false-pass messages instead of surfacing the real failure. Narrow edge case (no observed precedent of this step failing in this pipeline), documented in `IMPLEMENTATION_NOTES.md` § T-121 rather than guarded against. Worth a follow-up if it's ever actually hit.
2. Mockup Guard's original inline WHY-comment (why mockup edits hard-fail while doc-sync/impl-notes-health only warn) wasn't carried forward into the consolidated job — the job-level comment only generically notes which checks keep their hard-fail paths. A one-line pointer restoring that specific rationale would be a cheap follow-up if it's noticed as a gap later.

Both are minor and don't block shipping this ticket's actual scope (structural dedup of the checkout+diff precursor, no behavior change to what any check does or whether it can fail a PR).
