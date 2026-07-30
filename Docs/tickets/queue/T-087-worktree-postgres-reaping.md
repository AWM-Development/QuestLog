# T-087 — Automated worktree + per-worktree Postgres stack reaping

Milestone ref: M-PIPELINE.7 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P0


Branch: feat/m-pipeline/t-087-worktree-postgres-reaping

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (Step 1 — the existing pre-flight this ticket's sweep hooks into; already reads `origin/develop`'s `Docs/tickets/done/` to resolve `Blocked on:` promotions, same merge-status check this ticket needs)
  - Docs/IMPLEMENTATION_NOTES.md § T-069 (worktree convention: path layout, naming, why nothing reaps a worktree today) and § T-072 (per-worktree Postgres stack: port/project-name derivation, the exact teardown command `docker compose -p <project> down -v`)
  - scripts/worktree-postgres-env.sh (derives `QUESTLOG_PG_PORT`/`COMPOSE_PROJECT_NAME` from a worktree's directory name — the reap script must derive the identical project name to tear down the right stack, not reinvent the derivation)
  - .claude/commands/morning-review.md (the "resume an existing worktree if still on disk" pattern T-070 added — this ticket's sweep must only reap worktrees whose branch has an actually-merged PR, never one still open or in review, so it can't undercut that reuse pattern)

Mockup: none

Model: sonnet

Scope: Give every worktree under `tmp/worktrees/` (both ticket-execution and ticket-planning ones — same directory, same lifecycle gap) an automated teardown once its branch's PR has actually merged, tearing down any matching per-worktree Postgres stack first.

1. `scripts/reap-worktree.sh <worktree-name>`: if a Postgres stack matching that worktree's derived `COMPOSE_PROJECT_NAME` (via `scripts/worktree-postgres-env.sh`'s own naming logic) is running, tear it down (`docker compose -p <project> down -v`) — tolerate it not existing (e.g. a ticket-planning worktree never had one) as a no-op, not an error. Then remove the git worktree itself (`git worktree remove tmp/worktrees/<worktree-name>/`), refusing (non-zero exit, nothing removed) if it has uncommitted changes unless `--force` is passed. Running it twice on an already-reaped name is a safe no-op.
2. Wire an automated sweep into `EXECUTOR_ROUTINE.md` Step 1 (its existing pre-flight): for each entry under `tmp/worktrees/*`, resolve its branch and confirm via the GitHub CLI (`gh pr view <branch> --json state,mergedAt` or equivalent) that its PR is actually merged — a ticket file present in `Docs/tickets/done/` is not by itself sufficient, since `done/` also covers won't-fix tickets whose branch may never have opened a PR at all. Reap every worktree that clears this check via the script above; leave every other entry untouched.
3. Document both the script and the sweep trigger in `Docs/IMPLEMENTATION_NOTES.md`, appended to the existing § T-072 section rather than duplicating its port/project-naming rationale — a one-line pointer back to it is enough.

Out of scope:
  - Reaping a worktree whose branch has no PR yet, is still open, or is blocked — only a confirmed-merged branch is safe to reap automatically. A blocked ticket's worktree stays on disk indefinitely, same as today, until Alex resolves it by hand per `TICKET_SPEC.md`'s "Unblocking a blocked ticket."
  - Any change to `T-069`'s worktree-per-ticket convention, `T-070`'s shared-tree-mutator conversions, or `T-072`'s port-derivation mechanism — this ticket only adds teardown, it does not touch how or when a worktree gets created.
  - Reaping anything outside `tmp/worktrees/` (e.g. stray branches with no worktree, dangling Docker images unrelated to a worktree's own compose stack).
  - Running the sweep anywhere other than `EXECUTOR_ROUTINE.md` Step 1 — no new cron/schedule, no wiring into `/lineup` or `/morning-review`.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `scripts/reap-worktree.sh` run against a real worktree with a live matching Postgres stack removes both — confirmed via `git worktree list` (entry absent) and `docker ps -a --filter name=<project>` (no containers) — and running it again on the same now-reaped name exits cleanly with no error
  - `scripts/reap-worktree.sh` run against a worktree with uncommitted changes exits non-zero and leaves the worktree and its Postgres stack (if any) untouched, confirmed by re-checking both are still present; passing `--force` proceeds
  - the `EXECUTOR_ROUTINE.md` Step 1 sweep, run end-to-end against a real merged branch's worktree, reaps it; run against a real still-open branch's worktree, leaves it untouched — both confirmed by `git worktree list` before/after, not by inspection of the script alone

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
