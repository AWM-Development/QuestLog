# T-047 — Efficiency-notes reporting convention

**Outcome:** shipped
**Branch:** feat/m-obs/t-047-efficiency-notes-reporting-convention
**Diff:** 5 files changed, +45/-2 lines (`Docs/tickets/REPORT_TEMPLATE.md`, `Docs/tickets/BLOCKED_TEMPLATE.md`, `Docs/tickets/EXECUTOR_ROUTINE.md`, plus two pure ticket/queue file moves with no content change)

## What shipped

`REPORT_TEMPLATE.md` and `BLOCKED_TEMPLATE.md` now both carry a required "## Efficiency notes" section — free-form self-reported prose on why a run ran long or stayed tight, plus a structured retry log categorizing each failed Red/Green iteration as `environment_setup`, `mechanical_lint_typecheck`, or `genuine_bug_caught_by_test`. `EXECUTOR_ROUTINE.md`'s Step 6 (blocked) and Step 7 (shipped) each gained a one-line reference instructing the section be written as part of the existing report-writing step.

## Test evidence

No application code was touched (doc-only ticket) — ran the full suite to confirm no regression:

```
lint: pass (0 warnings)
typecheck: pass
test: pass (643 passed)
```

## Exit condition check

- all tests green, typecheck clean, lint clean — confirmed above (no code touched by this ticket)
- `grep -q "## Efficiency notes" Docs/tickets/REPORT_TEMPLATE.md` → match
- `grep -q "## Efficiency notes" Docs/tickets/BLOCKED_TEMPLATE.md` → match
- `environment_setup`, `mechanical_lint_typecheck`, `genuine_bug_caught_by_test` all present, verbatim, in both templates — confirmed via grep, all three found in both files
- `EXECUTOR_ROUTINE.md` Step 7 (and Step 6) explicitly reference the efficiency-notes section and its retry log by name — confirmed, one clause added to each step

## Reviewer verdict

PASS. Reviewer's verbatim notes:

> Diff matches ticket exactly: only the two templates and the routine were amended, plus the pure ticket-move and unrelated queue-promotion (no content changes)... Content check: [REPORT_TEMPLATE.md, BLOCKED_TEMPLATE.md, EXECUTOR_ROUTINE.md bullets all confirmed matching ticket scope]... No touches to T-046's hook/schema/JSON artifact, no new template file, no automated categorization logic — all "Out of scope" items respected. Exit condition: all four grep-able conditions are satisfiable by the diff shown... One usability note: the ticket asked for the retry-log's category descriptions "reusing the two examples above" for the prose section — the diff instead reuses one example ("environment_setup (Postgres container not migrated)") as an inline demonstration format, which is fine and arguably better since it demonstrates format not just categories. No test theater concern... No comment-discipline issues... Everything in this diff is traceable to an explicit ticket bullet; nothing in Out of scope was violated; wording is concrete (fixed enum, explicit examples), not vague.
>
> PASS

## Efficiency notes

Ran tight — this was a pure documentation ticket (edit three markdown files, verify with grep, run the existing test suite once to confirm no regression) with no ambiguity in the ticket's scope. The only overhead beyond the edits themselves was environment setup: the worktree needed `pnpm install`, a per-worktree Postgres stack (`scripts/worktree-postgres-env.sh`), and a `db:migrate` run before the full `pnpm test` chain could pass — none of that is specific to this ticket, it's the fixed cost of any ticket's first test run in a fresh worktree.

**Retry log:** 0 retries. No Red/Green iteration failed — this ticket had no code to write, so the TDD loop's iteration cap was never at stake.

## Anything Alex must decide

None. While in this worktree, also promoted `T-091` (`Docs/tickets/backlog/T-091-mcp-oauth-resource-audience-binding.md` → `queue/`) per Step 2 — it had no `Blocked on:`/`Gated on:` field and reads as a fully-specced, execution-ready ticket, unlike its `NOT ELIGIBLE FOR AUTONOMOUS NIGHTLY EXECUTION` neighbors (T-017/T-039/T-040) which explicitly opt out of the mechanical promotion path. Flagging in case that read is wrong and T-091 was meant to stay in backlog for a reason not stated in the file.
