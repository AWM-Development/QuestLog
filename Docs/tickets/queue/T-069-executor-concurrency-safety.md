# T-069 — Concurrency-safe executor: worktree isolation + ticket claim

Milestone ref: M-PIPELINE.1 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P0

Branch: feat/m-pipeline/t-069-executor-concurrency-safety

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (the file this ticket principally rewrites — Steps 0, 1, 2, 6, 7)
  - .claude/commands/executor.md (2 lines; carries its own copy of the Step 0 force-checkout)
  - .claude/commands/promote-execute.md (hands off into the same routine at Step 2 — must not be left behind)
  - .claude/commands/promote.md (read-only reference implementation — reads from origin/develop without ever checking out; do not change it)
  - .claude/hooks/session-start.sh (writes tmp/.session-context.json; also the develop-sync guard)
  - packages/core/src/observability/capture-usage.ts (`resolveActiveTicketId` — the sole consumer of tmp/.active-ticket)
  - Docs/tickets/TICKET_SPEC.md § "Why develop's ticket directories can lag reality" and § "Branch naming"
  - Docs/IMPLEMENTATION_NOTES.md § T-046 (usage-capture attribution and why tmp/ holds these markers rather than .claude/)

Mockup: none

Model: sonnet

Scope:

**(a) Worktree isolation.** Each executor session works in its own git worktree at `.claude/worktrees/T-###/`, never in the shared primary working directory. Today `EXECUTOR_ROUTINE.md` Step 0 and `.claude/commands/executor.md:5` both run an unconditional `git checkout -B develop origin/develop`; the routine justifies this as safe because the sandbox is "a fresh, disposable workspace." True for a remote harness session, false for `/executor` run locally, where it force-moves `develop` and yanks the working tree out from under any concurrent session. Rewrite Step 0 and both command files accordingly.

There is a sequencing problem to solve, and it is the substantive design work in this scope item: the worktree is named for the ticket, but the ticket id isn't known until Step 1's selection walk has run — and Step 1 currently needs a checkout to read `Docs/tickets/`. Resolve it by making Step 1 read-only against the remote rather than against a working tree: `git show origin/develop:<path>` reads any ticket file without touching a working tree at all, and Step 1's other two checks (`gh pr list`, `git ls-remote`) already never touch one. Step 1's backlog-promotion *writes* then move to just after the worktree exists in Step 2 — computed during Step 1, committed inside the worktree. Any equivalent approach that keeps Step 1 free of shared-tree mutation is acceptable; this one is not mandated.

**(b) Ticket claim.** Push the feature branch at Step 2, carrying the `queue/`→`in-progress/` pickup commit, instead of deferring every push to Step 6/7. This makes the `git ls-remote` check Step 1 already performs an actual mutex rather than a check-then-act read two sessions can both pass. Step 2's current "do not push it yet" instruction and its stated rationale are what this replaces — update that prose, don't leave it contradicting the new behavior.

This forces a matching change to Step 1's **case 4** (`matching branch found, no PR, not blocked → resume it`), which would otherwise read a live claim as an interrupted run and put two agents on one branch — strictly worse than the duplicate pickup it replaces. Add a staleness window: read the claim's age (e.g. `git log -1 --format=%cI origin/<branch>`) and only resume when it exceeds the threshold; below it, treat the ticket as actively owned and skip to the next candidate, noting it the way cases 2 and 3 already do. Define the threshold once, as a named value in the routine, with a comment on the tradeoff (too low steals a slow ticket mid-flight; too high strands a crashed run). Propose 6 hours; use judgement if the ticket's own evidence suggests otherwise.

**(c) `tmp/` marker isolation.** Confirm `tmp/.active-ticket` and `tmp/.session-context.json` actually resolve per-worktree once (a) lands — i.e. that `CLAUDE_PROJECT_DIR` points at the worktree and not the primary repo. **Verify this; do not assume it.** If it resolves per-worktree, both markers are fixed for free and the scope item is a one-line note in the report saying so. If it resolves to the primary repo, make the two markers session-scoped so concurrent sessions can't clobber each other. `tmp/.session-context.json` is the more urgent of the two: `session-start.sh` rewrites it unconditionally on *every* session start, so a second session silently replaces the transcript path an earlier session's Step 7 `capture-usage` will read — meaning cost records are likely already misattributed today, before any of this ticket's changes.

**Establish the worktree convention explicitly.** `T-070` converts the three remaining shared-tree mutators (`/lineup`, `/morning-review`, `/ungate`) and is blocked on this ticket specifically because it inherits the convention established here. So whatever shape (a) lands — worktree path layout, naming, creation/entry commands, how a session finds or reuses its own worktree — write it down once somewhere `T-070` can follow (a short section in `Docs/IMPLEMENTATION_NOTES.md` is the natural home) rather than leaving it implicit in two command files. Do not convert those three commands here; that is `T-070`'s scope.

**Proving the claim mechanism.** No spike, and deliberately no probe branch: `EXECUTOR_ROUTINE.md`'s CRITICAL BRANCH RULES permit pushing only the current ticket's own feature branch, so a throwaway probe would violate the very rules this ticket is hardening. Instead this ticket's own execution is the experiment — its Step 2 claim push and its Step 6/7 final push are exactly the two-pushes-to-one-branch sequence under test. Step 2's existing prose flags that a second push to an already-existing branch "is not similarly known-safe" with the git proxy; this ticket settles that empirically. **If the second push is rejected, that is a legitimate finding, not a failure**: fall back to the harness-assigned branch exactly as Step 2's existing fallback already directs, record the rejection verbatim in the report under "Anything Alex must decide", and leave scope items (a) and (c) shipped. Do not spend iteration-cap attempts trying to force it through.

Out of scope:
  - **Per-worktree Postgres test databases.** Concurrent agents share one physical `questlog_test` whose `global-setup.ts` truncates repo-wide, so one agent's run wipes another's fixtures. Real, and deliberately excluded: that surface belongs to the open gate `G-008` (test-database topology), now annotated with this second axis. Do not resolve `G-008`, do not file a new gate for it, and do not touch `scripts/test-db-names.sh`, any `vitest.config.ts`, or `packages/core/src/db/test-db-url.ts`. Running this ticket's own tests while another agent runs theirs may produce a spurious failure for exactly this reason — if a test fails in a way unrelated to the diff, re-run it in isolation before treating it as real, and say so in the report.
  - Both GitHub Actions workflows. CI gets a fresh isolated Postgres container per run and has no cross-agent collision by construction — `ci.yml` and `e2e-release-check.yml` are untouched by this ticket.
  - `T-060`'s within-run `truncateAllTables` FK race (queued separately, `P1`) — same family, different bug, not this ticket's.
  - **The three non-executor shared-tree mutators** — `.claude/commands/lineup.md`, `.claude/commands/morning-review.md`, `.claude/skills/ungate/SKILL.md`, and `Docs/tickets/COMMANDS.md`'s `/lineup` row. All real instances of the same problem, all split out to `T-070`, which is blocked on this ticket. Do not touch them here, and do not treat their continued existence as this ticket failing its own goal — the pipeline is only fully safe once both have landed.
  - Worktree reaping. Worktrees will accumulate one per ticket; automated cleanup is a follow-up, not scope here. Note it in the report so it can be ticketed.
  - Any change to `git worktree`'s own mechanics beyond using it, and any attempt to make the *primary* working directory safe for agents to share — the entire approach is that they no longer share it.
  - Updating the scheduled-agent config to match the rewritten routine. That is an Alex-only action (see Definition of done).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `git worktree add` for two distinct ticket ids succeeds, and `git -C <second-worktree> checkout <first-worktree's branch>` fails — demonstrating git itself refuses to check out one branch in two worktrees, i.e. the isolation is mechanical rather than conventional
  - a scripted check confirms `tmp/.active-ticket` written inside worktree A is not visible at worktree B's `tmp/.active-ticket` (or, if `CLAUDE_PROJECT_DIR` resolves to the primary repo, that the session-scoped naming introduced by scope item (c) achieves the same separation)
  - `grep -c 'checkout -B develop' .claude/commands/executor.md` returns `0`
  - `Docs/tickets/EXECUTOR_ROUTINE.md` Step 0 instructs creating/entering a per-ticket worktree and no longer instructs an unconditional `git checkout -B develop origin/develop` against the current working directory
  - `Docs/tickets/EXECUTOR_ROUTINE.md` Step 2 instructs pushing the feature branch at pickup, and its previous "Do not push it yet" instruction is gone rather than merely contradicted
  - `Docs/tickets/EXECUTOR_ROUTINE.md` Step 1 case 4 names an explicit staleness threshold and only resumes a branch whose claim is older than it
  - `grep -c 'checkout -B develop' .claude/commands/promote-execute.md` returns `0` — it carries its own copy of the Step 0 bootstrap at line 12, independent of `executor.md`'s
  - `.claude/commands/promote-execute.md`'s step 6 "matching branch, no PR, not blocked" case applies the same staleness threshold as the routine's Step 1 case 4 — it is a **second, independently-worded copy of that same resume rule** (line 24), and fixing only the routine leaves `/promote-execute` able to hijack a live claim. Both copies must agree; consolidating them so the rule exists once is preferred over editing two copies to match, if that can be done without expanding scope.
  - the worktree convention (path layout, naming, creation/entry) is written down in `Docs/IMPLEMENTATION_NOTES.md` in a form `T-070` can follow without re-deriving it from the two converted command files
  - **`Docs/tickets/EXECUTOR_ROUTINE.md`'s header carries the exact, copy-pasteable replacement text for the scheduler prompt's two lines, in a fenced code block, matching whatever bootstrap Step 0 lands on.** The header already has a section describing how the scheduler reaches this file — extend it there rather than starting a new one. This must be in the routine file itself, not only in the report: it is the one piece of this ticket Alex has to apply by hand, it needs to stay correct across future routine changes, and a line that exists only in a one-time report is unfindable six weeks later. The report then points at it instead of restating it (`CLAUDE.md`'s "WHY only, once" applied to docs)
  - the ticket's own final push either succeeded against its already-claimed branch (proving the second push is permitted) or was rejected and the rejection is recorded verbatim in the report — both are passing outcomes for this condition

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.

**Additionally, and specific to this ticket — flag this prominently in the report under "Anything Alex must decide."** The scheduled agent's prompt is a two-line pointer that reads `EXECUTOR_ROUTINE.md` fresh on every run (see that file's corrected header), so edits to Steps 1–7 take effect automatically once merged — no scheduler change needed for those. **But its first line is the bootstrap this ticket removes:**

```
git fetch origin develop && git checkout -B develop origin/develop
```

That line lives in the scheduler prompt itself, which no ticket can edit. So there are three copies of it: `.claude/commands/executor.md:5` and `.claude/commands/promote-execute.md:12` (both in scope here) and the scheduler prompt (Alex-only, out of reach). Until Alex updates that third copy by hand, **every nightly run still force-checkouts `develop` in the shared working directory before this routine's Step 0 ever gets read** — defeating scope item (a) for exactly the unattended runs it matters most for, while appearing to work fine for every locally-invoked `/executor`.

The literal replacement text belongs in this routine's own header (see the matching exit condition), so it stays version-controlled and correct as the routine evolves. The report points Alex at it and states plainly that the change is unapplied until he edits the scheduler prompt — it does not restate the line.

**Note on self-modification.** This ticket rewrites the routine the executing agent is itself following. There is precedent (`T-048`/`T-049` both edited `EXECUTOR_ROUTINE.md` and shipped normally), and the rule is the same as theirs: keep following the routine as loaded at session start, and edit the file as an artifact. Do not re-read the routine mid-run and switch to the half-written version.
