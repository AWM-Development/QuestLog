# T-045 — Move all live milestone docs into `Docs/milestones/`; fix every stale cross-reference

**Outcome:** shipped
**Branch:** feat/docs/t-045-fix-milestone-doc-cross-references
**Diff:** 42 files changed (3 renamed with edits), +174/-109 lines vs. `develop`

## What shipped

`MILESTONES_V1_MCP.md`, `MILESTONES_V1_1_MCP.md`, and `MILESTONES_V1_2_MCP.md` moved from `Docs/` root into `Docs/milestones/`, alongside `MILESTONES_V2.md` (T-044). Every cross-reference to the old root paths across the repo's living docs, pipeline meta-docs, rules/skills, and currently-active tickets/gates was updated to the new location, and the stray `.~lock.QuestLog_API_Cost_Model.xlsx#` file (already gone before this ticket started) was confirmed absent.

## Test evidence

```
$ pnpm lint
 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    2.303s

$ pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
  Time:    42.009s

$ pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/server:test:  Test Files  13 passed (13)
@questlog/web:test:  Test Files  46 passed (46)
 Tasks:    5 successful, 5 total
Cached:    0 cached, 5 total
```

Note: the first `pnpm test` run failed 15 tests in `packages/core` (`relation "mcp_oauth_clients" does not exist`) because the sandbox's test databases were migrated against whatever branch it started on, before this session's required `git fetch origin develop && git checkout -B develop origin/develop` (`EXECUTOR_ROUTINE.md` Step 0) landed migration `0013`. Re-ran `DATABASE_URL=... pnpm --filter @questlog/server db:migrate` against all three names in `scripts/test-db-names.sh`, then all tests passed. Root cause and fix documented in `Docs/IMPLEMENTATION_NOTES.md` (new "T-045 — stale test-DB schema" entry) since this is a repeatable sandbox gotcha, not a code defect.

## Exit condition check

- **`Docs/milestones/MILESTONES_V1_MCP.md`, `MILESTONES_V1_1_MCP.md`, `MILESTONES_V1_2_MCP.md` all exist; root versions gone** — verified via `git mv` (three renames in the diff) and `ls Docs/*.MCP.md` returning nothing.
- **`git grep -rln` for the old-path patterns returns matches only in frozen/historical files** — verified: remaining matches are confined to `CHANGELOG.md`, `Docs/AUDIT_2026-07*.md`, `Docs/tickets/gated/resolved/*`, `Docs/tickets/done/*`, `Docs/tickets/archive/*`, `Docs/tickets/reports/*` (all named in the ticket's own allow-list), plus two exceptions outside that literal list that are each independently justified — see "Anything Alex must decide" below.
- **`Docs/README.md`'s file listing includes all four `Docs/milestones/*.md` paths and no longer describes `milestones/` as historical/empty** — done: added `milestones/MILESTONES_V1_MCP.md`/`V1_1_MCP.md`/`V1_2_MCP.md`/`V2.md` entries under "Task Source," removed the stale "Historical" `milestones/` entry.
- **`Docs/.~lock.QuestLog_API_Cost_Model.xlsx#` no longer exists** — confirmed absent (`find Docs -iname "*lock*xlsx*"` returns nothing); it was already gone when this ticket started, presumably cleaned up incidentally by T-044 or an earlier session.
- **lint/typecheck/test all green** — see Test evidence above.

## Reviewer verdict

**PASS-WITH-NOTES.** Verbatim:

> The core deliverable (file moves + repo-wide cross-reference fix) is complete and verifiably correct against the exit condition. The one finding (`Docs/tickets/gated/G-005-agent-mcp-interaction-strategy.md:51,56`) is a minor, isolated leftover inconsistency in a single file rather than a systemic gap, and doesn't affect the machine-checkable exit condition's literal grep pattern.
>
> **`Docs/tickets/gated/G-005-agent-mcp-interaction-strategy.md:16` vs. `:51` and `:56`.** Line 16 (Context files) was carefully rewritten ... But the same file's "Notes" section at line 51 still reads `- **\`MILESTONES_PT2.md\` §11's "system prompt design"** ...` with no retirement framing, and line 56 quotes `"never pull work from MILESTONES_PT1.md/PT2.md" rule` — a phrase that no longer exists in `CLAUDE.md` (this diff rewrote that exact clause at `CLAUDE.md:5`). ... worth a follow-up pass so a future reader of G-005 doesn't go looking for a `MILESTONES_PT2.md` that no longer exists.

Also confirmed: exit condition holds, no double-prefixed paths or broken links, `.cursor/rules/frontend.mdc` mirror update judged correct (established convention, disclosed in CHANGELOG), no scope creep, no new duplication.

The flagged G-005 inconsistency was fixed in a follow-up commit (`e496ddb`) before this ticket shipped — see diff.

## Anything Alex must decide

1. **`Docs/mockups/README.md` was named in the ticket's own Context files and Scope (item 7) but left unfixed.** Its one stale reference (`Docs/MILESTONES_V1_MCP.md` in the "2.4 OCR strategy" line) still points at the old root path. `CLAUDE.md`'s hard rule ("Never modify files under `Docs/mockups/`") and the file's own documented policy ("CI hard-fails ... any PR whose diff touches this directory") both forbid editing it unconditionally — there's no carve-out for a mechanical path fix, and `mockup-guard` would hard-fail this PR if it were touched. I judged the hard rule as taking precedence over the ticket's own instruction and left it stale. If Alex wants this fixed, it needs an explicit CI/mockup-guard exception or a manual edit outside the pipeline.
2. **T-045's own ticket file (`Docs/tickets/in-progress/T-045-fix-milestone-doc-cross-references.md`, now moving to `done/`) still contains old-path references and was deliberately not mechanically "fixed."** Its Scope section narrates the literal `git mv Docs/MILESTONES_V1_MCP.md Docs/milestones/MILESTONES_V1_MCP.md` commands as historical instructions — rewriting the source path to the already-moved destination would make the ticket's own record of what it did nonsensical (`git mv Docs/milestones/MILESTONES_V1_MCP.md Docs/milestones/MILESTONES_V1_MCP.md` is a no-op that never happened). This is different in kind from every other flagged file, which cited the old paths as live pointers rather than describing a completed move. No action needed unless Alex disagrees with the distinction.
3. **`Docs/milestones-archive/M4.2/PLAN.md` still cites `Docs/MILESTONES_PT1.md`.** This is explicitly out of scope per the ticket's own "Out of scope" section (`Docs/milestones-archive/` — no change, stays separate from `Docs/milestones/`), so left untouched — noted here only because it technically falls outside the exit condition's literal frozen-file allow-list (which doesn't name `milestones-archive/` by path), even though the ticket's Out-of-scope section clearly intends it to be excluded.
4. **Three bare, non-`Docs/`-prefixed `MILESTONES_PT1.md`/`PT2.md` references inside `Docs/milestones/MILESTONES_V1_MCP.md` and `MILESTONES_V2.md` were reworded (not deleted) to say "retired"/"formerly" rather than presenting them as live pointers**, since the files they pointed at no longer exist. This is a small content judgment call beyond pure path mechanics — flagged since the ticket's Out-of-scope section says re-litigating `MILESTONES_V2.md`'s content is T-044's job, not this ticket's, though I read "don't invent new content" differently from "don't fix a pointer to a deleted file." No functional detail was added or removed, only the framing of an already-dead reference.
