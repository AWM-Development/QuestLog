# T-059 — Observability store: comment schema + write endpoint

Milestone ref: M-OBS.5

Complexity tier: M

Priority: P0


Branch: feat/m-obs/t-059-observability-comment-schema-endpoint

Context files (load ONLY these):
  - Docs/tickets/queue/T-053-observability-store-schema-ingestion.md (the
    schema/package conventions this ticket extends — `ticket_runs`/
    `ticket_reports` shape, drizzle config pattern, local-Postgres
    fallback)
  - Docs/tickets/backlog/T-054-observability-api-read-endpoints.md
    (reference for this codebase's thin-router-delegates-to-service tRPC
    convention — this ticket follows the same pattern for its own,
    separate router)
  - Docs/mockups/observability-dashboard/log.html (the comment-thread UI
    shape this endpoint serves — author chip, timestamp, body, per entry)

Mockup: none (backend-only; the UI this feeds is Docs/mockups/observability-dashboard/log.html, built by T-058)

Model: sonnet

Scope: Add comment capability to `packages/observability` (T-053's
  package), Alex-authored only for v1 (see Out of scope):
  - Drizzle schema addition (`packages/observability/src/schema/tables.ts`):
    `ticket_comments` — `id`, `ticket_id` (references the `ticket_runs`/
    `ticket_reports` entry it's attached to), `author` (text — `"alex"`
    for every row in this ticket's scope, but modeled as free text rather
    than a fixed enum so a future agent-identity value doesn't require a
    schema migration), `body` (text), `created_at` (timestamp, default
    now). Append-only — no `updated_at`/edit tracking needed for v1.
  - A new tRPC router (`packages/server`'s existing router-registration
    convention, thin router delegating to a service function) exposing:
    - `list(ticketId)` — comments for a given ticket, oldest first.
    - `add(ticketId, body)` — inserts a new comment with `author: "alex"`
      hardcoded server-side for v1 (no auth/identity system exists to
      derive it from — see Out of scope).
  - Zod validators in `packages/shared/src/validators/` for both
    procedures' input/output shape.

Out of scope:
  - Any agent-authored comment path — deferred per Alex's decision
    (2026-07-26) to ship Alex-only commenting first. This ticket's
    `author` column is free text specifically so that decision doesn't
    require a schema change later, but no second caller/identity is wired
    up here.
  - Comment editing or deletion.
  - Any UI — T-058 builds the Log-view comment thread against this
    endpoint.
  - Any change to `ticket_runs`/`ticket_reports` (T-053) — this is a new,
    additive table only.
  - Auth/permission checks beyond whatever this server's existing tRPC
    procedures already enforce (there is currently no multi-user auth
    system in this codebase to layer on top of).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - migration applies cleanly against a fresh local Postgres db alongside
    T-053's existing tables
  - `add` followed by `list` for the same `ticket_id` returns the new
    comment with `author: "alex"`, correct `body`, and a `created_at` set
    server-side (not client-supplied)
  - `list` against a `ticket_id` with no comments returns an empty array,
    not an error

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_2_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
