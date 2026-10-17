# T-174 — generate_encounter: NL parsing + roster matching + preview/confirm

**Outcome:** shipped
**Branch:** feat/m-generate/t-174-generate-encounter-nl-tool
**Diff:** 15 files changed (code + docs + ticket moves)
**Complexity tier:** M
**Strategy-gate flag:** yes (G-038 already resolved; no new gate)

## What shipped

`generate_encounter` turns a freeform description into a preview (roster-matched monsters vs. new-monster candidates, nothing persisted); `confirm_generate_encounter` creates the new bare-name monsters and saves the encounter in one transaction via T-173's `encounterService.save`.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (1075 passed)
```
(`scripts/run-tests-quiet.sh`, run before the feature commit.)

## Exit condition check

- Tests/typecheck/lint green: output above.
- `campaign-scoping.test.ts` unmodified and passing (part of the 1075).
- Split into `matched`/`newMonsterCandidates` with mocked `callClaudeStructured`: `generate-encounter.test.ts` "splits extracted creatures...".
- Confirm creates exactly the new monsters, persists encounter + members with real ids and counts, retrievable via `get_encounter`: "confirm creates the new monsters and saves a retrievable encounter".
- `onboarding-instructions.test.ts` drift check passes with both tools registered.

## Reviewer verdict

PASS-WITH-NOTES. Notes: (1) confirm payload cast unvalidated — same as `confirm-ingest-entities.ts`, left as-is; (2) duplicate monster possible if created between preview and confirm — documented in IMPLEMENTATION_NOTES § T-174; (3) no forced-failure atomicity test — noted there too; (4) long JSDoc — left; (5) T-191 `Blocked on` removal is promotion bookkeeping (T-173 merged).

## Efficiency notes

Tight run. One lint autofix (`mechanical_lint_typecheck`), plus two test-side fixes: onboarding text edit initially missed the escaped backticks, and member-order assertion made order-insensitive (`genuine_bug_caught_by_test`-adjacent test fix). **Retry log:** 2 retries: 1 mechanical_lint_typecheck, 1 genuine_bug_caught_by_test.

## Anything Alex must decide

None. Note: this run also promoted T-174 and T-191 from backlog (T-173 merged). T-158 was skipped as actively claimed (fresh branch, uncommitted wrap-up in another worktree).
