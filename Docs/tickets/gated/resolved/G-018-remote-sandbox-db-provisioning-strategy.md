# G-018 — Stop bootstrapping Postgres from scratch in the remote sandbox — use a Neon branch instead?

Gate type: 🧠 strategy

Milestone ref: none — surfaced by `/morning-review` on T-056 (PR #143), not drafted from a milestone task

Opened: 2026-07-31 — filed by agent during `/morning-review`, at Alex's explicit request to gate this rather than patch it again

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (lines 77-160 — the remote-only branch that apt-installs `postgresql-16-pgvector` and provisions Postgres natively, since Docker isn't available in that sandbox class)
  - Docs/tickets/reports/T-056-mcp-update-entity-tool.md ("Efficiency notes" — the dpkg/`ca-certificates-java` boot-interruption this session hit, and the live-tested finding that the Docker daemon cannot bind its socket in this sandbox class at all)
  - Docs/DEPLOY_READINESS.md (§2 — the resolved decision that production/dev both run on Neon, specifically because it ships pgvector 0.8.0 + pg_trgm 1.6 natively on every plan, no apt/Docker involved)
  - scripts/test-db-names.sh (`TEST_DB_NAMES`/`TEST_DB_NAMES_CI` — what would need databases on whatever host is chosen)
  - scripts/worktree-postgres-env.sh (the per-worktree port-derivation scheme this would replace or coexist with, for local dev only)

Open question: Should the nightly executor's remote-sandbox sessions stop
  provisioning Postgres+pgvector from scratch via apt (the branch of
  `session-start.sh` that keeps failing in new, unrelated ways — Docker
  registry 403, pgvector stuck three minors behind, dpkg boot-interruption,
  now a Docker daemon that can't bind its socket at all) and instead point
  their test databases at an ephemeral Neon branch, the same technology
  already adopted for real dev/prod infra? If yes: how is a branch's
  lifecycle scoped — one branch per remote session (created at
  `session-start.sh` time, torn down on session end/reap) vs. one
  longer-lived shared branch reused across sessions (risking the same
  cross-session collision `T-072` solved for local worktrees) — and does
  local dev / CI keep the existing Docker-compose/apt paths unchanged, or
  does this replace those too?

Blocks: T-098 (`Docs/tickets/queue/T-098-remote-sandbox-db-bootstrap-hardening.md`,
  drafted by this gate's own resolution — see below)

Notes: This is not a code-quality problem with the existing scripts — the
  local-dev/CI-facing tooling (`scripts/test-db-names.sh`'s single-source
  consolidation, the usage-capture stash mechanism's own multi-iteration
  simplify-then-delete history, `scripts/worktree-postgres-env.sh`'s
  narrowly-scoped port derivation) has actually been reasonably maintained
  and self-corrected over time. The specific sick point is the remote-sandbox
  from-scratch bootstrap: every failure there has been a *different* flavor
  of the same structural issue (re-provisioning a full DB server inside an
  ephemeral box whose baseline keeps shifting in ways no repo-side script
  can anticipate), so no amount of further defensive bash converges — each
  fix has been correct for its own symptom and none has stopped new ones
  from appearing. Alex's read: tired of patching this reactively, wants the
  10k-ft structural question resolved today, with P0 ticket(s) drafted for
  same-day execution.

## Resolution (2026-07-31)

**Decision: keep the remote sandbox on local, natively-provisioned Postgres. Harden that path instead of replacing it. Neon is rejected for the sandbox.** Drafted as `T-098` (P0, `queue/`).

### Why not Neon (the option this gate opened to evaluate)

The gate was filed on the premise that swapping the from-scratch apt bootstrap for an ephemeral Neon branch would delete the whole failure category. Working the actual context files turned up two disqualifying facts that the framing had missed:

1. **It collides with a deliberately-hardened safety guard.** `apps/server/src/db/test-db-url.ts`'s `assertLocalDatabaseUrl()` (T-025) refuses to let `createTestDb()`/`global-setup.ts`'s `setup()` — which unconditionally `DELETE`s every application table — run against anything but `localhost`/`127.0.0.1`. Per § T-025, dev and prod Neon branches are *indistinguishable by hostname* (both `*.neon.tech`), which is exactly why that guard's boundary is "local Postgres" vs. "any hosted database at all," and it was proven live (a Neon-shaped host once caused a real hung outbound connection before the guard existed). Pointing sandbox test DBs at Neon means punching a hole in the one guard standing between an unattended nightly executor and irreplaceable campaign lore — a bad trade for a provisioning convenience.
2. **Its reachability was never confirmed.** The sandbox's egress proxy demonstrably 403s some hosts (the launchpad PPAs, observed in T-056). Whether `neon.tech` and Neon's API are reachable from that sandbox class was never tested. Committing a ticket to Neon risked landing on *still broken, plus a weakened guard*.

### Why the failure history is narrower than it first appeared

The four incidents that motivated this gate are not four instances of one converging problem — separating them by which code path they actually hit:

- Docker Hub registry 403 (T-023) and the Docker daemon's inability to bind a socket (found live in T-056) — **irrelevant to this path.** The remote branch provisions natively and never invokes Docker. These were conflated with the Postgres bootstrap when the gate was filed; they are a real sandbox limitation but not one this subsystem touches.
- pgvector pinned at 0.6.0 by Ubuntu's apt package (T-016) — real, latent, and *not* fixed by any dpkg patch. Addressed in T-098 scope item 2 (PGDG repo, best-effort with fallback).
- dpkg interrupted state (T-056) — real, and healed by one package-agnostic `dpkg --configure -a`.

So the genuinely-failing surface is two issues, both narrow, neither requiring a hosted database to solve.

### The reframe that actually resolves this

Alex's stated requirement was certainty that this stops recurring. That certainty is **not available for "the sandbox never breaks"** — the box's baseline is controlled upstream and shifts without notice, so no repo-side script can enumerate its future failure modes (the live egress-proxy risk to the apt archives is a standing example). What *is* available, and is where the real recurring cost has actually been:

`session-start.sh` runs under `set -euo pipefail`, so a failed provisioning step kills the hook mid-script, leaving a half-built database and no signal. Every incident so far has been discovered 20+ turns downstream as unexplained test failures, costing a session of archaeology. **The fix is a verification gate that makes any failure — including ones neither of us has anticipated — announce itself in one line at session start.** That converts an unknown future breakage from expensive-and-mysterious to cheap-and-legible, which is the achievable form of "resolved."

T-098 therefore ships four things, not just the dpkg one-liner: the self-heal, the pgvector version fix, the verification gate (the most important deliverable), and explicit deletion of superseded code — with an exit condition requiring the gate be *proven to fail correctly*, not just to pass.

### Explicitly preserved

Three provisioning mechanisms remain after this (CI service containers, local Docker Compose, remote native apt). This is deliberate, not sprawl: each answers a different constraint — CI has unblocked Docker Hub access, local dev must work offline without a network or Neon round-trip, and the remote sandbox has neither. Collapsing them would cost offline local development.
