# T-002 — Preview/confirm/audit plumbing for MCP writes

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — infrastructure seam ("preview-confirm plumbing") ahead of `log_session`'s write path (T-003) and embed+consolidate (T-004)

Branch: feat/m-mcp/write-request-plumbing

Context files (load ONLY these):
  - Docs/MILESTONES_V1_MCP.md — M-MCP.3 section
  - .claude/rules/mcp.md — "`log_session` — preview/confirm/audit is mandatory" section
  - .claude/rules/backend.md
  - .claude/rules/db.md (migration workflow — journal only, never `drizzle-kit push`)
  - apps/server/src/db/schema/tables.ts
  - apps/server/src/db/schema/index.ts
  - apps/server/src/db/index.ts (`Database` type)
  - apps/server/src/db/test-helpers.ts
  - apps/server/src/lib/errors.ts
  - apps/server/src/services/campaign.service.test.ts (test-DB pattern reference: `createTestDb()`, BEGIN/ROLLBACK)
  - apps/server/src/db/migrations/meta/_journal.json (see current tail entry only, to confirm next migration index)

Mockup: none

Model: sonnet

Scope:
  This ticket builds the *generic* mechanism that later tickets wire specific
  writes into. It has no knowledge of sessions or entities.

  1. New table `write_requests` in `apps/server/src/db/schema/tables.ts`:
     `id` (uuid pk, default random — this IS the confirmation token),
     `campaignId` (uuid, references campaigns),
     `toolName` (text, e.g. `"log_session"`),
     `payload` (jsonb — the preview description, opaque to this table),
     `appliedResult` (jsonb, nullable — filled on confirm),
     `createdAt`, `expiresAt` (timestamp, e.g. `createdAt + 15 minutes`),
     `confirmedAt` (timestamp, nullable).
     Generate the migration with `drizzle-kit generate` (per `.claude/rules/db.md`)
     — do not hand-write SQL or use `drizzle-kit push`.
  2. `apps/server/src/services/write-request.service.ts`:
     - `createPreview(db, { campaignId, toolName, payload, ttlMs? })` → inserts
       a row (`expiresAt = now + ttlMs`, default 15 min), returns
       `{ token, payload, expiresAt }`.
     - `getPending(db, token)` → returns the row's `payload` if it exists,
       is unconfirmed, and unexpired; throws `NotFoundError` otherwise (expired
       or already-confirmed both count as not-found — a confirm token is
       single-use).
     - `confirm(db, token, applyFn: (db, payload) => Promise<unknown>)` → looks
       up the pending row (same rules as `getPending`), runs `applyFn` inside
       `db.transaction()`, stores its return value in `appliedResult`, sets
       `confirmedAt = now()`, and returns the applied result. If `applyFn`
       throws, the transaction rolls back and the row is left unconfirmed
       (so a caller can retry against the same token, as long as it hasn't
       expired).
  3. Rows with `confirmedAt` set double as the audit log (what changed —
     `payload`/`appliedResult`, when — `confirmedAt`, which tool — `toolName`).
     No separate audit table.

Out of scope:
  - No `log_session`-specific logic, no session/entity schema changes — that's
    T-003 and T-004. This ticket's tests use a fake `toolName`/payload/applyFn.
  - No MCP tool wiring in `apps/mcp` — this is a server-side service only,
    consumed by later tickets.
  - No cron/scheduled cleanup of expired rows — out of scope for v1; expired
    rows are simply inert (filtered out by `getPending`/`confirm`).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - `createPreview` followed immediately by `confirm` with a fake `applyFn`
    calls `applyFn` exactly once and returns its result; the fake `applyFn`
    is NOT called at `createPreview` time (assert a call counter is still 0
    right after `createPreview`)
  - calling `confirm` twice with the same token: the second call throws
    `NotFoundError` and `applyFn` is not called a second time
  - calling `confirm` with an unknown token throws `NotFoundError` without
    calling `applyFn`
  - a row whose `expiresAt` is in the past is treated as not-found by both
    `getPending` and `confirm` (test by inserting an already-expired row
    directly, not by waiting out a real TTL)
  - if `applyFn` throws, the row remains unconfirmed (`confirmedAt` still
    null) after the failed `confirm` call

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable here (M-MCP.3 stays unchecked until T-003 and T-004 also ship —
  note this explicitly in the morning report so it isn't flipped early),
  IMPLEMENTATION_NOTES.md updated with the `write_requests` table's role,
  morning report written.
