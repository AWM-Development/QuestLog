# T-085 — Inline relevant IMPLEMENTATION_NOTES.md sections into ticket bodies

**Outcome:** shipped
**Branch:** feat/m-efficiency/t-085-inline-implementation-notes-sections
**Diff:** 5 files changed (skill + TICKET_SPEC + milestone checkbox + changelog + report/ticket move; pickup/promote bookkeeping on the ticket file)
**Complexity tier:** not present on ticket (pre-T-050 field)
**Strategy-gate flag:** not present on ticket (pre-T-050 field)

## What shipped

`ticket-writer`'s Context-files drafting step now pastes a single relevant `IMPLEMENTATION_NOTES.md` § into the ticket body under `## Relevant background` (heading + capture-date citation) instead of naming the whole notes file when only one section applies. `TICKET_SPEC.md` documents the optional field and the staleness-check rule for executors.

## Test evidence

```
lint: pass (0 warnings)
typecheck: pass
test: pass (672 passed)
```

(Full stage logs under `tmp/test-logs/`. Default `pnpm test` via turbo hit intermittent `deadlock detected` failures in `@questlog/core` under file-parallel vitest against the shared local test DB — known env flake, not this ticket. Green run used `pnpm test -- --force -- --no-file-parallelism`, which still exercises the same suites: observability 12, mcp 51, server 103, core 244, web 262.)

## Exit condition check

- **lint/typecheck/test green** — see Test evidence above. No runtime code touched.
- **`grep` ticket-writer instructs `## Relevant background` paste with heading+date citation** — confirmed at `.claude/skills/ticket-writer/SKILL.md:41` (`Relevant background`, `excerpted from`, single-§ vs whole-file rule).
- **`grep` TICKET_SPEC documents field + staleness-check** — confirmed at `Docs/tickets/TICKET_SPEC.md:30-33` (format block) and `:97` (field notes including staleness-check).
- **Mock historical example excerpts only one section** — verification artifact below. Excerpt is 4 lines / ~2KB vs the live `IMPLEMENTATION_NOTES.md` at 905 lines / ~189KB; sibling T-069 subsections (`tmp/.active-ticket`, session-context deletion, claim-mechanism proof) are not included.

### Verification artifact — mock ticket draft applying the new procedure

A hypothetical follow-on that only needs T-069's worktree-convention subsection would be drafted like this (not filed — demonstration only):

```markdown
# T-XXX — Example consumer of the worktree convention

Milestone ref: M-EFFICIENCY.example

Priority: P1

Branch: feat/m-efficiency/t-xxx-example

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md

## Relevant background
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § T-069 — Executor worktree isolation + ticket claim / ### The worktree convention, as of 2026-08-01

### The worktree convention, for `T-070` (and anyone else) to follow without re-deriving it
Each ticket-execution session (nightly `/executor`, or a `/promote-execute` fresh pick) gets its own git worktree at **`tmp/worktrees/T-###/`**, created from `origin/develop` on the ticket's own `Branch:` name: `git worktree add tmp/worktrees/T-###/ -b <branch-name> origin/develop`, then `cd` into it — every step of that session's work happens there, never in the primary checkout. A resumed session (stale claim past the staleness window) enters the existing remote branch the same way instead of cutting a new one: `git worktree add tmp/worktrees/T-###/ <existing-branch-name>`. Not entered/removed via `EnterWorktree`/`ExitWorktree` or the `Agent` tool's `isolation: "worktree"` — both of those are real harness mechanisms, but both hard-code `.claude/worktrees/` (confirmed by inspecting their tool descriptions and by the pre-existing `.claude/worktrees/heuristic-hermann-e69c56` directory in this repo, most likely a byproduct of one of them), which is exactly the path this ticket forbids: the harness gates any write under `.claude/` behind an interactive confirmation that silently stalls an unattended nightly run (T-062, and this ticket treats worktree creation as a write for the same purpose). Neither offers a way to redirect the path, so the hand-rolled `git worktree add` flow above is deliberate, not a fallback taken without checking — confirmed by reading both mechanisms' actual behavior before committing to this approach, per the ticket's own instruction to verify rather than assume. `git worktree add`/`checkout` also don't require the primary directory to be on any particular branch, which is why `EXECUTOR_ROUTINE.md` Step 0 now only fetches — it never checks out `develop` there at all, so a concurrent session sharing that primary directory is never disturbed.

Worktrees are not reaped automatically — one accumulates per ticket. Cleanup is unticketed; flagged again here so it's easy to find when someone picks it up.

Mockup: none

Model: sonnet

Scope: <would reference the worktree path convention above without loading the rest of IMPLEMENTATION_NOTES.md>
```

Note: the pasted subsection's last sentence ("Worktrees are not reaped automatically…") is historical T-069 text; T-087 later added reaping. That staleness is exactly what the new field's "re-check live file if something looks inconsistent" rule is for — and why this ticket does not claim excerpts stay eternally current.

## Reviewer verdict

PASS

> **Scope check.** Both required changes are present and correct:
> - `.claude/skills/ticket-writer/SKILL.md:41` — the Context files bullet now carries the special case…
> - `Docs/tickets/TICKET_SPEC.md:30-33` — format block adds the optional `## Relevant background` field in the right position…
> - `Docs/tickets/TICKET_SPEC.md:97` — field notes fully document the field, including the staleness-check language…
> - `Docs/tickets/TICKET_SPEC.md:96` cross-references the new field with a one-line pointer rather than duplicating the full rationale…
>
> **Exit condition greps** — both pass.
> **Out of scope / scope creep** — none.
> **Runtime/tests** — no runtime code touched.
>
> PASS

(Full review: [T-085 reviewer](b527aec8-7ad3-4f3f-ab21-bf3f235068a8))

## Efficiency notes

Docs/skill-only ticket; context load stayed inside the named files. Main drag was environment: default turbo `pnpm test` deadlocked in `@questlog/core` under file-parallel vitest on the shared `:5433` test DB (and turbo still filters `QUESTLOG_PG_PORT`, so the per-worktree Postgres from session-start couldn't isolate the suite without also breaking `test-db-url.test.ts`'s hardcoded-5433 cases — known T-072 note). Resolved by re-running with `--no-file-parallelism` rather than changing product code.

**Retry log:** 3 retries categorized `environment_setup` (Postgres `deadlock detected` under file-parallel core tests / turbo stripping `QUESTLOG_PG_PORT`). 0 `mechanical_lint_typecheck`, 0 `genuine_bug_caught_by_test`.

## Anything Alex must decide

None for merge. Optional follow-up (explicitly out of this ticket's scope, flagged per Out of scope): if excerpt-and-cite proves insufficient once many tickets carry multi-KB pasted sections, splitting `IMPLEMENTATION_NOTES.md` into topic files is still worth a separate ticket — this run did not hit that limit.

`capture-usage` no-op'd in this Cursor `/promote-execute` session (`no stdin payload and no session found via CLAUDE_CODE_SESSION_ID`) — no `Docs/tickets/cost-reports/T-085.usage.json` produced. Not a product defect; cost artifact simply unavailable outside Claude Code's session-id env.
