# T-044 — Consolidate `MILESTONES_PT1`/`PT2`'s v2 detail into a current `Docs/milestones/MILESTONES_V2.md`; retire the PT files

**Outcome:** shipped
**Branch:** feat/docs/t-044-consolidate-milestones-v2-doc
**Diff:** 6 files changed, 609 insertions(+), 961 deletions(-)

## What shipped

`Docs/milestones/MILESTONES_V2.md` now holds every v2-deferred milestone (4.3, 5.1–5.4, 6.1–6.3, 7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6, 10–19) re-audited against the current post-MCP-pivot codebase — not a verbatim transcript of the old files. `Docs/MILESTONES_PT1.md` and `Docs/MILESTONES_PT2.md` are deleted now that their content is extracted.

## Test evidence

```
pnpm lint
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    25ms >>> FULL TURBO

pnpm typecheck
 Tasks:    6 successful, 6 total
Cached:    6 cached, 6 total
  Time:    18ms >>> FULL TURBO

pnpm test
@questlog/core:test:  Test Files  22 passed (22)
@questlog/mcp:test:  Test Files  1 passed (1)
@questlog/server:test:  Test Files  13 passed (13)
@questlog/web:test:  Test Files  46 passed (46)
 Tasks:    5 successful, 5 total
```

Docs-only change — lint/typecheck cache-hit as expected; full test suite (82 test files across core/mcp/server/web) passes unchanged.

## Exit condition check

- **`Docs/milestones/MILESTONES_V2.md` contains a distinct, grep-findable section for every milestone number in the old "Deferred to v2" table** — verified: `###`/`##` headers exist for all 36 required numbers (4.3, 5.1–5.4, 6.1–6.3, 7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6, 10 through 19), confirmed by grep count during authoring and independently by the reviewer subagent.
- **`Docs/MILESTONES_PT1.md` and `Docs/MILESTONES_PT2.md` no longer exist at `Docs/` root (deleted, not moved)** — verified via `git rm` and confirmed absent from the working tree; not present anywhere else in the repo.
- **`git grep -l "MILESTONES_PT1\|MILESTONES_PT2"` returns matches only in frozen/historical files or this ticket's own file/report** — matches remain in `CLAUDE.md`, `README.md`, `Docs/README.md`, `Docs/PRD.md`, `Docs/MILESTONES_V1_MCP.md`, `Docs/tickets/LINEUP_SAMPLE.md`, `Docs/tickets/gated/G-005-*`, `Docs/tickets/backlog/T-045-*`, plus the expected frozen ones (`CHANGELOG.md`, both `AUDIT_*.md`, `Docs/tickets/gated/resolved/G-002-*`, `Docs/milestones-archive/M4.2/PLAN.md`, this ticket's own in-progress file, and the new `MILESTONES_V2.md`'s own "Supersedes" pointer). Diffed each non-frozen hit against `develop` — none were touched by this ticket; they were already stale before this ticket and are explicitly T-045's scope per this ticket's own Out-of-scope section, not a gap here.
- **lint/typecheck/test all green** — see Test evidence above.

## Reviewer verdict

**PASS**

> **Findings:**
> 1. Exit condition coverage — verified: distinct `###` headers exist for all 36 required milestone numbers (4.3, 5.1–5.4, 6.1–6.3, 7.1–7.3, 8.1–8.3, 9.1/9.2/9.4/9.5/9.6, 10.1–19.1) in `Docs/milestones/MILESTONES_V2.md`.
> 2. Re-audit factual claims spot-checked and confirmed true: `Rail.tsx` exists (`Docs/milestones/MILESTONES_V2.md:245`), `SessionEditor.tsx:624` still has `window.prompt("Link URL")` (`Docs/milestones/MILESTONES_V2.md:270`), `EmberPlaceholder.tsx` exists at the stated path (`Docs/milestones/MILESTONES_V2.md:192`), `packages/core/src/services/entity.service.ts` exists with no dedicated web entity page (`Docs/milestones/MILESTONES_V2.md:35`).
> 3. MCP-equivalent relationships (4.3 ↔ M-MCP.3/`log_session`; 6.1–6.3 ↔ M-MCP.4/`prep_brief`) match `Docs/MILESTONES_V1_MCP.md`'s "Deferred to v2" table.
> 4. Content fidelity — spot-checked Milestone 9 and Milestone 10 sections against the original PT1/PT2 content: task bullets preserved verbatim where still accurate, reconciliation notes added inline, no fabricated new scope. Old copy-paste gate template correctly dropped (superseded by `GATE_SPEC.md`).
> 5. Deletion verified — `MILESTONES_PT1.md`/`PT2.md` no longer exist anywhere in the working tree.
> 6. No new stale references introduced — remaining `git grep` hits pre-date this diff and are T-045's scope.
> 7. `CHANGELOG.md`/`IMPLEMENTATION_NOTES.md` updates accurate, `IMPLEMENTATION_NOTES.md`'s G-002 entry amended in place rather than duplicated.
> 8. No scope creep, no test-theater concerns (docs-only ticket), no DRY/sprawl issues found.
>
> No functionality gaps, no scope creep, no test-theater concerns, no DRY/sprawl issues found in the diff.

## Anything Alex must decide

None. This ticket had no 🧠-gated checkpoint and made no scope judgment calls beyond what `G-002`'s resolution and its Addendum already decided. `T-045` (fixing every stale cross-reference to the old PT1/PT2 paths, and moving `MILESTONES_V1_MCP.md`/`MILESTONES_V1_1_MCP.md`/`MILESTONES_V1_2_MCP.md` into `Docs/milestones/`) is next, unblocked by this merge.
