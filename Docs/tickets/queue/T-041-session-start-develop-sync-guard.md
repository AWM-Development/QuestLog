# T-041 — Fix session-start.sh's develop-sync guard clobbering committed-but-unmerged changes

Milestone ref: M-MCP.5 (`Docs/MILESTONES_V1_MCP.md`) — pipeline tooling fix,
found during PR #77's work; not itself a milestone task (same precedent as
T-025/T-027)

Branch: feat/m-mcp/t-041-session-start-develop-sync-guard

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (lines 20-31, the develop-sync block —
    the rest of the file, the Postgres/pgvector bootstrap, is unrelated and
    out of scope)

Mockup: none

Model: sonnet

Scope:
  `.claude/hooks/session-start.sh`'s develop-sync step exists to pull
  `.claude/commands`/`.claude/skills` from `origin/develop` when a remote
  session's snapshot predates a command or skill landing there. Its guard
  only checks `git status --porcelain` — i.e. *uncommitted* differences —
  before doing `git checkout origin/develop -- .claude/commands
  .claude/skills`. Once a branch's own edit to a file that already exists
  on `develop` is committed (but not yet merged), `git status --porcelain`
  reports clean for that path, so the guard passes and the checkout
  silently overwrites the branch's committed change with develop's stale
  copy in the working tree. If the branch commits again without noticing,
  the revert rides along and undoes already-pushed work.

  Observed twice in one session on `claude/ticket-creation-promotion-jjet86`:
  `.claude/skills/ticket-writer/SKILL.md` was silently reverted to
  develop's pre-change copy on two separate session resumes, each requiring
  a manual `git checkout HEAD -- <path>` before the next commit to avoid
  shipping the regression.

  Fix the guard so it only pulls a path from `origin/develop` when that
  path has **not diverged from the merge-base with `origin/develop` on the
  current branch** — e.g. compare against
  `git merge-base HEAD origin/develop` (after the existing `git fetch`)
  and only checkout paths that are identical to that merge-base copy,
  instead of only checking working-tree cleanliness. Any approach is
  acceptable as long as it satisfies both invariants below; a
  merge-base diff is the suggested mechanism, not a mandated one.

  The fix must preserve both existing invariants:
  - A path untouched by the branch (identical to develop at the
    merge-base, no local edits) still gets synced to `origin/develop`'s
    latest — this is the guard's actual purpose and must keep working.
  - A path that doesn't exist on `origin/develop` yet (a new file the
    branch introduced) is still a no-op, same as today.

  And add the invariant that was missing:
  - A path where the current branch has committed (whether or not also
    working-tree-clean) changes since the merge-base with
    `origin/develop` is left untouched by the sync — never checked out
    from `origin/develop`, committed or not.

Out of scope:
  - The Postgres/pgvector bootstrap logic in the rest of the script
    (everything from the `ENV_FILE` derivation onward) — unrelated,
    working, not touched.
  - Any change to *what* gets synced (still just `.claude/commands` and
    `.claude/skills`) or *when* the sync block runs (still gated on
    `CLAUDE_CODE_REMOTE=true`) — only the guard condition changes.
  - No new test framework or CI job for hooks scripts — verify with a
    scripted repro in a scratch git checkout, per the exit condition below.

Exit condition (machine-checkable):
  - A scripted repro (e.g. a throwaway script under a scratch dir, not
    committed) that, against a temporary git checkout with a local
    "develop" remote branch, demonstrates all three scenarios pass with
    the fixed guard:
    1. Branch has no changes to an existing `.claude/skills/`-tracked file
       and develop has a newer copy → sync still applies develop's
       version (unchanged behavior, proves the guard isn't just disabled).
    2. Branch has a **committed, unmerged** edit to an existing
       `.claude/skills/`-tracked file → sync leaves the branch's committed
       content untouched (the bug this ticket fixes — this scenario must
       fail against the current guard and pass against the fixed one;
       show both runs).
    3. Branch introduces a new file under `.claude/skills/` that doesn't
       exist on develop → sync remains a no-op (regression check).
  - Paste the actual repro script output for all three scenarios, not a
    description of it.
  - `shellcheck .claude/hooks/session-start.sh` clean (or no new warnings
    versus the pre-ticket baseline, pasted side by side) if `shellcheck`
    is available in the execution sandbox; note explicitly if it isn't and
    skip rather than installing new tooling.

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (not a milestone task, same precedent as T-009/T-025/T-027),
  IMPLEMENTATION_NOTES.md updated with the merge-base-vs-working-tree
  distinction this ticket relies on, a CHANGELOG.md entry under
  [Unreleased], morning report written.
