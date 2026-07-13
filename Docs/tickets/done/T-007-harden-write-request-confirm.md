# T-007 — Harden `write_requests` confirm() against concurrent double-apply and caller misuse

Milestone ref: M-MCP.3 (`Docs/MILESTONES_V1_MCP.md`) — hardening follow-up from
T-002's post-merge code review, ahead of T-003/T-004 building callers of
`confirm()`

Branch: feat/m-mcp/t-007-harden-write-request-confirm

Context files (load ONLY these):
  - .claude/rules/mcp.md — "`log_session` — preview/confirm/audit is mandatory" section
  - .claude/rules/backend.md
  - .claude/rules/db.md
  - apps/server/src/services/write-request.service.ts
  - apps/server/src/services/write-request.service.test.ts
  - apps/server/src/db/schema/tables.ts (`writeRequests` table)
  - Docs/IMPLEMENTATION_NOTES.md — the `write_requests` table section

Mockup: none

Model: sonnet

Scope:
  Two related findings from review of T-002 and its follow-up fixes:

  1. `confirm()`'s single-use guarantee is enforced entirely by application
     code — a `SELECT ... FOR UPDATE` inside a transaction — rather than by
     the schema or the type system. `findPendingRow`'s
     `db: Database | Transaction` signature lets a caller pass a bare,
     non-transactional `Database` together with `{ forUpdate: true }`;
     TypeScript does not catch this, and Postgres would run `FOR UPDATE` as
     its own implicit single-statement transaction, releasing the lock
     before any subsequent statement — silently dropping the concurrency
     guarantee. A future write path that copies `confirm()`'s shape but
     forgets the transaction would reopen the exact double-apply race T-002
     closed, with nothing to catch it.
  2. The row lock is currently held for the full duration of the
     caller-supplied `applyFn`. Once T-003/T-004 wire real work into that
     callback (entity linking, chunking/embedding), this holds a
     connection-pool slot and a row lock across external I/O — a risk for
     the shared pool (`apps/server/src/db/index.ts`, default size) under
     concurrent confirmations.

  Redesign `confirm()`'s claim step to be atomic and lock-free, while
  preserving both of today's behavioral guarantees exactly:
    (a) two concurrent `confirm()` calls for the same token never both
        invoke `applyFn` (covered today by `write-request.service.test.ts`'s
        cross-connection concurrency test, built with a dedicated
        multi-connection client — keep this guarantee, don't weaken the test)
    (b) if `applyFn` throws, the token remains valid for a subsequent retry
        (covered today by the existing "leaves the row unconfirmed" test)

  One workable approach (not mandatory — use judgment if a cleaner design
  turns up once you're in the code): claim the row via a single atomic
  conditional `UPDATE` before calling `applyFn` — e.g. a new nullable
  `claimed_at` column, distinct from `confirmed_at`, claimed via
  `UPDATE write_requests SET claimed_at = now() WHERE id = $token AND
  claimed_at IS NULL AND confirmed_at IS NULL AND expires_at > now()
  RETURNING *`, treating zero rows returned as `NotFoundError`. Run
  `applyFn` outside any row lock. On success, set `confirmed_at`; on
  failure, clear `claimed_at` (not `confirmed_at`) so the same token can be
  reclaimed on retry. This removes the need for `SELECT ... FOR UPDATE` and
  the `forUpdate` option on `findPendingRow` entirely.

Out of scope:
  - No change to `createPreview`/`getPending`'s external signatures or
    behavior.
  - No change to the MCP tool layer — nothing is wired into `apps/mcp` yet;
    T-003/T-004 do that.
  - No cleanup/expiry job for stale `claimed_at` rows if that column is
    added — same as `expiresAt`'s existing "just inert" treatment, out of
    scope for v1.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean — pasted output, not a summary
  - the existing cross-connection concurrency test in
    `write-request.service.test.ts` still passes: exactly one of two
    genuinely concurrent `confirm()` calls on the same token succeeds, the
    other throws `NotFoundError`, `applyFn` is called exactly once total
  - the existing "applyFn throws → row stays unconfirmed → retry succeeds"
    test still passes
  - `grep` confirms `forUpdate` and any lock-conditional branch in
    `findPendingRow` (or its replacement) no longer exist anywhere in
    `write-request.service.ts` — the row-claim step no longer depends on a
    caller correctly requesting a lock

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in MILESTONES_V1_MCP.md is NOT
  applicable here (M-MCP.3 stays unchecked until T-003 and T-004 also ship),
  IMPLEMENTATION_NOTES.md updated (replacing the existing row-lock note with
  the new claim mechanism), a CHANGELOG.md entry under [Unreleased], morning
  report written.
