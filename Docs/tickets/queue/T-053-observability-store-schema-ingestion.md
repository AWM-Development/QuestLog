# T-053 — Observability store: schema, package, and ingestion

Milestone ref: M-OBS.3

Priority: P1

Branch: feat/m-obs/t-053-observability-store-schema-ingestion

Context files (load ONLY these):
  - Docs/tickets/gated/resolved/G-003-observability-data-storage-location.md (the decision + full expanded field list this schema must plan for)
  - Docs/tickets/queue/T-046-executor-usage-capture-hook.md (the exact `*.usage.json` shape this ingests)
  - Docs/tickets/REPORT_TEMPLATE.md, Docs/tickets/BLOCKED_TEMPLATE.md (report content fields to capture: outcome, reviewer verdict, remediation-pass, blocked-outcome fields)
  - packages/core/src/db/schema/tables.ts (read-only — reference for Drizzle table conventions; do not add tables here)
  - packages/core/src/db/test-db-url.ts (reference for the local/test DB URL fallback convention to mirror)
  - apps/server/drizzle.config.ts (reference for config shape — the new package gets its own, sibling config)
  - packages/core/package.json (reference for package.json shape to mirror for the new package)

Mockup: none

Model: sonnet

Scope: Per G-003's resolution (separate Neon branch, own schema/migrations, packaged to be extractable later — not a full multi-project split yet, but not folded into `packages/core` either), stand up a new workspace package holding the observability store:
  - New package `packages/observability` (own `package.json` mirroring `packages/core`'s dependency shape — `drizzle-orm`, `postgres`, `dotenv` — own `tsconfig.json`, own Vitest config), independent of `packages/core/src/db/schema/tables.ts`.
  - Drizzle schema (`packages/observability/src/schema/tables.ts`):
    - `ticket_runs` — keyed by `ticket_id` (nullable, plus `empty_run: boolean`), every T-046 usage.json field (token counts, `theoretical_cost_usd` intro + standard, `duration_ms`, `turn_count`, `turns_to_green` nullable, `reviewer_subagent` as jsonb, `human_message_count`, `manually_inspected`), plus nullable placeholder columns for fields landing later from other tickets: `complexity_tier`, `strategy_gate_flag`, `total_system_cost`, `cost_vs_human_equivalent` (T-050/T-051), and `files_changed`/`lines_added`/`lines_removed` (a future PR diff-stat sync). This ticket only declares these columns — it does not populate them.
    - `ticket_reports` — keyed by `ticket_id`, `report_type` (`shipped` | `blocked` | `wont_fix`), `reviewer_verdict` (`PASS` | `PASS-WITH-NOTES` | `FAIL`, nullable), `remediation_pass_required: boolean`, raw report content (text), timestamps.
  - `packages/observability/drizzle.config.ts`, sibling to `apps/server`'s, reading a new `OBSERVABILITY_DATABASE_URL` env var with a local-Postgres fallback for dev/test (same local instance as the app DB, different database name, e.g. `questlog_observability`) — mirrors `test-db-url.ts`'s existing fallback pattern so tests never require a real Neon branch.
  - `packages/observability/src/ingest.ts`: a pure function mapping a parsed `*.usage.json` object (T-046's shape) plus optional report markdown content into insertable rows for both tables, plus a thin CLI entry point that reads a given `Docs/tickets/reports/*.usage.json` file and upserts it (idempotent on `ticket_id`).
  - A one-paragraph WHY-comment at the top of `packages/observability/drizzle.config.ts` (matching `apps/server`'s existing comment convention) noting that provisioning the actual Neon branch and setting `OBSERVABILITY_DATABASE_URL` in the deployment environment is a manual step Alex performs once, outside this ticket's automated scope.

Out of scope:
  - No API endpoints (M-OBS.4 — separately ticketed, blocked on this one).
  - No wiring into the executor's `Stop` hook or `EXECUTOR_ROUTINE.md` — this ticket only builds the store and an ingestion function/script; live-pipeline wiring is a follow-up, not silently bundled in here.
  - No actual Neon branch provisioning — that's an infra action outside agent scope; this ticket only wires config to read `OBSERVABILITY_DATABASE_URL`, with the local-Postgres fallback for dev/test.
  - No backfill of historical usage.json/report files.
  - No PR diff-stat GitHub sync (separately ticketed).
  - Do not add these tables to `packages/core/src/db/schema/tables.ts` — recoupling them there is exactly what G-003 decided against.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - migration applies cleanly against a fresh local Postgres db (`questlog_observability`) via drizzle-kit
  - `ingest.ts`'s mapping function, given a fixture `*.usage.json` matching T-046's shape, produces the exact expected `ticket_runs` row (unit test, field-by-field)
  - the same function, given a fixture report markdown with a `**Outcome:**`/reviewer-verdict line, produces the exact expected `ticket_reports` row including correctly parsed `reviewer_verdict`/`remediation_pass_required`
  - the CLI script, run twice against the same fixture usage.json + report pair against a real local test DB, upserts once on the first run and updates (not duplicates) on the second — an idempotency check
  - a fixture with `ticket_id: null, empty_run: true` inserts without violating any constraint

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
