# T-070 — Convert the remaining shared-tree mutators to T-069's worktree convention

Milestone ref: M-PIPELINE.2 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P0

Blocked on: T-069 — must be merged into develop first

Branch: feat/m-pipeline/t-070-convert-remaining-shared-tree-mutators

Context files (load ONLY these):
  - .claude/commands/lineup.md (the force-checkout mislabeled "read-only bootstrap", line 9)
  - .claude/commands/morning-review.md (the `git stash -u` + checkout, line 14)
  - .claude/skills/ungate/SKILL.md (step 0's `gates/<gate-slug>` branch cut, line 18)
  - .claude/commands/promote.md (read-only reference implementation — reads ticket files off `origin/develop` without ever checking out; the pattern `/lineup` should adopt. Do not change it)
  - Docs/tickets/COMMANDS.md (the `Unattended-safe?` column, currently wrong for `/lineup`)
  - Docs/IMPLEMENTATION_NOTES.md § the worktree convention T-069 records (this ticket follows it; it does not redesign it)
  - .claude/skills/ticket-writer/SKILL.md (step 0 — same shape, prose rather than a command; see Scope)

Mockup: none

Model: sonnet

Scope:

`T-069` made the executor path concurrency-safe but deliberately left three other commands checking out or stashing in the shared primary working directory. Isolation is only as good as its least-converted entrypoint: one `/lineup` run mid-executor undoes `T-069` entirely. This ticket converts the rest, following the convention `T-069` established — it does not invent a new one, and any temptation to redesign the worktree layout belongs back in `T-069`, not here.

  - **`.claude/commands/lineup.md:9`** runs `git checkout -B develop origin/develop` while describing it as a "read-only bootstrap." It is not read-only: `-B` force-moves the local `develop` ref and switches the working tree. `/lineup` genuinely only ever *reads* ticket files, so it needs no checkout and no worktree either — convert it to read from `origin/develop` directly (`git show origin/develop:<path>`), following `.claude/commands/promote.md:12`, which already does exactly this. This is the cheapest of the three and the one with the widest blast radius, because `/lineup` is the command most likely to be running on a schedule while something else works.
  - **`Docs/tickets/COMMANDS.md`** currently advertises `/lineup` as `Unattended-safe? Yes — safe to schedule daily`. That claim is false today and becomes true only once the above lands. Update the row's reasoning, not just its verdict.
  - **`.claude/commands/morning-review.md:14`** runs `git stash -u` before checking out the PR's head branch. On a shared tree that stash sweeps up a *different* concurrent session's uncommitted work — the most likely mechanism behind observed real data loss (see `M-PIPELINE`'s Context note in the milestone doc, and `G-013`'s Renumbered note for a concrete instance). Give it its own worktree per `T-069`'s convention, and delete the stash step rather than keeping it as a safety net: a fresh worktree has nothing to stash, and leaving it in preserves the exact behavior this ticket exists to remove.
  - **`.claude/skills/ungate/SKILL.md:18`** cuts its `gates/<gate-slug>` branch in whatever directory the session started in. Same treatment — its own worktree. **Keep the `gates/*` branch-prefix convention exactly as-is**: the naming scheme is deliberate (`TICKET_SPEC.md` § "Branch naming" explains why `gates/*`, `tickets/*`, and `feat/*` are visibly distinct) and is not what this ticket changes. Only where the checkout happens changes.
  - **`.claude/skills/ticket-writer/SKILL.md`** step 0 has the same shape (cut a `tickets/<milestone-slug>` branch) but states it as prose rather than a runnable command. Convert it if that is mechanical. If it needs a judgement call about how the skill gets invoked, leave it alone and say so in the report — an honest note beats a guess, and this one is lower-risk than the other three because it runs with Alex present.

Out of scope:
  - Anything `T-069` owns: the worktree convention itself, the claim-by-push mechanism, the staleness window, `tmp/` marker isolation, `EXECUTOR_ROUTINE.md`, `.claude/commands/executor.md`, `.claude/commands/promote-execute.md`. If the convention turns out to be wrong or underspecified, report that rather than fixing it here.
  - `.claude/commands/promote.md` and `.claude/commands/archive-implementation-notes.md` — both audited during `T-069`'s ticket-writing session and confirmed to need no change. Leave them alone.
  - Per-worktree Postgres test databases (owned by gate `G-008`), both GitHub Actions workflows, and `T-060`'s within-run truncate race — same fences as `T-069`.
  - Worktree reaping/cleanup automation. Still unticketed after this lands; note it again in the report if it hasn't been picked up.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `grep -rlE 'checkout -B develop|git stash' .claude/commands/ .claude/skills/` returns no file — combined with `T-069`, no command or skill in the repo mutates the shared primary working tree
  - `.claude/commands/lineup.md` contains no `git checkout` at all, and reads ticket files via `origin/develop` (e.g. `git show origin/develop:`)
  - `Docs/tickets/COMMANDS.md`'s `/lineup` row justifies its `Unattended-safe? Yes` on the read-only implementation rather than on a force-checkout
  - `.claude/commands/morning-review.md` and `.claude/skills/ungate/SKILL.md` each create/enter their own worktree per `T-069`'s recorded convention, and `morning-review.md` no longer stashes
  - `.claude/skills/ungate/SKILL.md` still cuts a `gates/<gate-slug>`-prefixed branch — the prefix convention is unchanged
  - running `/lineup`'s read path against `origin/develop` produces the same ticket list as the pre-change implementation for at least one real ticket directory (`Docs/tickets/queue/`), demonstrating the conversion is behavior-preserving and not merely non-crashing

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
