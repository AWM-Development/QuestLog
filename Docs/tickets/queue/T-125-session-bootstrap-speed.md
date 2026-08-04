# T-125 — Cut session bootstrap wall-clock: base image, warm caches, fast-path migrate check

**Mixed autonomy.** The repo-side work below (build script/Dockerfile, the
`session-start.sh` fast-path check, the pnpm-store write-up) is normal
nightly-eligible work. Actually pointing the Claude Code Remote environment
at the resulting custom base image is an environment-configuration change
outside this repo's control (same category as the real-credential/Alex-only
steps in `Docs/DEPLOY_SETUP_CHECKLIST.md`) — write it up as an explicit
to-do with the exact image tag/build instructions, do not attempt to change
any environment settings, and do not fabricate having verified the image
actually got wired in.

Milestone ref: M-EFFICIENCY.13

Complexity tier: M

Strategy-gate flag: no

Priority: P0

Branch: feat/m-efficiency/t-125-session-bootstrap-speed

Context files (load ONLY these):
  - .claude/hooks/session-start.sh (the whole hook — this ticket touches its remote-sandbox branch, lines ~85-253)
  - scripts/test-db-names.sh (TEST_DB_NAMES / TEST_DB_NAMES_CI arrays the hook loops over)
  - packages/core/src/db/migrate.ts (REQUIRED_EXTENSIONS source of truth the hook's verification gate already parses)
  - Docs/IMPLEMENTATION_NOTES.md (§ T-072 "Per-worktree Postgres instance", § T-098 "Remote-sandbox DB bootstrap hardening" — both sections' rationale is load-bearing for why the hook is shaped the way it is)

Mockup: none

Model: sonnet

Scope: Reduce the remote-sandbox branch of `.claude/hooks/session-start.sh`'s fixed per-session cost, in priority order:

1. **Primary — custom base image.** Write a Dockerfile (or equivalent build script) under a new `infra/` or `.claude/` location that produces a base image with `postgresql-16-pgvector` pre-installed via the PGDG channel (matching the hook's own existing version preference at session-start.sh:129-152, i.e. PGDG's 0.8.x over Ubuntu's pinned 0.6.0), plus any other apt deps the remote-sandbox branch installs. Document (in the ticket's report and/or a short `infra/README.md`) the exact build command and the image tag/reference Alex needs to point the CCR environment's base-image setting at. No changes to `session-start.sh`'s own logic are required for this part — its existing `dpkg -s postgresql-16-pgvector` check (session-start.sh:129) already skips the apt-get block when the package is already present; a warm base image makes that check pass for free.
2. **Verify and document pnpm warm-cache behavior.** Confirm (with evidence — timing output from a real session, or reasoning from pnpm's store mechanics) why `pnpm install` already completes in ~8s on a fresh session per observed session logs, and whether that depends on the base image carrying a warm pnpm store/`node_modules`. Write the finding into the ticket's report as a named background fact, with a one-line regression note (e.g. in `infra/README.md` alongside the Dockerfile) warning that a future base-image change could silently reintroduce a cold install if it doesn't also carry pnpm's store forward.
3. **Fast-path the `db:migrate` loop.** Before the per-package `db:migrate` loop at session-start.sh:188-196, add a lightweight pre-check that runs the same criteria the verification gate at session-start.sh:198-244 already checks (all `TEST_DB_NAMES` exist, required extensions present, `drizzle.__drizzle_migrations` non-empty) and skips invoking each package's migrate script (logging why) when every database already satisfies them. Fall through to the existing per-package loop unchanged when any database doesn't yet satisfy the criteria — first-run/genuinely-unmigrated behavior must be unaffected.

Out of scope: Any change to the local (non-remote) branch of `session-start.sh` (lines 1-83) — Docker Compose's own provisioning is not part of this ticket. Any change to CI's own DB provisioning (`ci.yml`) — this ticket is about interactive/executor session bootstrap only. Actually configuring the CCR environment to use the new base image (see Mixed-autonomy banner above) — write the to-do, don't attempt it. Any change to the develop-sync or develop-ff guard blocks (session-start.sh:9-49).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `session-start.sh`'s existing remote-sandbox tests/dry-run path (if one exists) or a manual invocation against a database that already satisfies the verification gate's criteria shows the `db:migrate` loop's per-package calls skipped, with a logged reason, and total loop wall-clock measurably lower than before
  - the same invocation against a database missing at least one required migration still runs the full per-package `db:migrate` loop and ends in a passing verification gate, proving the fast-path never masks a genuinely unmigrated database
  - a Dockerfile/build script exists under the new `infra/` location, builds successfully, and the resulting image has `postgresql-16-pgvector` installed and importable via `dpkg -s postgresql-16-pgvector`

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
