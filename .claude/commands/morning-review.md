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

1. `git status` — if the working tree isn't clean, stash (`-u`) and say so before switching branches. `git fetch origin <head-branch>`, then `git checkout <head-branch>`. This is a read-only review — do not commit, push, or edit files as part of this command.
2. Look for the ticket file this PR belongs to (`Docs/tickets/done/T-###-*.md` or `Docs/tickets/blocked/T-###-*.md`) and its report (`Docs/tickets/reports/T-###-*.md`). If neither exists — this PR isn't ticket-shaped — say so and use the PR description/diff for section 1 instead.

Reply with exactly three sections, in this order:

## 1. Morning report

Recap the ticket's morning report (or the PR description, if there's no ticket report) essentially as written — outcome, what shipped, test evidence, exit-condition check, the executor's own reviewer verdict, anything flagged for Alex to decide. This is a faithful recap, not a re-analysis — don't thin it out.

## 2. Code review

Form your own independent judgment on the diff (`git diff origin/develop...<head-branch>`) — don't just restate the report's reviewer verdict. Check what `.claude/agents/reviewer.md` checks (pattern deviation against the matching `.claude/rules/*.md`, functionality gaps vs. the ticket's Scope, test theater vs. real assertions, scope creep vs. Out of scope) plus ordinary correctness/simplification/efficiency concerns. List concrete `file:line` findings with a suggested edit where you have one. If nothing rises to a real finding, say that plainly rather than manufacturing nitpicks.

## 3. Plain English explanation

Explain what was actually built, for Alex specifically: 8 years as a senior engineer, ~99% UI/UX and mobile background. He's technical and doesn't need concepts simplified, but backend/DB/architecture vocabulary that's off his home turf (migrations, query planners, indexes, embeddings/ANN search, tRPC routers, Drizzle, pgvector, hybrid search, etc.) should be translated into plain English rather than assumed. Cover concretely what changed, then — only if applicable — real-world UX implications: does this change any user-facing behavior, response time, error case, or interaction in QuestLog? If it's a pure backend/infra change with zero observable difference to using the app, say that explicitly rather than inventing a UX angle.

Do not modify, commit, or push anything during this command. If you end on a branch other than the one you started this session on, say so at the end so Alex knows to switch back if he wants to.
