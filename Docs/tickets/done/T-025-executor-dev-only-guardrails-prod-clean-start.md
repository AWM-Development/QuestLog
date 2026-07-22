# T-025 — Routine-agent dev-only guardrails and a clean production start

Milestone ref: M-MCP.5 (`Docs/MILESTONES_V1_MCP.md`)

Branch: feat/m-mcp/t-025-executor-dev-only-guardrails-prod-clean-start

Context files (load ONLY these):
  - Docs/tickets/EXECUTOR_ROUTINE.md (what the nightly executor actually
    runs, and what connection it uses today)
  - apps/server/src/db/migrate.ts, apps/server/src/db/test-helpers.ts
    (where `DATABASE_URL` actually gets read/used)
  - .env.example
  - Whatever T-024 actually produced for env separation (deploy workflow,
    env var templates, `Docs/DEPLOY_SETUP_CHECKLIST.md`) — read T-024's
    real diff, don't assume its shape in advance
  - .claude/rules/db.md — Test database section

Mockup: none

Model: sonnet

Scope:
  Once T-024 stands up dev and prod as genuinely distinct environments
  (distinct databases, distinct connection strings, distinct — per T-024's
  secrets-management gate resolution — credentials), two things must be
  true before Alex actually relies on this for a real campaign:

  1. **Routine/automated agents (the nightly ticket executor, and anything
     else that runs unattended per `EXECUTOR_ROUTINE.md`) can only ever
     reach the dev environment, never prod.** Concretely: confirm/enforce
     that nothing in the nightly executor's runtime environment has prod
     credentials in scope at all (the strongest guarantee — no credential,
     no accidental use — is preferred over a runtime check that merely
     detects and refuses a prod-shaped `DATABASE_URL`, though add the
     runtime check too as defense in depth if the credential-scoping
     alone can't be fully verified from this repo). Document exactly
     where this is enforced (secrets scoping in the executor's actual
     runtime config — read `EXECUTOR_ROUTINE.md`'s own environment
     assumptions — vs. an in-repo check) so it's auditable later, not
     just asserted.
  2. **Production starts from a clean database** — schema from migrations
     only, zero dev/test/seed rows, before Alex's first real campaign data
     goes in. Verify this directly against whatever prod database T-024
     actually provisioned (query it, don't assume); if T-024's setup
     already guarantees a migration-only bootstrap, this step is a
     confirmation, not new work — say which it turned out to be.

  If either check surfaces a real gap (e.g. the executor's environment
  does have prod credentials available, or the provisioned prod DB
  already has stray rows from setup/testing), fix it as part of this
  ticket rather than only reporting it — this is exactly the kind of
  finding this ticket exists to catch before real campaign data is at
  risk.

Out of scope:
  - No re-litigating T-024's hosting/secrets-management decisions — this
    ticket verifies and hardens the boundary between dev and prod access,
    it doesn't redesign how either environment is provisioned.
  - No application-code changes beyond what's needed for the runtime
    prod-connection-string guard (if added as defense in depth).
  - No monitoring/alerting for future accidental-prod-access attempts —
    a build-time/runtime guard is in scope, ongoing alerting is not.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a
    summary
  - documented, auditable answer (in `IMPLEMENTATION_NOTES.md`) to "does
    the nightly executor's runtime environment have prod credentials in
    scope, and how was that confirmed" — not asserted, shown (e.g. the
    actual secrets/env configuration inspected, quoted or referenced)
  - if a runtime guard was added: a test demonstrating it refuses a
    prod-shaped connection string and passes a dev-shaped one
  - a direct query against the provisioned prod database (pasted output,
    not described) showing zero rows in every application table except
    what migrations themselves create
  - any real gap found (per Scope above) has a corresponding fix in this
    ticket's diff, not just a note

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flip in MILESTONES_V1_MCP.md is NOT
  applicable (M-MCP.5's overall checkbox flips only once this, T-023, and
  T-024 are all done and Alex confirms prod is live), IMPLEMENTATION_NOTES.md
  updated with the dev/prod access-boundary findings, a CHANGELOG.md entry
  under [Unreleased] only if application code changed, morning report
  written.
