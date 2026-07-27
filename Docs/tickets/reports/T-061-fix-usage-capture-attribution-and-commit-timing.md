# T-061 — Fix usage-capture artifact attribution and commit timing

**Outcome:** shipped
**Branch:** chore/pipeline/t-061-fix-usage-capture-attribution-and-commit-timing
**Diff:** 8 files changed, +131/-77 lines

## What shipped

`capture-usage`'s ticket attribution no longer guesses from recent commit subjects or `done/`/`blocked/` file mtimes — `.claude/hooks/session-start.sh` now stashes every session's `transcript_path`/`session_id` on start, `EXECUTOR_ROUTINE.md` Step 2 (and Step 1's resume path) write an explicit `.claude/.active-ticket` marker naming the ticket a session is actively working, and Step 7 invokes `capture-usage` directly and synchronously before its wrap-up commit — so the artifact is attributed correctly and lands in the same PR as the rest of the ticket's work, instead of depending on the `Stop` hook firing after the PR is already open.

## Test evidence

```
$ ./scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (607 passed)
```

Direct invocation of `.claude/hooks/session-start.sh` with a fake stdin payload (local, non-remote):

```
$ echo '{"transcript_path": "/tmp/fake-transcript-2.jsonl", "session_id": "sess-fake-456"}' \
    | CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh
--- exit: 0 ---
$ cat .claude/.session-context.json
{"transcript_path":"/tmp/fake-transcript-2.jsonl","session_id":"sess-fake-456"}
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see test evidence above.
- **`usage-summary.test.ts` proves `resolveTicketId(activeTicketMarker)` returns trimmed marker content when present/non-empty, `null` when absent/empty, no git-log/mtime path remains** — `packages/core/src/observability/usage-summary.test.ts:205-216`; old implementation deleted entirely from `usage-summary.ts`.
- **`capture-usage.test.ts` proves marker → correct `T-XXX.usage.json`, and no marker → `empty_run: true` even with an unrelated `done/` file on disk** — `packages/core/src/observability/capture-usage.test.ts:97-146` (the second new test writes a `Docs/tickets/done/T-999-unrelated.md` fixture specifically to prove the old heuristic's failure mode is now impossible).
- **`session-start.sh` direct invocation proves `.claude/.session-context.json` written with correct shape** — see Test evidence above.
- **`EXECUTOR_ROUTINE.md` Steps 1/2/7 read coherently end-to-end** — reviewed manually by the `reviewer` subagent (see verdict below); marker written on pickup and on resume (Step 1 case 4), Step 7 reads the stash + marker, invokes the CLI, commits inline, deletes the marker.
- **`IMPLEMENTATION_NOTES.md` § T-046 no longer claims "previous hook fire"** — replaced with a description of the new mechanism plus a pointer to `G-011`'s resolution, per the WHY-once rule.

## Reviewer verdict

**PASS**

> 1. `resolveTicketId` (`usage-summary.ts:182-186`) fully matches the new signature — old heuristic completely removed, no fallback remains.
> 2. `resolveActiveTicketId` (`capture-usage.ts:83-87`) reads the marker via `existsSync`/`readFileSync`; `execSync`/directory-scan logic fully removed. Renamed appropriately.
> 3. Tests prove both exit-condition regressions explicitly: `capture-usage.test.ts:97-146` shows marker→correct ticket_id and no-marker→`empty_run:true` even with an unrelated `T-999` done file present — the exact regression scenario named in the ticket. `usage-summary.test.ts:206-220` covers trim/empty/null cases directly. Ran the suite: 26/26 passing.
> 4. `.claude/hooks/session-start.sh:14-32` writes the stash unconditionally, before the `CLAUDE_CODE_REMOTE` check (line 33), with correct `{transcript_path, session_id}` shape.
> 5. `EXECUTOR_ROUTINE.md` Steps 1 (resume path, line 43), 2 (line 47), and 7 (lines 85-88) read coherently end-to-end.
> 6. `IMPLEMENTATION_NOTES.md` § T-046 no longer claims "previous hook fire" — replaced, per the WHY-once rule.
> 7. `stop-usage-capture.sh` confirmed unchanged, correctly per Scope item 6. No scope creep detected. Untracked pre-existing files in `Docs/tickets/cost-reports/` correctly left untouched per Out-of-scope. CHANGELOG entry present.
>
> No test theater, no functionality gaps, no rule-file violations for the touched paths.

## Anything Alex must decide

None. One bootstrapping note, not a defect: this interactive `/promote-execute` session itself started before its own `session-start.sh` change existed on `develop`, so no `.claude/.session-context.json`/`.active-ticket` pair exists for *this* session's own usage — its eventual `Stop`-hook fire will correctly resolve `empty_run: true` rather than misattribute to T-061. Every future ticket session (including the next nightly run) will have the full mechanism available from its own `SessionStart`.
