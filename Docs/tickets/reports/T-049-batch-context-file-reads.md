# T-049 — Batch ticket context-file reads into one turn

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-049-batch-context-file-reads
**Diff:** 1 file changed, +1/-2 lines

## What shipped

`EXECUTOR_ROUTINE.md` Step 3 now explicitly instructs the executor to read `CLAUDE.md` and every file in a ticket's `Context files:` field as parallel tool calls within a single assistant turn, rather than sequentially across turns. No change to which files get read, no enforcement mechanism, and Step 4's TDD loop is untouched.

## Test evidence

No code was touched by this ticket (doc-only change), so this run confirms no regression:

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (603 passed)
```

## Exit condition check

- **All tests green, typecheck clean, lint clean:** confirmed above — `lint: pass (0 warnings)`, `typecheck: pass`, `test: pass (603 passed)`.
- **`grep` confirms Step 3 explicitly instructs single-turn/parallel reads for the Context files list:**
  ```
  $ grep -n "single assistant turn\|parallel tool calls" Docs/tickets/EXECUTOR_ROUTINE.md
  53:- Read `CLAUDE.md` (always — it's the top-level pointer, ~40 lines) together with every file listed in the ticket's `Context files:` field, as parallel tool calls within a single assistant turn — the full list is known upfront, so there's no reason to spread these reads sequentially across multiple turns, each re-sending the growing conversation. Read nothing else, unless you discover mid-ticket that something is missing — if so, note that as a scoping gap in the eventual report rather than silently pulling in extra files. (This batching applies only to this upfront context-loading step — Step 4's TDD loop necessarily reads/writes files sequentially as work proceeds.)
  ```

## Reviewer verdict

**PASS** — verbatim from the reviewer subagent:

> Only one file changed, one line replaced two lines. Diff is confined entirely to Step 3 of `Docs/tickets/EXECUTOR_ROUTINE.md`. Step 4 is only referenced in the new prose (to clarify the batching doesn't apply there), not edited.
>
> **Scope match:** The new line at `Docs/tickets/EXECUTOR_ROUTINE.md:53` explicitly instructs reading `CLAUDE.md` together with every file in `Context files:` "as parallel tool calls within a single assistant turn," and gives the rationale (list known upfront, avoids re-sending growing conversation across turns) — matching the ticket's Scope text almost verbatim. The "if you discover mid-ticket that something is missing, note it as a scoping gap" sentence is preserved unchanged, per the ticket's explicit instruction to keep it.
>
> **Out of scope respected:**
> - No change to *which* files get read — `.claude/rules/*.md` auto-load line and Mockup-path line are untouched (confirmed unchanged in diff context).
> - No enforcement mechanism added — this is prose only, no hook/tooling change.
> - Step 4 is not touched — the diff only mentions Step 4 in a parenthetical clarifying the new instruction's boundary, which is consistent with (not a violation of) "no change to Step 4."
>
> **Exit condition:**
> - No code touched, so "tests green/typecheck/lint clean" trivially holds (no code diff exists to break anything) — confirmed via `git diff --stat` showing only the one markdown file changed.
> - `grep` against Step 3 confirms explicit single-turn/parallel-read instruction is present (`Docs/tickets/EXECUTOR_ROUTINE.md:53`), satisfying the machine-checkable condition.
>
> **Pattern/DRY/test-theater checks:** Not applicable — this is a single-line documentation edit with no code, no tests, no duplication introduced.
>
> No findings. The diff is a minimal, faithful, exact implementation of the ticket's scope with nothing extra.
>
> PASS

## Anything Alex must decide

None on the ticket's own scope. One environment note, not a ticket-scope decision: this sandbox's local Postgres had all three databases (`questlog`, `questlog_test`, `questlog_test_mcp`) missing migration `0013_pretty_wendell_rand.sql` (`mcp_oauth_clients`/`mcp_oauth_codes`/`mcp_oauth_tokens`) despite `__drizzle_migrations` otherwise being up to date through migration 12 — `pnpm test` failed 15 `mcp-oauth.service.test.ts` tests with `relation "mcp_oauth_clients" does not exist` before I re-ran `db:migrate` against all three databases to apply it. This looks like a stale sandbox snapshot rather than anything wrong with the migration itself or this ticket's diff; flagging in case it recurs on a future run and is worth a session-start-hook fix.
