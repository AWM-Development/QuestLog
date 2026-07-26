# T-054 — Observability API read endpoints

Milestone ref: M-OBS.4

Priority: P2

Blocked on: T-053 — must be merged into develop first

Branch: feat/m-obs/t-054-observability-api-read-endpoints

Context files (load ONLY these):
  - packages/observability/src/schema/tables.ts (created by T-053 — the tables this router reads)
  - packages/observability/drizzle.config.ts (created by T-053 — the connection this router uses)
  - apps/server/src/routers/source.ts (reference router for this codebase's tRPC conventions)
  - apps/server/src/routers/_app.ts (where routers are registered)
  - apps/server/src/trpc.ts (procedure/context conventions)
  - packages/shared/src/validators/index.ts (where new Zod validators for this router's I/O belong)

Mockup: none

Model: sonnet

Scope: A read-only tRPC router exposing T-053's observability store, following this codebase's existing router conventions (thin router, Zod-validated input, delegating to a service function — same as `source.ts`):
  - Per-ticket view: given a `ticket_id`, return its `ticket_runs` row joined with its `ticket_reports` row(s).
  - Trends/aggregate view: list `ticket_runs` rows across an optional date range, with filters to exclude `manually_inspected` and/or `empty_run` rows (both default to excluded, overridable).
  - Log/feed view: paginated list of `ticket_reports` rows ordered newest-first, for a browsable "what did the executor do" feed.
  - New Zod validators in `packages/shared/src/validators/` for each endpoint's input and output shape.
  - The router connects to `packages/observability`'s own DB via its own explicit connection (not the existing campaign-data Drizzle client) — a second, separate connection pool, consistent with G-003's separate-store decision.
  - Router is registered in `apps/server/src/routers/_app.ts` but is not surfaced in any UI yet — no dashboard consumes it until M-OBS.5, which is separately gated on G-004.

Out of scope:
  - No PR diff-stat GitHub sync (T-055 — separately ticketed, also blocked on T-053).
  - No UI/dashboard consumption of these endpoints (M-OBS.5).
  - No write endpoints — ingestion stays T-053's CLI/script path; this ticket is read-only.
  - No auth/permissions changes beyond whatever this server's existing tRPC procedures already enforce.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - per-ticket endpoint returns the correct joined `ticket_runs` + `ticket_reports` data for a seeded fixture `ticket_id`, and a defined not-found shape for an unseeded one
  - trends endpoint, given seeded fixtures including one `manually_inspected: true` and one `empty_run: true` row, excludes both by default and includes them when the corresponding filter is explicitly set
  - log/feed endpoint returns seeded `ticket_reports` rows in newest-first order and respects pagination limits against a fixture with more rows than one page

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
