# T-072 — Per-worktree Postgres instance for concurrent local test runs

Milestone ref: M-PIPELINE.4 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Priority: P1

Blocked on: T-069 — must be merged into develop first

Branch: chore/m-pipeline/t-072-per-worktree-postgres-instance

Context files (load ONLY these):
  - docker-compose.yml (local dev's single Postgres service — gains a per-worktree port override)
  - packages/core/src/db/test-db-url.ts (`testDbUrl()`, `PORT` constant — the single point every DB-touching config/script calls through)
  - .claude/hooks/session-start.sh (provisions/migrates test databases at session start today; needs to target the session's own worktree instance)
  - Docs/IMPLEMENTATION_NOTES.md § the worktree convention T-069 records (path layout, naming, creation/entry — this ticket follows it, does not redesign it) and the new G-008 pointer note
  - Docs/tickets/gated/resolved/G-008-test-database-topology-uniform-vs-hybrid.md (the resolution and full rationale this ticket implements — second axis)
  - Docs/tickets/queue/T-071-uniform-per-package-test-databases.md, if merged by the time this runs (the per-package database *names* this ticket must not rename — see Out of scope)
  - .env.example (`DATABASE_URL`'s hardcoded `:5433` — the literal this ticket's port override must not silently diverge from)

Mockup: none

Model: sonnet

Scope: Give each git worktree (per `T-069`'s worktree-per-ticket convention) its own Postgres instance on its own port, so concurrent agents in separate worktrees can never truncate or migrate each other's test data — without inventing a per-database create/migrate/reap lifecycle.

1. **Derive a per-worktree Postgres port** from the worktree's identity (e.g. a hash or index of the worktree path/ticket id, offset from a base port) rather than a single hardcoded `5433`. `packages/core/src/db/test-db-url.ts`'s `PORT` constant is the one place this needs to change conceptually — read it from an env var with `5433` as the fallback default, so every call site that already goes through `testDbUrl()` picks up the override automatically with no per-call-site edit.
2. **Run a separate `docker compose` stack per worktree**, parameterized by that same port (Compose's `-p <project-name>` / port-mapping override, or an equivalent per-worktree override file — implementation's call which mechanism, but it must not require hand-editing `docker-compose.yml` per worktree). Database *names* stay exactly as `T-071` leaves them (`questlog_test`, `questlog_test_core`, `questlog_test_mcp`, etc., regardless of `T-071`'s merge state when this ticket runs) — only the port/instance differs per worktree, never the name.
3. **Update `.claude/hooks/session-start.sh`** to provision and migrate against the session's own worktree-scoped instance instead of the fixed default port.
4. **Document the reaping story**: a finished worktree's test data is discarded by tearing down its `docker compose` stack (`docker compose -p <worktree-project> down -v` or equivalent) — tie this to whatever worktree-removal step `T-069`/`T-070` establish, so a removed worktree doesn't silently leave an orphaned Postgres container running. If no such removal step exists yet by the time this ticket runs, note that gap in the report rather than inventing worktree-lifecycle management here.

Out of scope:
  - Any change to database *names* — `T-071` (or the pre-existing `questlog_test`/`questlog_test_mcp` split if `T-071` hasn't merged yet) owns naming. This ticket only ever changes which port/instance those names resolve against.
  - CI. GitHub Actions gives every run its own isolated Postgres service container by construction and has no cross-agent collision — `ci.yml` and `e2e-release-check.yml` are untouched.
  - Redesigning `T-069`'s worktree path/naming convention. This ticket consumes it as given; if it turns out to be insufficient for deriving a stable port, report that rather than changing it unilaterally.
  - Automated worktree reaping/garbage collection as its own system — covered only to the extent of tying Postgres teardown to whatever removal step already exists.
  - The primary working directory's own Postgres instance/port — it keeps `5433` as the default fallback, unchanged for anyone not using a worktree.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - two worktrees created per `T-069`'s convention, each running `pnpm test` concurrently, resolve to two distinct Postgres ports/instances — confirmed by connecting to each directly and asserting the other worktree's fixture data is absent, not by inspection alone
  - the primary working directory (no worktree override set) still connects on `:5433` with no config change required — demonstrates the fallback default is preserved
  - `.claude/hooks/session-start.sh` provisions and migrates the session's own worktree-scoped instance, confirmed by running it inside a worktree and checking the resulting `DATABASE_URL`'s port matches that worktree's derived value
  - the report documents the exact reaping command/step for a finished worktree's Postgres stack, and states plainly whether it is already wired to an existing worktree-removal step or still a manual/undone gap

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
