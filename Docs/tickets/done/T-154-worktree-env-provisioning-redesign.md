# T-154 — One shared Postgres instance + worktree-suffixed database names, replacing per-worktree containers on checksum-derived ports

**Ad hoc infra ticket — not sourced from a milestone doc.** Filed for posterity after the fact, following an interactive session with Alex (2026-08-09) triggered by this design's fourth confirmed real incident. See `Docs/tickets/EXECUTOR_ROUTINE.md`'s own "Runners" framing and `AGENTS.md` § "Session isolation" for the worktree convention this redesign lives inside; no `MILESTONES_V1_*_MCP.md` entry exists or was created for this ticket.

Milestone ref: none (ad hoc infra)

Complexity tier: L

Strategy-gate flag: no

Priority: P0

Branch: chore/m-pipeline/t-154-worktree-env-provisioning-redesign

Context files (loaded during the session):
  - scripts/worktree-postgres-env.sh (deleted by this ticket)
  - docker-compose.yml
  - .claude/hooks/session-start.sh
  - scripts/test-db-names.sh
  - scripts/db-readiness.sh
  - scripts/reap-worktree.sh
  - packages/core/src/db/test-db-url.ts
  - packages/core/src/db/test-db-url.test.ts
  - .claude/rules/db.md, .claude/rules/backend.md

## Relevant background

Confirmed recurring incidents, all the same shape — a session that ran a tool directly instead of through `session-start.sh`/`worktree-postgres-env.sh` got `QUESTLOG_PG_PORT` silently unset, and `test-db-url.ts`'s `resolvePort()` defaulted to `:5433`, a real but wrong-worktree's Postgres instance: `T-072` (introduced the per-worktree-container design), `T-064`, `T-092` (both discovered a missing/unmigrated `questlog_test_observability` mid-session), most recently `T-109` (this exact bug, hit live during that ticket's own `ingest-db.test.ts` work). Alex: "this environment script is fucked... hacked and patched by a dozen agents telling me each time 'we are one fix away'."

Mockup: none

Runner: claude-code

Model: sonnet

Scope: Replace the per-worktree Postgres container (dedicated `docker compose` project on a checksum-derived port, `scripts/worktree-postgres-env.sh`) with one shared, long-lived Postgres instance (`docker-compose.yml` pinned to `name: questlog`, fixed port `5433`) and worktree-suffixed database names instead. `packages/core/src/db/test-db-url.ts` gains `resolveWorktreeDbSuffix()`, deriving the suffix from the calling process's own `process.cwd()` (matching the `.../tmp/worktrees/<name>/...` path segment) rather than any environment variable — this is the actual fix, not a restatement of the old one: no shell has to remember to export anything for isolation to hold. `scripts/test-db-names.sh` gains a bash-mirrored `worktree_db_suffix()` (identical marker/slice/sanitize/truncate logic, can't literally share code across languages) for the provisioning side. `.claude/hooks/session-start.sh`'s local branch, `scripts/db-readiness.sh` (glob-matched dbname dispatch instead of exact-match), and `scripts/reap-worktree.sh` (drops suffixed databases instead of tearing down a container) all updated accordingly. `scripts/worktree-postgres-env.sh` deleted.

Out of scope: The interactive-dev database (`questlog`, docker-compose's `POSTGRES_DB`) — untouched, was never part of worktree isolation (targets a separately-managed instance, independent of any worktree, per `README.md`'s own setup flow). A general secrets-management system beyond `T-131`'s `.env`-copy mechanism (folded into this same session — see its own ticket/report). Wiring a genuinely runner-neutral `session-start.sh` bootstrap for a non-Claude-Code runner (`T-138`'s own scope, closed won't-fix as a direct consequence of this ticket — see its `## Resolution` section).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - the exact `T-109` reproduction (a `vitest run` invoked directly against a real worktree, environment fully stripped via `env -i`, no `session-start.sh`/env-export script ever sourced) resolves and passes against the correct worktree-suffixed database
  - two concurrent worktrees' test databases coexist on the one shared instance without collision (verified: `questlog_test_core__env_redesign` vs. worktree-suffixed names from other live worktrees, distinct rows in `pg_database`)
  - `T-131`'s own exit condition (sentinel-line propagation round-trip) passes against the redesigned `session-start.sh`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: IMPLEMENTATION_NOTES.md updated (no milestone checkbox — none exists for ad hoc infra work), a CHANGELOG.md entry under [Unreleased], morning report written.
