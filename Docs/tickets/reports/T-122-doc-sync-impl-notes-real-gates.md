# T-122 — Tighten doc-sync and impl-notes-health into real failing gates

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-122-doc-sync-impl-notes-real-gates
**Diff:** 1 file changed (.github/workflows/ci.yml), +12/-13 lines (plus ticket file directory move, in-progress → done)
**Complexity tier:** S
**Strategy-gate flag:** yes (already resolved — see below)

## What shipped

`ci.yml`'s `doc-sync` check and both `impl-notes-health` checks (size limit, sensitive-file write obligation) now hard-fail (`exit 1`) on a real violation instead of always exiting 0. The `[skip-doc-check]`/`[skip-impl-notes]` PR-title escape hatches are unchanged. These now behave the same as `migration-guard`/`mockup-guard`, which were already real gates.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

`actionlint -color .github/workflows/ci.yml` — no output (clean).

Before committing, manually simulated each modified bash branch with fixture inputs (no dedicated test harness exists for these inline-YAML bash checks — same as `migration-guard`/`mockup-guard`, and consistent with prior CI tickets T-110/T-117/T-121):
- doc-sync, code changed + no Docs/ change + no skip title → `exit 1` (confirmed)
- doc-sync, same + `[skip-doc-check]` in title → skip message, `exit 0` (confirmed)
- impl-notes-health size check, 351-line fixture (limit 300) → `exit 1` (confirmed)
- impl-notes-health size check, 100-line fixture → `exit 0` (confirmed)
- impl-notes-health write-obligation, sensitive file changed + no notes update + no skip title → `exit 1` (confirmed)
- impl-notes-health write-obligation, same + `[skip-impl-notes]` in title → skip message, `exit 0` (confirmed)

## Exit condition check

- "a PR diff with code changes under apps/packages and no Docs/ change, no [skip-doc-check] in the title, causes doc-sync to exit 1" — verified via fixture simulation above; code path at `.github/workflows/ci.yml:134-140`.
- "the same diff with [skip-doc-check] in the PR title still exits 0" — verified via fixture simulation above; `.github/workflows/ci.yml:135-137`.
- "a fixture IMPLEMENTATION_NOTES.md exceeding 300 lines causes the size-check step to exit 1; one at or under 300 lines exits 0" — verified via fixture simulation above; `.github/workflows/ci.yml:200-208`.
- "a PR diff touching a .service.ts/.schema.ts/.router.ts file without a corresponding IMPLEMENTATION_NOTES.md change, no [skip-impl-notes] in the title, causes the write-obligation step to exit 1; the same diff with [skip-impl-notes] in the title exits 0" — verified via fixture simulation above; `.github/workflows/ci.yml:230-238`.
- "all tests green, typecheck clean, lint clean" — see Test evidence above.

## Reviewer verdict

PASS-WITH-NOTES. Reviewer's verbatim findings:

> **Scope compliance:** All three required changes are present and match exactly:
> 1. `.github/workflows/ci.yml:136-137` — doc-sync non-skip violation branch now `exit 1` (was `exit 0`); skip branch (`ci.yml:134-136`) unchanged at `exit 0`.
> 2. `.github/workflows/ci.yml:202-207` — size-check step now `exit 1` when `LINE_COUNT > LIMIT`, informational echo kept.
> 3. `.github/workflows/ci.yml:235-238` — write-obligation non-skip violation branch now `exit 1`; skip branch unchanged at `exit 0`.
>
> Warning-only echo text ("This is a warning only — not a hard failure.") was removed from all three steps as required. Passing branches and the skip-hatch mechanism are untouched, matching Out of scope. No `migration-guard`/`mockup-guard` changes, no consolidation work (that's T-121, already done separately), no size-limit changes. No scope creep — diff touches only `ci.yml` plus the ticket file's directory move (queue → in-progress).
>
> **Pattern deviation:** No `.claude/rules/*.md` file governs CI YAML, so nothing to check there. The change follows the existing style of neighboring already-real gates (`migration-guard`, `mockup-guard`) in the same file.
>
> **Test theater / functionality gaps:** None — this is a CI-config-only ticket with a machine-checkable exit condition; there's no test harness for these bash-in-YAML steps in this repo (consistent with prior CI tickets T-110/T-117/T-121, none of which added such tests either), and the ticket's exit condition doesn't require new unit tests.
>
> **One stale-comment finding:** `.github/workflows/ci.yml:88` (the job-level comment block from T-121, lines 85-93) still reads: `# doc-sync/impl-notes-health's warning-only exit-0 paths and migration-guard/mockup-guard's hard exit-1 paths ... is unchanged`. This is now factually wrong — this ticket just eliminated doc-sync/impl-notes-health's warning-only exit-0 paths, so all four guards now have hard exit-1 paths. It's a small, pre-existing comment that this diff made stale without updating it.
>
> No other findings — no redundant computation, no identifier-reuse landmines, no closures, no boundary-condition issues (the logic is a straightforward shell conditional, unchanged in structure, only the terminal exit code and echo text changed).
>
> PASS-WITH-NOTES

**Remediation:** fixed the stale comment (`.github/workflows/ci.yml:85-90`) in a follow-up commit, re-ran `actionlint` (clean) and the full lint/typecheck/test chain (unchanged, all green) after the fix.

## Efficiency notes

Straightforward config-only ticket — the "Relevant background" section already carried Alex's prior decision (make these real gates, not drop them), so there was no strategy ambiguity to resolve despite the `Strategy-gate flag: yes` marker. Followed the S-tier docs/config-only fast path (no Red/Green/Refactor loop) since the entire Scope is one workflow YAML file with no application code touched. Manually simulated each bash branch with fixture inputs before committing, since no unit-test harness exists for inline-YAML bash checks in this repo — same approach prior CI tickets (T-110/T-117/T-121) took.

**Retry log:** 0 retries.

## Anything Alex must decide

None. The strategy decision behind this ticket was already made by Alex during the T-117 follow-up (2026-08-03) and is documented inline in the ticket's "Relevant background" section — nothing new to decide here.
