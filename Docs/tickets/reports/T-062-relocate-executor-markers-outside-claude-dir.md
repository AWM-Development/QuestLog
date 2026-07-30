# T-062 — Relocate executor marker/stash files out of `.claude/`

**Outcome:** shipped
**Branch:** chore/pipeline/t-062-relocate-executor-markers-outside-claude-dir
**Diff:** 10 files changed, +82/-23 lines

## What shipped

T-061's `.claude/.active-ticket`/`.claude/.session-context.json` files stalled every unattended nightly run: the harness gates any write under `.claude/` behind an interactive confirmation (it's treated as a sensitive config directory), and there's no one present overnight to approve it — confirmed live on a real nightly run (T-033) that hung on exactly this. Both files now live at `tmp/.active-ticket`/`tmp/.session-context.json` — a plain, already-established scratch location (T-048's test logs) with no such gate. Purely a path relocation: marker/stash semantics, `resolveTicketId`'s signature, and `EXECUTOR_ROUTINE.md`'s Step 1/2/6/7 flow are all unchanged.

## Test evidence

```
$ ./scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (607 passed)
```

Direct invocation of `.claude/hooks/session-start.sh` with a fake stdin payload, confirming the stash lands in `tmp/` and `.claude/` is never touched:

```
$ echo '{"transcript_path": "/tmp/fake-transcript-3.jsonl", "session_id": "sess-fake-789"}' \
    | CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/session-start.sh
--- exit: 0 ---
--- .claude/ contents (marker/stash check) ---
confirmed: nothing written under .claude/
--- tmp/.session-context.json ---
{"transcript_path":"/tmp/fake-transcript-3.jsonl","session_id":"sess-fake-789"}
```

## Exit condition check

- **All tests green, typecheck clean, lint clean** — see test evidence above.
- **`grep -rn "\.claude/\.active-ticket\|\.claude/\.session-context"` returns nothing outside historical records** — repo-wide sweep confirmed the only remaining hits are `Docs/tickets/done/T-061-*.md`, `Docs/tickets/reports/T-061-*.md`, `Docs/tickets/gated/resolved/G-011-*.md` (all describing what was true at the time, left unedited per this ticket's own carve-out, same precedent as T-046's CHANGELOG entry not being retroactively edited by T-061), and the CHANGELOG's dated T-061 entry (same reasoning). One live-code docstring (`usage-summary.ts:182`) that still named the old path was caught and fixed.
- **Direct invocation proves `tmp/.session-context.json` written, `.claude/` never touched** — see Test evidence above.
- **`capture-usage.test.ts` proves `resolveActiveTicketId` reads `tmp/.active-ticket`** — `capture-usage.test.ts:96-97,122-124,149-152` construct the marker under `tmp/` inside each test's temp project dir; reviewer confirmed these actually exercise the new path, not a cosmetic-only rename.
- **`EXECUTOR_ROUTINE.md` Steps 1/2/6/7 and `promote-execute.md` read coherently against the new path** — reviewed manually by the `reviewer` subagent (see verdict below).

## Reviewer verdict

**PASS**

> `tmp/` already exists and is used by T-048's test logs, confirming it's an established non-sensitive scratch dir. Everything checks out: consistent path substitution across all files, tests updated meaningfully, no scope creep, no leftover references, and historical docs correctly left alone.
>
> - `.claude/hooks/session-start.sh:18-33` — `mkdir -p tmp/` and write path updated correctly, with a WHY comment explaining the relocation.
> - `.gitignore:36-40` — entries updated to `tmp/.session-context.json` / `tmp/.active-ticket`.
> - `capture-usage.ts:81-84` and `usage-summary.ts:182` — path and docstring updated; `resolveTicketId`'s signature/logic untouched.
> - `capture-usage.test.ts:96-97,122-124,149-152` — tests construct `tmp/.active-ticket` inside temp dirs, actually exercising the new path; ran the suite, all 6 tests pass.
> - `EXECUTOR_ROUTINE.md` Steps 1/2/6/7 and `promote-execute.md`'s resume bullet — all updated consistently.
> - `IMPLEMENTATION_NOTES.md` § T-046 and § G-011 — corrected to new paths, with a one-line pointer to T-062 rather than a duplicated paragraph.
> - `CHANGELOG.md` — T-062 entry added, explicitly notes "purely a path change."
> - Repo-wide grep for the old paths confirms zero live/executable references remain.
>
> No functionality gaps, no scope creep, no test theater, no DRY issues — this is a clean, minimal, fully consistent path-relocation diff.

## Anything Alex must decide

None. This closes the marker-relocation saga cleanly — the reviewer specifically checked for any remaining `.claude/`-writing code path repo-wide (not just this ticket's named context files) and found none.
