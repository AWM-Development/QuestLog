# T-156 — `ensure_database_provisioned` leaks `OBSERVABILITY_DATABASE_URL` past its own `DATABASE_URL` override

**Outcome:** shipped
**Branch:** fix/m-bug/t-156-observability-migrate-database-url-leak
**Diff:** 5 files changed, +25/-2 lines
**Complexity tier:** S
**Strategy-gate flag:** no

## What shipped

`scripts/db-readiness.sh`'s `ensure_database_provisioned()` now pre-sets `OBSERVABILITY_DATABASE_URL` (alongside `DATABASE_URL`) to the intended local test-DB URL before running its migrate child process, in a subshell that never touches the calling `session-start.sh` process's own environment. Previously, whenever a worktree's `.env` carried a real remote-Neon `OBSERVABILITY_DATABASE_URL` (propagated by T-131), the observability migrate call silently ran against that remote database instead of the local `questlog_test_observability`, leaving the local DB permanently unmigrated.

**Note:** the ticket's own literally-proposed fix (`unset OBSERVABILITY_DATABASE_URL` in the subshell) does not actually work — verified empirically during implementation, and not what shipped. See "Anything Alex must decide" below and `Docs/IMPLEMENTATION_NOTES.md` § T-156 for the full explanation.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (836 passed)
```

Live repro of the bug, before the fix (captured mid-implementation): running this worktree's `.claude/hooks/session-start.sh` with the primary checkout's real `OBSERVABILITY_DATABASE_URL` (a remote Neon URL) present in the propagated `.env` reproducibly failed with:

```
session-start.sh: PROVISIONING FAILED — database questlog_test_observability has no applied migrations (drizzle.__drizzle_migrations empty or missing)
```

After the fix, the same worktree's `session-start.sh` run exits 0 and its fast-path pre-check reports:

```
session-start.sh: fast-path — all 4 database(s) already satisfy the verification gate's criteria, skipping create/migrate loop
```

`db_readiness_issue local_psql_query questlog_test_observability`, run directly, returns empty (no issue) — the local database is genuinely migrated, not just believed to be.

## Exit condition check

- **all tests green, typecheck clean, lint clean** — confirmed above (`scripts/run-tests-quiet.sh`).
- **repro, before the fix** — confirmed live against the unpatched script (see Test evidence above); the ambient `OBSERVABILITY_DATABASE_URL` from `.env` won every time, exactly as the ticket predicted, though via `migrate.ts`'s own `dotenv.config()` call rather than any shell-level inheritance (see note below).
- **after the fix, with a differing `OBSERVABILITY_DATABASE_URL` in the shell environment** — the worktree's own `.env` already carries the real remote Neon URL (simulating exactly the T-131-propagated case the exit condition describes); `ensure_database_provisioned`'s migrate child process now connects to the local `$database_url` argument, confirmed both by `session-start.sh`'s own verification gate passing and by `db_readiness_issue` reporting no issue for `questlog_test_observability` directly afterward.
- **re-run `db_readiness_issue` after the above** — confirmed no issue, as shown above.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> Scope is otherwise minimal and matches the ticket (single function change, docs, milestone checkbox, CHANGELOG). No scope creep, no test theater (no new tests claimed), no functionality gap. The one substantive finding is the oversized inline comment.
>
> **Findings:**
> - `scripts/db-readiness.sh:91-121` — The inline comment is a ~30-line prose paragraph that duplicates, almost verbatim, the rationale already written out in full in `Docs/IMPLEMENTATION_NOTES.md`'s new "T-156" section... Per the comment-discipline standard (G-013), this should collapse to a one-line pointer at the call site... It's also internally inconsistent with this same file's own established pattern... which points to `Docs/IMPLEMENTATION_NOTES.md § T-xxx`, whereas this new comment instead points to `Docs/tickets/done/T-156-...md`.
>
> **Verification performed:** I independently reproduced the empirical claim in `Docs/IMPLEMENTATION_NOTES.md`'s new T-156 section using the repo's actual `dotenv` package... This confirms the ticket's own proposed `unset`-based fix would not have worked, and that the shipped pre-set approach is the one that actually closes the leak. The deviation from the ticket's literal proposed code is justified and correctly documented in both `IMPLEMENTATION_NOTES.md` and the commit/comment.
>
> Scope match: the diff touches exactly `ensure_database_provisioned()` in `scripts/db-readiness.sh`, leaves `migrate.ts`'s resolution order untouched (per Out of scope), doesn't touch `db_readiness_issue()` or the verification-gate loops (per Out of scope), and doesn't attempt to re-provision existing stale worktrees (per Out of scope). Both `session-start.sh` call sites are unaffected since the function's signature/contract didn't change. No scope creep found.

The flagged comment was trimmed in a follow-up commit (`refactor(T-156): trim inline comment per reviewer note`) to a one-line pointer matching the file's existing convention, before this report was written.

## Efficiency notes

The ticket's own proposed code fix doesn't hold up under a live repro — this cost the bulk of the session's turns, but caught before shipping rather than after: a quick `node -e` check against the real `dotenv` package (loading the worktree's actual `.env`) showed that `unset OBSERVABILITY_DATABASE_URL` followed by `migrate.ts`'s own `dotenv.config()` call still leaves the ambient remote-Neon URL in `process.env` — because that var was never shell-exported anywhere upstream in the first place, so there was nothing for `unset` to remove. The actual fix (pre-setting `OBSERVABILITY_DATABASE_URL` instead) was found by working from `dotenv`'s one real guarantee ("never overwrites an already-set var") in the direction that guarantee actually helps, then confirmed the same way. This worktree's own `session-start.sh` bootstrap happened to reproduce the exact bug live (the primary checkout has a real `OBSERVABILITY_DATABASE_URL` set), which made both the before-fix repro and the after-fix confirmation unusually direct — no synthetic repro setup needed.

**Retry log:** 0 retries against the iteration cap (no failed Red/Green checkpoint) — the extra turns were pre-commit investigation into why the ticket's proposed fix didn't reproduce a passing state, not a failed-and-retried implementation attempt.

## Anything Alex must decide

**The ticket's literal proposed fix code (`unset OBSERVABILITY_DATABASE_URL` in a subshell) does not work, and was not shipped.** This is a deviation from the ticket's own Scope section, which inlined that exact code block. The shipped fix achieves the same contract the ticket specifies (`ensure_database_provisioned`'s migrate child process no longer inherits an ambient `OBSERVABILITY_DATABASE_URL`) and satisfies every exit condition verbatim, via pre-setting `OBSERVABILITY_DATABASE_URL` to `$database_url` instead of unsetting it — reasoning and live verification for both directions are in `Docs/IMPLEMENTATION_NOTES.md` § T-156. Worth a quick sanity read given it corrects the ticket's own analysis, though the fix has been independently verified twice now (once during implementation, once by the reviewer subagent from scratch).

No other scope judgment calls; no follow-up ticket implied beyond what's already noted as out of scope in the ticket itself (re-provisioning already-existing stale worktrees, which self-heals per the ticket's own reasoning).
