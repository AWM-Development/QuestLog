# Morning Report

**Location:** `Docs/tickets/REPORT_TEMPLATE.md`
**Last Updated:** 2026-07-07

Written to `Docs/tickets/reports/T-###-slug.md` on completion (shipped or blocked) and posted as the PR description (shipped tickets only — blocked tickets have no PR). Alex reads this in the 20–45 minute morning review window; it should be scannable in under 2 minutes with detail available if something looks off.

```markdown
# T-### — <title>

**Outcome:** shipped | blocked
**Branch:** feat/<milestone>/<slug>
**Diff:** <N files changed, +X/-Y lines>

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

## Anything Alex must decide

<Any 🧠-gated checkpoint skipped this ticket, any scope judgment call made
that a stricter reading of "out of scope" might disagree with, any
follow-up ticket this work implies. "None" is a valid, common answer.>
```

## Notes

- If blocked, use `Docs/tickets/BLOCKED_TEMPLATE.md` instead — that's the full report for a blocked ticket, there's no separate morning report on top of it.
- "Test evidence" means pasted output. A report that says "tests pass" without showing the run is not acceptable — this is the same discipline as `CLAUDE.md`'s "never claim done without showing output."
- Definition of done (per `TICKET_SPEC.md`) includes updating `MILESTONES_V1_MCP.md`'s checkbox, `IMPLEMENTATION_NOTES.md` if applicable, and a `CHANGELOG.md` entry under `[Unreleased]` — confirm all three happened before writing "shipped."
