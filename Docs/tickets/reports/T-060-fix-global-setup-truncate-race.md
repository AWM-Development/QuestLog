# T-060 — Fix flaky FK-violation race in global-setup.test.ts's truncateAllTables tests

**Outcome:** shipped
**Branch:** chore/pipeline/t-060-fix-global-setup-truncate-race
**Diff:** 1 file changed, +98/-7 lines (`packages/core/src/db/global-setup.test.ts`)
**Complexity tier:** not specified — ticket predates T-050's ticket-format fields
**Strategy-gate flag:** not specified — ticket predates T-050's ticket-format fields

## What shipped

Root-caused and fixed an intermittent FK-violation race in `global-setup.test.ts`'s two tests that call `truncateAllTables` mid-suite. Each now takes an explicit `LOCK TABLE ... IN EXCLUSIVE MODE` (parent-first) before truncating, blocking concurrent writers instead of racing them. A new regression test deterministically exercises the exact race window to guard against reintroduction. `truncateAllTables` itself (production code) is untouched.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (658 passed)
```

Targeted verification (in addition to the full-suite run above):
- New regression test + the two originally-flaky tests: 20/20 consecutive runs pass (`npx vitest run src/db/global-setup.test.ts`, run in a loop).
- Full `packages/core` suite: 5/5 consecutive runs pass (`npx vitest run`).
- Deterministic repro scripts (throwaway, not committed) proving each fix independently:
  - Original FK-violation race: reproduces the exact `sources_campaign_id_campaigns_id_fk` violation on every run without the lock; zero violations across repeated runs with it.
  - Deadlock regression (found by review, see below): reproduces `deadlock detected` on every run with the lock in `TABLES_IN_DELETE_ORDER`'s child-first order; zero deadlocks across repeated runs with the lock reversed to parent-first.

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see Test evidence above.
- **Reproduce the race first, before landing any fix** — done via a throwaway Node script that manually interleaves the real delete-order statements around a real concurrent insert from a second DB connection (not relying on flaky full-suite timing); reproduced the exact production error message deterministically on every run.
- **After the fix, the same repro shows zero FK-violation failures** — the same interleaving, now expressed as a permanent Vitest regression test (`global-setup.test.ts`'s "blocks (rather than races) a concurrent insert into a referencing table while truncating"), passes 20/20 consecutive runs; the two originally-flaky tests do too.
- **`Docs/IMPLEMENTATION_NOTES.md` documents the confirmed root cause and the mechanism of the fix** — new `## T-060` section, including the deadlock finding and remediation from review.

## Reviewer verdict

**FAIL** (first pass), remediated, not re-reviewed (routine allows exactly one remediation pass regardless of outcome).

Reviewer's verbatim findings:

> `packages/core/src/db/global-setup.test.ts:23-28,80,128` — chosen fix (`LOCK TABLE` in `TABLES_IN_DELETE_ORDER` order) has a demonstrated deadlock interaction with the codebase's dominant "insert campaign first, then a child table" test pattern (e.g. `packages/core/src/services/session.service.test.ts:19-23`). Reproduced with a targeted two-connection script; Postgres returns `deadlock detected`. This replaces a rare, observed FK-violation flake with a different rare, reproducible deadlock flake against ordinary concurrent test files — not through the new regression test's apparatus.
>
> `packages/core/src/db/global-setup.test.ts:13-22` — comment length/duplication vs. `CLAUDE.md`'s WHY-once rule; should collapse to a pointer once `IMPLEMENTATION_NOTES.md` gets the corresponding entry (not blocking by itself).
>
> Branch also carries an unrelated queue-promotion commit (`d51842b`) — flag for the human merging, not a defect introduced by this ticket's work.

**Remediation (single pass):**
1. Reversed `lockTruncationTargets`'s lock order to parent-first (reverse of `TABLES_IN_DELETE_ORDER`), matching the dominant "campaign row first" test pattern the reviewer cited. Independently re-verified with a targeted two-connection repro script: deadlocks deterministically with the old order, does not with the new one.
2. Collapsed the 10-line inline comment to a short pointer at `Docs/IMPLEMENTATION_NOTES.md § T-060` (now written).
3. The unrelated `d51842b` commit is expected: it's `EXECUTOR_ROUTINE.md` Step 2's backlog-promotion housekeeping (T-054/T-055/T-059 unblocked by T-053's merge), committed to this session's worktree before ticket pickup, per the routine — not scope creep from this ticket's own work. Left as-is; squash-merge (`CLAUDE.md`'s convention) collapses it into one commit on merge regardless.

Re-ran the full lint/typecheck/test chain and the 20-run/5-run repeated verification after remediation — all clean (see Test evidence above).

## Efficiency notes

Ran long relative to a typical pipeline-hygiene ticket because the reviewer's finding was itself a genuine, previously-undiscovered bug in the fix (not a false positive) — verifying it required building and running a second, independent two-connection repro script (the deadlock case), on top of the first one already built to prove the original race. Both repro scripts were real, deterministic reproductions (not assumed-and-moved-on), which is what the extra time bought: high confidence the remediation actually closes the specific failure mode found, not just a plausible-sounding fix.

One environment gap unrelated to this ticket's code: `packages/observability`'s test database (`questlog_test_observability`) didn't exist in this sandbox (session bootstrap only ran `@questlog/server`'s `db:migrate`), which failed the full-monorepo `run-tests-quiet.sh` the first time. Created and migrated it directly (`CREATE DATABASE` + `DATABASE_URL=... pnpm --filter @questlog/observability db:migrate`) to get a genuine clean baseline — no code changed, out of this ticket's scope, but worth flagging as a possible session-bootstrap gap (see "Anything Alex must decide" below).

**Retry log:** 1 retry: `genuine_bug_caught_by_test` (the deadlock finding — caught by the reviewer's own targeted repro, not this ticket's Step 4 TDD loop, so it didn't count against the ticket's Iteration cap; the underlying TDD red/green loop for the original fix itself took 0 retries).

## Anything Alex must decide

- **Ticket-selection ambiguity, not a code decision:** T-060's own branch had a prior, *merged* PR (#103) that only added the ticket file itself (docs-only, zero implementation), reusing the same branch name later assigned to this ticket's `Branch:` field. That PR's presence means none of `EXECUTOR_ROUTINE.md` Step 1's four literal case definitions ("no matching PR", "PR open", "PR closed without merge", "branch with no PR") applied cleanly — I confirmed via `git log` that the branch had zero commits ahead of `develop` before pickup (i.e. no real implementation work existed anywhere), then treated it as an untouched ticket. Flagging so the routine's case list can be tightened for this "merged docs-only filing PR reused the eventual work branch name" shape if it recurs.
- **Residual deadlock risk, scoped but not eliminated:** the parent-first lock order closes the specific, demonstrated deadlock (campaign-then-one-child insert pattern, the dominant one in `packages/core`). It does not guarantee zero deadlock risk against every possible multi-child insert ordering some other test file might use — a full elimination would need either a single canonical child-insert order enforced repo-wide, or switching to one of the ticket's other candidate fixes (Vitest file-level isolation for this one file). Documented in `IMPLEMENTATION_NOTES.md § T-060` so a future recurrence starts from this note instead of zero.
- **Sandbox bootstrap gap:** this session's environment needed `packages/observability`'s test DB created/migrated by hand before the full-monorepo test gate would pass — session bootstrap (`.claude/hooks/session-start.sh` or its remote-execution equivalent) may need to cover this package too. Not fixed here (out of scope for T-060); worth a quick look if other sessions hit the same gap.
