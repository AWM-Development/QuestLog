# T-115 — Wire the enforcement guards into the executor's own pre-flight

**Outcome:** shipped
**Branch:** feat/m-pipeline/t-115-wire-enforcement-guards-into-preflight
**Diff:** 6 files changed, +86/-4 lines
**Complexity tier:** D
**Strategy-gate flag:** yes

## What shipped

`EXECUTOR_ROUTINE.md` now documents a pre-flight guard check: right after Step 2's pickup commit (the first point a real `origin/develop...HEAD` diff exists for a candidate), the routine invokes `scripts/ci-gate-guard.sh`, `scripts/ci-scope-guard.sh`, `scripts/ci-report-guard.sh`, and `scripts/ci-exit-condition-guard.sh` — the same scripts CI runs on the PR — before any Step 3/4 effort is spent. A candidate that fails is abandoned (worktree removed, nothing pushed) and Step 1's candidate loop picks the next one, same skip-and-note treatment as an already-blocked/gated candidate.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (843 passed)
```

Additionally, the new pre-flight mechanism itself was exercised live (not just documented), since none of this ticket's own Scope adds new application code for a test suite to cover:

```
$ bash scripts/ci-gate-guard.sh origin/develop
✅ Gate guard passed — no unresolved Gated on:/unmet Blocked on: found.

$ bash scripts/ci-scope-guard.sh origin/develop feat/m-pipeline/t-115-wire-enforcement-guards-into-preflight develop
✅ Scope guard passed.

$ bash scripts/ci-report-guard.sh origin/develop feat/m-pipeline/t-115-wire-enforcement-guards-into-preflight
✅ Report guard passed.

$ bash scripts/ci-exit-condition-guard.sh origin/develop feat/m-pipeline/t-115-wire-enforcement-guards-into-preflight
✅ Exit condition guard passed.
```

Fixture run for the skip case, per the exit condition below — a `Docs/tickets/in-progress/T-999-fixture-gated-check.md` carrying `Gated on: G-999` with a matching unresolved `Docs/tickets/gated/G-999-fixture-gate.md`:

```
$ bash scripts/ci-gate-guard.sh origin/develop
❌ Docs/tickets/in-progress/T-999-fixture-gated-check.md: carries an unresolved Gated on: G-999 (still present under Docs/tickets/gated/) — only /ungate may clear this
Exit status 1
```

(fixture commit reverted immediately after capturing this output — `git reset --hard HEAD~1` — it is not part of this PR's diff)

## Exit condition check

- "all tests green, typecheck clean, lint clean" — see Test evidence above (`lint: pass (0 warnings)`, `typecheck: pass`, `test: pass (843 passed)`).
- "`EXECUTOR_ROUTINE.md` Step 1 documents invoking the gate-guard, scope-guard, report-completeness, and exit-condition-recomputation scripts (by name) against each candidate before pickup" — see the new "Pre-flight guard check (T-115)" paragraph in `Docs/tickets/EXECUTOR_ROUTINE.md`'s Step 1 (names all four scripts explicitly, plus the T-114 red-check exclusion), and the corresponding invocation bullet added to Step 2.
- "a fixture run against a candidate ticket with an unresolved `Gated on:` line is skipped by the pre-flight logic with a note, mirroring the existing case-2/3/4 skip-and-note pattern Step 1 already uses" — see the fixture run in Test evidence above: `scripts/ci-gate-guard.sh` exits 1 with a message naming the unresolved `Gated on: G-999`, which Step 1's new text (`T-### skipped — gate-guard failed at pre-flight: <message>`) treats identically to the existing skip-and-note cases.

## Reviewer verdict

N/A — D tier; independent verification deferred to Alex's manual `/morning-review`.

## Efficiency notes

Straightforward once the underlying constraint was worked out: the guard scripts are diff-based (`origin/develop...HEAD`), so pre-flight can't meaningfully invoke them before a worktree/commit exists to diff against — this took some tracing through `packages/ci/src/*.ts` to confirm (each guard's `headBranch.startsWith("feat/")` / no-report-file early-return behavior), since the ticket's own Context files only named the shell wrappers, not the underlying logic. No retries needed once that was settled — this is a D-tier docs-only ticket, so there's no Red/Green/Refactor loop to log against.

**Retry log:** 0 retries (D-tier, single end-of-work verification pass per `EXECUTOR_ROUTINE.md` Step 4's D-tier branch).

## Anything Alex must decide

None. One judgment call worth flagging (not a decision needed, just visibility): `scope-guard`/`report-guard`/`exit-condition-guard` are wired into the same pre-flight call site as `gate-guard` even though they're no-ops for a fresh case-1 pick (nothing yet exists for them to check) — they only bite on a case-4 resume of a branch that already carries prior work. Documented in `Docs/IMPLEMENTATION_NOTES.md` § T-115 rather than left as an implicit assumption.
