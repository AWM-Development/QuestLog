---
description: Check out and review a PR (default: latest against develop, or a given T-### / PR number / branch) — morning report recap, independent code review, and a plain-English explanation for Alex
argument-hint: [T-### | PR number | branch name]
---

Resolve the review target from `$ARGUMENTS` (may be empty):
- Empty → the most recently opened PR with base branch `develop` (prefer the most recently created **open** PR; if none is open, fall back to the most recently updated closed one and say so).
- A ticket id (`T-023`) → find its PR the same way `Docs/tickets/EXECUTOR_ROUTINE.md` Step 1 does: search `T-023 in:title` (state: all), base `develop`.
- A bare number → treat it as a PR number directly.
- Anything else → treat it as a head branch name and find the PR whose head matches it.

Then:

1. `git fetch origin <head-branch>`, then create this session's own worktree for it — `git worktree add tmp/worktrees/review-<head-branch>/ <head-branch>`, `cd` into it — following the convention `Docs/IMPLEMENTATION_NOTES.md` § T-069 records. This never touches the shared primary directory, so a concurrent session's uncommitted work there is never at risk (previously this stashed (`-u`) before checking out in place, which could sweep up a *different* session's uncommitted changes — see `Docs/IMPLEMENTATION_NOTES.md` § T-070). This is a read-only review — do not commit, push, or edit files as part of this command.
2. Look for the ticket file this PR belongs to (`Docs/tickets/done/T-###-*.md` or `Docs/tickets/blocked/T-###-*.md`) and its report (`Docs/tickets/reports/T-###-*.md`). If neither exists — this PR isn't ticket-shaped — say so and use the PR description/diff for section 1 instead.
3. Look for a usage artifact at `Docs/tickets/cost-reports/T-###.usage.json` (produced by the executor's `Stop` hook per `Docs/tickets/done/T-046-executor-usage-capture-hook.md`, committed as part of Step 7 wrap-up). It may not exist — the hook only started capturing data going forward from when T-046 shipped, so PRs from before that (or non-ticket-shaped PRs) won't have one.

Reply with exactly four sections, in this order:

## 1. Cost

If a `T-###.usage.json` exists, report from it: total tokens (input/output/cache-write/cache-read), wall-clock duration, turn count, `turns_to_green`, and theoretical cost — lead with whichever of `intro_usd`/`standard_usd` the artifact's `applies_rate` says actually applied, and mention the other for reference. If `reviewer_subagent` is non-null, show its cost separately alongside `total_system_cost_usd`. If `manually_inspected` is `true`, say so explicitly and note the cost/turn-count reflects a session Alex interrupted, not a clean autonomous run — don't present it as representative without that caveat. If no usage artifact exists for this ticket, say so plainly (e.g. "no usage artifact — this PR predates the usage-capture hook") rather than omitting the section or fabricating numbers.

## 2. Morning report

Recap the ticket's morning report (or the PR description, if there's no ticket report) essentially as written — outcome, what shipped, test evidence, exit-condition check, the executor's own reviewer verdict, anything flagged for Alex to decide. This is a faithful recap, not a re-analysis — don't thin it out.

## 3. Code review

Form your own independent judgment on the diff (`git diff origin/develop...<head-branch>`) — don't just restate the report's reviewer verdict. Check what `.claude/agents/reviewer.md` checks (pattern deviation against the matching `.claude/rules/*.md`, functionality gaps vs. the ticket's Scope, test theater vs. real assertions, scope creep vs. Out of scope, DRY/sprawl — the same pattern or literal reinstantiated across more than one file in this diff instead of consolidated) plus ordinary correctness/efficiency concerns. List concrete `file:line` findings with a suggested edit where you have one. If nothing rises to a real finding, say that plainly rather than manufacturing nitpicks.

## 4. Plain English explanation

Explain what was actually built, for Alex specifically: 8 years as a senior engineer, ~99% UI/UX and mobile background. He's technical and doesn't need concepts simplified, but backend/DB/architecture vocabulary that's off his home turf (migrations, query planners, indexes, embeddings/ANN search, tRPC routers, Drizzle, pgvector, hybrid search, etc.) should be translated into plain English rather than assumed. Cover concretely what changed, then — only if applicable — real-world UX implications: does this change any user-facing behavior, response time, error case, or interaction in QuestLog? If it's a pure backend/infra change with zero observable difference to using the app, say that explicitly rather than inventing a UX angle.

Do not modify, commit, or push anything during this command. The review happens entirely in its own worktree, so the primary directory's branch is never touched — nothing to switch back to.
