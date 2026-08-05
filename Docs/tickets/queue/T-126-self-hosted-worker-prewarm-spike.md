# T-126 — Spike: self-hosted Managed Agents worker with pre-built session image

**Mixed autonomy.** The repo-side work below (image build script, spawn
script, worker-config docs) is normal nightly-eligible work. Actually
standing up a real self-hosted environment (Console/API), generating an
environment key, and running the worker against a live host is
Alex-only — same category as T-125's base-image "wiring in" step and the
real-credential steps in `Docs/DEPLOY_SETUP_CHECKLIST.md`. Write the exact
commands and verification steps for Alex to run; do not attempt to create
an environment, generate a key, or run a live worker; do not fabricate
having verified live pickup/latency numbers.

Milestone ref: Docs/milestones/MILESTONES_V1_2_MCP.md M-EFFICIENCY.14

Complexity tier: M

Strategy-gate flag: yes

Priority: P0

Branch: feat/m-efficiency/t-126-self-hosted-worker-prewarm-spike

Context files (load ONLY these):
  - infra/README.md (if present — T-125's original base-image writeup, before G-034's removal; check git history at `infra/session-bootstrap.Dockerfile`'s last commit before removal for the Dockerfile content to adapt)
  - .claude/hooks/session-start.sh (the remote-sandbox branch, lines ~85-291 — the bootstrap cost this spike is trying to move to image-build time instead of session-start time)
  - Docs/tickets/gated/resolved/G-034-ccr-base-image-configuration-mechanism.md (confirms the *current* CCR cloud-environment surface has no image/persistence lever — the reason this ticket targets a different environment type instead)
  - Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md (this ticket's own originating decision and rationale)
  - Docs/tickets/done/T-125-session-bootstrap-speed.md and Docs/tickets/reports/T-125-session-bootstrap-speed.md (the from-source pgvector build this spike's image should also bake in, including the `OPTFLAGS=""` fix for the `-march=native` segfault)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md` § Resolution, as of 2026-08-05

Resolved interactively with Alex. Anthropic's Managed Agents API exposes a
`self_hosted` environment type (`platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes`),
distinct from the `type: cloud` scheduled-routine surface G-034 examined.
Under `self_hosted`, Alex runs a worker process (the `ant` CLI or an SDK
worker) on infrastructure he owns; the worker polls Anthropic's queue and,
per claimed session, spawns a container from a custom image (`docker run
--rm ... your-image`, per the docs' own `spawn.sh` pattern). This
eliminates the cold-start cost by moving the expensive work (pgvector
build, warm pnpm store) to image-build time instead of session-start
time — it doesn't need a "pool of N idle sandboxes" the way Coder/Daytona's
prebuild features do, since a `docker run` from an already-built image is
already fast. Alex chose to spike this end-to-end on a throwaway host
before committing to migrating every real session off the current CCR
surface, given the new maintenance burden (an always-on host, its own
security/egress posture) this trades away from the current
zero-maintenance managed surface.

Mockup: none

Model: sonnet

Scope: Prove the self-hosted-worker + custom-image mechanism works end to end, repo-side pieces first:

1. **Build script.** Add `infra/session-bootstrap.Dockerfile` (recreated, not just restored — extend it to also bake in a warm pnpm store / `node_modules` for this repo, not just `postgresql-16-pgvector`, since a self-hosted worker's `docker run` per session is the moment this ticket is trying to make fast). Base it on `.claude/hooks/session-start.sh`'s existing from-source pgvector build (pinned `0.8.5`, `OPTFLAGS=""` — T-125/G-034) so the two don't drift into two different pgvector provisioning strategies for the same repo.
2. **Worker artifacts.** Add `infra/self-hosted-worker/spawn.sh` (adapted from the Managed Agents self-hosted-sandboxes doc's own example: `docker run --rm -e ANTHROPIC_SESSION_ID -e ANTHROPIC_ENVIRONMENT_KEY -e ANTHROPIC_WORK_ID -e ANTHROPIC_ENVIRONMENT_ID -e ANTHROPIC_BASE_URL -v ... your-image`) and `infra/self-hosted-worker/README.md` documenting: the exact `ant beta:environments create --config '{"type":"self_hosted"}'` command, environment-key generation (Console-only, Alex-only step), how to run `ant beta:worker poll --on-work ./spawn.sh`, and how to verify pickup with `ant beta:environments:work stats --environment-id ...`.
3. **Local build verification.** Build the image locally (this machine's Docker, same as T-125's own verification — the constrained executor sandbox can't reach Docker Hub/apt.postgresql.org per `EXECUTOR_ROUTINE.md`'s known constraint) and confirm `postgresql-16-pgvector` importable via `dpkg -s`, and that a `pnpm install` inside a container built from the image completes fast (near-instant, warm store) versus a cold one.

Out of scope: Actually creating the self-hosted environment or generating an environment key (Alex-only, Console access required). Actually running the worker against a live host or measuring real session-pickup latency (Alex-only — write the manual verification plan instead, per the "deferred exit condition" pattern). Migrating any real interactive/executor session to the new environment — this ticket is a spike, not the migration; a follow-up ticket handles that only if the spike's manual verification (run by Alex) confirms it's worth it. Any change to `.claude/hooks/session-start.sh` itself — this ticket adds a parallel path, it doesn't touch the existing CCR-surface hook.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `docker build -f infra/session-bootstrap.Dockerfile -t questlog-session-bootstrap:t-126-verify .` succeeds locally; `docker run --rm questlog-session-bootstrap:t-126-verify dpkg -s postgresql-16-pgvector` reports `Status: install ok installed`, version `0.8.5`
  - a `pnpm install` run inside a container built `FROM` that image (repo copied in, warm pnpm store baked at build time) completes measurably faster than a cold `pnpm install` in an unmodified base image — both timed, both pasted into the report
  - `bash -n infra/self-hosted-worker/spawn.sh` syntax-checks clean
  - **Deferred (Alex-only, documented not executed):** the report includes a numbered manual verification plan — the exact commands to create the environment, generate the key, start the worker, start a real session against it, and confirm via `ant beta:environments:work stats` that `workers_polling >= 1` and the session completes using the pre-built image — since none of this is invocable from within this ticket's own execution context (no Console access, no environment key)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
