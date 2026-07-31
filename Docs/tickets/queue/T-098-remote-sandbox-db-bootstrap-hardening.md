# T-098 — Remote-sandbox DB bootstrap: self-heal, verify loudly, close the pgvector version gap

Milestone ref: none — surfaced by `/morning-review` on T-056 (PR #143), resolved via G-018

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Branch: chore/m-pipeline/t-098-remote-sandbox-db-bootstrap-hardening

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (lines 77-160 — the remote-only native-Postgres bootstrap this ticket hardens; note `set -euo pipefail` on line 3, the reason a failed step currently kills the script silently mid-provision)
  - scripts/test-db-names.sh (`TEST_DB_NAMES` — the databases the verification gate must confirm)
  - packages/core/src/db/migrate.ts (the `REQUIRED_EXTENSIONS` list + `CREATE EXTENSION` loop — single source of truth for which extensions must exist; the verification gate reads this list rather than hand-copying it)
  - Docs/tickets/gated/resolved/G-018-remote-sandbox-db-provisioning-strategy.md (the decision this ticket implements, including why Neon was rejected)
  - Docs/tickets/reports/T-056-mcp-update-entity-tool.md ("Efficiency notes" — the dpkg/`ca-certificates-java` interruption and its literal error output)

Mockup: none

Model: sonnet

Scope: Four changes to `.claude/hooks/session-start.sh`'s remote-only branch
  (the block after the `CLAUDE_CODE_REMOTE` check). This ticket does not
  touch the local-dev branch, `docker-compose.yml`, or any CI workflow.

1. **Self-heal an interrupted dpkg state before installing.** Immediately
   before the `apt-get update`/`apt-get install postgresql-16-pgvector`
   pair, run `dpkg --configure -a` tolerantly (`|| true` — a healthy system
   is a no-op, and its failure must never be what kills provisioning).
   This is deliberately package-agnostic: the observed interruption was
   `ca-certificates-java` from the sandbox's own boot-time proxy-CA
   provisioning, not anything QuestLog installs, so the fix must clear
   *whatever* package is left mid-configure, not that one by name.

2. **Close the pgvector version gap, best-effort, and always report it.**
   Ubuntu's `postgresql-16-pgvector` is pinned at 0.6.0, three minors
   behind the 0.8.0 that `hnsw.iterative_scan` needs (T-016's
   campaign-filtered ANN recall cliff — see `Docs/IMPLEMENTATION_NOTES.md`
   § T-016). Attempt the install from the PGDG apt repo
   (`apt.postgresql.org`, which ships 0.8.x) first; on any failure —
   including the egress proxy refusing that host, which is a live
   possibility given the launchpad PPAs already 403 in this sandbox — fall
   back to the Ubuntu package rather than failing the run. Either way,
   print the resolved extension version once provisioning completes
   (`SELECT extversion FROM pg_extension WHERE extname='vector'`), so
   which one a given session actually got is never a mystery.

3. **A verification gate, so no failure is ever silent again.** After the
   migrate loop, verify the end state and fail loudly with a precise,
   actionable diagnostic if any check fails:
   - a connection to `localhost:$PGPORT` succeeds;
   - every extension named in `packages/core/src/db/migrate.ts`'s
     `REQUIRED_EXTENSIONS` is present (read that list — do not hand-copy it);
   - every database in `TEST_DB_NAMES` exists and has at least one
     applied migration (i.e. the drizzle journal table is present and
     non-empty), not merely that `CREATE DATABASE` returned success.
   On failure, print a block naming which specific check failed, the
   command that produced it, and its stderr — then exit non-zero. On
   success, print a one-line green summary including the pgvector version
   from (2). **This is the ticket's most important deliverable:** the
   recurring cost of this subsystem has never been that the sandbox breaks
   (that box isn't ours to control), it's that breakage has been silent and
   only surfaced 20+ turns later as unexplained test failures.

4. **Delete, don't accumulate.** Any code this ticket supersedes comes out
   entirely — no commented-out blocks, no dead flags, no
   `if false` paths left "just in case." The remote branch should be
   shorter and flatter after this ticket than before it, not longer.

Out of scope:
  - Switching remote-sandbox provisioning to a hosted database (Neon or
    otherwise) — explicitly rejected in G-018's resolution. Do not
    reintroduce it, and do not add any code path that lets a hosted
    `DATABASE_URL` reach the test suite.
  - Any change to `apps/server/src/db/test-db-url.ts`'s
    `assertLocalDatabaseUrl()` guard (T-025). It stays exactly as strict as
    it is today — this ticket keeps the sandbox on local Postgres precisely
    so that guard never needs an exception.
  - The local-dev branch of `session-start.sh`, `docker-compose.yml`,
    `scripts/worktree-postgres-env.sh`, and `scripts/reap-worktree.sh` —
    the local per-worktree Docker path works and is not what has been
    failing. Three provisioning mechanisms (CI service containers, local
    Docker, remote native apt) coexist deliberately: each answers a
    different constraint, and collapsing them would cost offline local dev.
  - Rewriting historical `Docs/IMPLEMENTATION_NOTES.md` entries that
    describe the *old* behavior (T-016's 0.6.0 finding, T-023/T-024's
    Docker notes, T-025's provisioning description). Those are an
    append-only record of what was true when each ticket ran, not live
    documentation — add a new § T-098 entry instead of editing them.
  - Any attempt to fix the sandbox's Docker daemon (confirmed during T-056
    to be a container-runtime capability gap, not a config problem) — the
    remote path is native Postgres and never invokes Docker.
  - Retrying/backoff logic beyond a single apt retry — this is a session-start
    hook, not a distributed system.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `grep -c 'dpkg --configure -a' .claude/hooks/session-start.sh` returns ≥1,
    and that call appears *before* the first `apt-get install` in file order
  - the verification gate is proven to actually fail: with a deliberately
    broken precondition (e.g. run the gate against a `PGPORT` with nothing
    listening, or a database name absent from the cluster), the hook exits
    non-zero and prints a diagnostic naming the specific failed check —
    paste the real output in the report, not a description of it
  - the verification gate passes on a healthy run, printing the resolved
    pgvector version — paste that real output too
  - the extension list in the gate is read from
    `packages/core/src/db/migrate.ts`'s `REQUIRED_EXTENSIONS` rather than
    duplicated: `grep -c "pg_trgm" .claude/hooks/session-start.sh` returns 0
  - `bash -n .claude/hooks/session-start.sh` parses clean, and the remote
    branch's line count is not greater than before the ticket (deletion, not
    accretion — report both numbers)
  - no occurrence of `neon` (case-insensitive) anywhere in
    `.claude/hooks/session-start.sh`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in `Docs/milestones/MILESTONES_V1_1_MCP.md` (none currently references this — skip if no line exists), `IMPLEMENTATION_NOTES.md` updated with a new § T-098 entry, a `CHANGELOG.md` entry under `[Unreleased]`, morning report written.

## Note on verification (read before starting)

This hook's remote branch **cannot be fully exercised from a local session** —
it only runs when `CLAUDE_CODE_REMOTE=true`. Verify as much as possible by
invoking the block directly with that variable set, and be explicit in the
report about which exit conditions were proven live versus reasoned about.
The genuine end-to-end proof is the *next* remote executor run's session-start
output showing the green verification summary; the report should say so plainly
rather than implying local verification settled it.
