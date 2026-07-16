# T-007 — Harden `write_requests` confirm() against concurrent double-apply and caller misuse

**Outcome:** shipped
**Branch:** feat/m-mcp/t-007-harden-write-request-confirm
**Diff:** 8 files changed, +968/-21 lines

## What shipped

`writeRequestService.confirm()` no longer enforces its single-use guarantee with a `SELECT ... FOR UPDATE` row lock held across the caller-supplied `applyFn`. It now claims the row via a single atomic conditional `UPDATE ... WHERE claimed_at IS NULL AND confirmed_at IS NULL AND expires_at > now() RETURNING *` (a new nullable `claimed_at` column, migration `0008`) before `applyFn` runs, runs `applyFn` in its own transaction with no lock held, and clears `claimed_at` (not `confirmed_at`) on failure so the token stays retryable. The `forUpdate` option and its lock-conditional branch are entirely gone from `findPendingRow`.

## Test evidence

```
> @questlog/server@0.0.0 lint
> biome check .
Checked 72 files in 116ms. No fixes applied.
(all 4 packages: mcp, shared, server, web — 4 successful, 4 total)

> @questlog/server@0.0.0 typecheck
> tsc -b
(all 4 packages: mcp, shared, server, web — 4 successful, 4 total)

> @questlog/server@0.0.0 test
> vitest run write-request

 ✓ src/services/write-request.service.test.ts (9 tests) 277ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Full monorepo suite (`pnpm test`, run earlier in this session before the docs commit): server 229/229, web 262/262, mcp 13/13 — all passed, 0 failures.

## Exit condition check

- **all tests green, typecheck clean, lint clean — pasted output, not a summary**: see Test evidence above.
- **existing cross-connection concurrency test still passes: exactly one of two genuinely concurrent `confirm()` calls on the same token succeeds, the other throws `NotFoundError`, `applyFn` is called exactly once total**: unchanged test at `write-request.service.test.ts` `describe("concurrent confirm calls on the same token")` passes — the atomic claim `UPDATE` serializes the two racing claims at the Postgres row level, so only one gets a non-empty `.returning()`.
- **existing "applyFn throws → row stays unconfirmed → retry succeeds" test still passes**: unchanged, passes. Additionally added a new test asserting `claimed_at` (not just `confirmed_at`) is cleared to null after failure, directly covering the ticket's stated mechanism.
- **`grep` confirms `forUpdate` and any lock-conditional branch in `findPendingRow` (or its replacement) no longer exist anywhere in `write-request.service.ts`**: `grep -n "forUpdate\|for(\"update\")\|\.for(" apps/server/src/services/write-request.service.ts` returns no matches (exit code 1).

Also added a new test (`describe("claim step")`) that observes `claimed_at`/`confirmed_at` mid-`applyFn` via a dedicated second DB connection (required since `createTestDb()` uses a single-connection pool), proving the claim is set before `applyFn` runs and independent of the confirm transaction — this wasn't in the ticket's explicit exit condition list but directly exercises the new mechanism's core property.

## Reviewer verdict

**PASS**, verbatim from the reviewer subagent:

> All checks pass. Details:
>
> 1. **Behavioral guarantees preserved** — `apps/server/src/services/write-request.service.ts:49-64` implements the atomic conditional claim exactly as the ticket sketched. Guarantee (a): two concurrent `confirm()` calls race on the single `UPDATE ... WHERE claimed_at IS NULL AND confirmed_at IS NULL AND expires_at > now()`; Postgres serializes the row-lock acquisition and re-evaluates the WHERE predicate under READ COMMITTED for the loser, so only one call gets a non-empty `.returning()`. Guarantee (b): `write-request.service.ts:75-83` clears `claimedAt` (not `confirmedAt`) in the catch block, leaving the row reclaimable.
> 2. **Atomicity is genuine, not a subtle race** — this is the standard Postgres claim-row pattern (single UPDATE statement is its own implicit transaction; concurrent UPDATEs on the same row serialize and the second re-checks its WHERE clause against the post-commit row state). No window where both callers can see `claimed_at IS NULL` simultaneously.
> 3. **`forUpdate` fully removed** — confirmed via grep across `apps/server/src` and `apps/mcp/src`; zero matches. `findPendingRow` (`write-request.service.ts:87-101`) is now a plain `db`-only helper used only by `getPending`, no lock option remains.
> 4. **`getPending` unchanged** — `write-request.service.ts:35-38` untouched; `findPendingRow` still ignores `claimedAt` for that path, matching pre-existing behavior where a concurrent in-flight confirm wouldn't affect a plain `getPending` read (since `confirmedAt` isn't set until the applyFn transaction commits, same as before).
> 5. **Test quality is solid, not theater**: [new "clear on failure" test, new "claim step" test using a genuinely separate pooled connection, original concurrency/retry tests untouched and still assert exactly what the ticket requires].
> 6. **No scope creep** — `git diff --stat` against `apps/mcp` and `packages/shared` is empty; `createPreview`/`getPending` source is byte-identical to `develop`.
> 7. **IMPLEMENTATION_NOTES.md and CHANGELOG.md are updated** — present in commit `11fbef4` on the branch, matching the shipped code exactly. This satisfies the ticket's Definition of Done item.
>
> Migration follows the journal-only workflow from `.claude/rules/db.md` correctly — no `drizzle-kit push` residue, journal entry appended in order.
>
> No findings rise to a concern.
>
> PASS

## Anything Alex must decide

None. Per the ticket, the `MILESTONES_V1_MCP.md` checkbox is intentionally not flipped — M-MCP.3 stays unchecked until T-003 and T-004 also ship.
