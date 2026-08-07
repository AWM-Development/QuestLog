# T-147 — Every local session gets its own worktree by default

Born from a real collision, same day: two interactive Claude Code sessions
(one running T-145, one running an unrelated task) were both working
directly in the shared primary checkout at once. `T-069`/`T-070` already
solved this for the *nightly ticket pipeline* — the executor,
`/promote-execute`, `/lineup`, `/morning-review`, `/ungate` all create
their own `tmp/worktrees/<name>/` before touching anything. Neither of
today's two sessions was a pipeline invocation, so neither got that
protection — each just edited files directly in
`/Users/alexandermeyer/Documents/Code/QuestLog`, and one session's
in-progress, uncommitted edits nearly got clobbered by the other's `git
merge`. This ticket closes that gap by making worktree isolation the
default for *every* local session, not just pipeline-invoked ones.

Milestone ref: ad hoc pipeline safety (not extracted from a milestone doc
  task, same category as T-069/T-132/T-145 — this is infrastructure the
  pipeline needs, not a product feature)

Complexity tier: D

Strategy-gate flag: no

Priority: P0 (Alex's explicit call — this has cost real session time twice
  in one day)

Branch: chore/m-pipeline/t-147-session-worktree-default

Context files (load ONLY these):
  - AGENTS.md (the constitution every session reads first — this is where
    the new rule has to live to actually be read)
  - .claude/hooks/session-start.sh (runs for every session, local and
    remote — the mechanical nudge lives here)
  - Docs/tickets/done/T-069-executor-concurrency-safety.md (the existing
    worktree convention this ticket generalizes, not replaces)

Mockup: none

Model: sonnet

Scope:
  1. **`AGENTS.md`**: a new rule, prominent, applying to every local
     session regardless of how it started — not scoped to "autonomous
     runs" like the existing "Hard rules" section. Before editing
     anything, if the session's working directory is the shared primary
     checkout (not already under `tmp/worktrees/`) and this isn't a fresh,
     inherently-isolated remote sandbox, create/enter a worktree first:
     `git fetch origin develop && git worktree add tmp/worktrees/<slug>
     -B <branch> origin/develop`, then do all work there. Skip only for
     genuinely read-only sessions that make no edits.
  2. **`.claude/hooks/session-start.sh`**: when running locally (not
     `CLAUDE_CODE_REMOTE=true`) and `$CLAUDE_PROJECT_DIR` is the primary
     checkout rather than a `tmp/worktrees/*` path, print a loud,
     impossible-to-miss reminder naming the exact commands to run. The
     hook itself cannot relocate the session (each Bash call's cwd is
     fixed by the harness for the session's lifetime) — this is a
     mechanical nudge reinforcing the `AGENTS.md` rule, not the
     enforcement mechanism itself.
  3. **`Docs/IMPLEMENTATION_NOTES.md`**: a dated entry recording today's
     collision as the motivating incident and the decision to generalize
     T-069's convention beyond the pipeline.

Out of scope:
  - Any change to `T-069`'s pipeline-specific worktree naming/lifecycle
    (`tmp/worktrees/T-###/`) — this ticket only extends *who* gets a
    worktree, not how the pipeline's own already works.
  - Automated enforcement (a pre-commit hook rejecting edits made outside
    a worktree, CI checks, etc.) — the session-start banner plus the
    `AGENTS.md` rule is the whole fix for now. If this keeps recurring
    despite it, that's a follow-up, not scope creep to pre-empt here.
  - Worktree reaping/cleanup automation — already unticketed per T-069's
    own report, unaffected by more worktrees existing sooner.

Exit condition (machine-checkable):
  - `grep -c "own worktree" AGENTS.md` returns non-zero, and the new rule
    text names the exact `git worktree add` command a session should run
  - `session-start.sh` contains a conditional branch that fires only when
    local (`CLAUDE_CODE_REMOTE` unset/false) and `$CLAUDE_PROJECT_DIR` is
    not under `tmp/worktrees/`, printing the reminder — verified by
    running the hook by hand from the primary checkout and confirming the
    banner prints, then from inside a `tmp/worktrees/*` directory and
    confirming it doesn't
  - `Docs/IMPLEMENTATION_NOTES.md` records the decision under its own § T-147

Iteration cap: not applicable (small, direct interactive fix — no
  Blocked Protocol needed)

Definition of done includes: no milestone-doc checkbox (ad hoc ticket),
  IMPLEMENTATION_NOTES.md updated (this ticket's own Scope item 3), a
  CHANGELOG.md entry under [Unreleased], report filed at
  Docs/tickets/reports/T-147-session-worktree-default.md.
