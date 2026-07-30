# Morning Report

**Location:** `Docs/tickets/REPORT_TEMPLATE.md`
**Last Updated:** 2026-07-07

Written to `Docs/tickets/reports/T-###-slug.md` on completion (shipped or blocked) and posted as the PR description (shipped tickets only — blocked tickets have no PR). Alex reads this in the 20–45 minute morning review window; it should be scannable in under 2 minutes with detail available if something looks off.

```markdown
# T-### — <title>

**Outcome:** shipped | blocked
**Branch:** feat/<milestone>/<slug>
**Diff:** <N files changed, +X/-Y lines>
**Complexity tier:** S | M | L (from the ticket)
**Strategy-gate flag:** yes | no (from the ticket)

## What shipped

<1-3 sentences — what exists now that didn't before, in plain terms.>

## Test evidence

<Pasted actual output of `pnpm lint && pnpm typecheck && pnpm test`, not a
summary. If output is long, paste the final summary lines (pass/fail counts)
plus any relevant failure detail — never just "all tests pass.">

## Exit condition check

<For each item in the ticket's exit condition, state how it was verified —
e.g. "search endpoint returns 3 relevant chunks for query 'dragon lair'
against fixture campaign — see search.integration.test.ts:84".>

## Reviewer verdict

<PASS | PASS-WITH-NOTES | FAIL, plus the reviewer subagent's file:line notes
verbatim. If FAIL and a remediation pass was made, show before/after.>

## Efficiency notes

<Self-report, in your own words, why this run ran long or stayed tight — the
kind of thing only the agent doing the work can know. This is the
qualitative half of the observability system T-046's hook/schema/JSON
artifact provides the quantitative half of (tokens, cost, duration) — don't
duplicate T-046's mechanics here, just narrate. E.g.:
- "given superfluous frontend context on a backend-only ticket"
- "had to refactor a non-standard existing pattern before the new
  implementation could proceed"
- "exit condition required an integration test the ticket's Context files
  didn't mention, so context had to be pulled in mid-ticket"

**Retry log:** for each Red/Green iteration in Step 4 that failed and
triggered a retry (each "distinct approach" counted against the ticket's
iteration cap), record a cause category and a total count:
- `environment_setup` — a DB/config/tooling problem, not the ticket's own logic
- `mechanical_lint_typecheck` — a lint/typecheck failure, not a test failure
- `genuine_bug_caught_by_test` — the test suite correctly caught a real logic error

e.g. "2 retries: 1 environment_setup (Postgres container not migrated), 1
genuine_bug_caught_by_test (off-by-one in chunk offset)." "0 retries" is a
valid, common answer.

## Anything Alex must decide

<Any 🧠-gated checkpoint skipped this ticket — cite the `G-###` gate-stub
filed for it (`Docs/tickets/GATE_SPEC.md`), not just a prose description —
any scope judgment call made that a stricter reading of "out of scope"
might disagree with, any follow-up ticket this work implies. "None" is a
valid, common answer.>
```

## Notes

- If blocked, use `Docs/tickets/BLOCKED_TEMPLATE.md` instead — that's the full report for a blocked ticket, there's no separate morning report on top of it.
- "Test evidence" means pasted output. A report that says "tests pass" without showing the run is not acceptable — this is the same discipline as `CLAUDE.md`'s "never claim done without showing output."
- Definition of done (per `TICKET_SPEC.md`) includes updating `Docs/milestones/MILESTONES_V1_MCP.md`'s checkbox, `IMPLEMENTATION_NOTES.md` if applicable, and a `CHANGELOG.md` entry under `[Unreleased]` — confirm all three happened before writing "shipped."
