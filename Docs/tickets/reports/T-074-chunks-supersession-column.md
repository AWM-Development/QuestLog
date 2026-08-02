# T-074 — Supersession column on `chunks`

**Outcome:** shipped
**Branch:** feat/m-canon/t-074-chunks-supersession-column
**Diff:** 6 files changed, +1324/-0 lines (mostly the Drizzle `0014_snapshot.json`)
**Complexity tier:** not present in ticket (predates T-050's complexity-tier format)
**Strategy-gate flag:** not present in ticket (predates T-050's format) — no unresolved 🧠 gate encountered during this run

## What shipped

`chunks` gained a `status` text column defaulting to `"active"` and a btree index `chunks_status_idx`, via journaled migration `0014_cynical_power_pack.sql`. Fresh inserts get `"active"` from the DB default without callers setting it. No service/tool reads or writes the column yet.

## Test evidence

```
$ bash scripts/run-tests-quiet.sh
lint: pass (0 warnings)
typecheck: pass
test: pass (665 passed)
```

Per-package Vitest totals from `tmp/test-logs/test.log`:

```
@questlog/observability:test:  Test Files  2 passed (2)
@questlog/observability:test:       Tests  12 passed (12)
@questlog/server:test:  Test Files  14 passed (14)
@questlog/server:test:       Tests  103 passed (103)
@questlog/web:test:  Test Files  46 passed (46)
@questlog/web:test:       Tests  262 passed (262)
@questlog/core:test:  Test Files  27 passed (27)
@questlog/core:test:       Tests  244 passed (244)
@questlog/mcp:test:  Test Files  2 passed (2)
@questlog/mcp:test:       Tests  44 passed (44)
 Tasks:    6 successful, 6 total
```

Focused schema tests after migration applied:

```
$ pnpm --filter @questlog/core exec vitest run src/db/schema/chunks.test.ts
 ✓ src/db/schema/chunks.test.ts (4 tests) 71ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Exit condition check

- **all tests green, typecheck clean, lint clean** — verified via `scripts/run-tests-quiet.sh` (lint 0 warnings, typecheck pass, 665 tests passed). See evidence above.
- **`pnpm --filter @questlog/server db:migrate` applies the new migration without error** — applied cleanly against worktree Postgres (`:5587`) and primary `:5433` for `questlog` / `questlog_test_core` / `questlog_test_server` / `questlog_test_mcp` (ticket's `questlog_test` name maps to the per-package DBs from T-071). `\d chunks` on `questlog_test_core` shows `status text NOT NULL DEFAULT 'active'::text` and `chunks_status_idx`.
- **Drizzle select of `chunks.status` for a freshly-inserted chunk returns `"active"` without setting it** — covered by `packages/core/src/db/schema/chunks.test.ts` (`defaults status to "active" when not set on insert`). Index presence covered by `has a btree index on status`.

## Reviewer verdict

PASS

(verbatim from reviewer:)

> Diff reviewed against Scope, Out of scope, and Exit condition.
>
> **1. Pattern deviation — `db.md` rules**
> Migration is journaled (SQL + `_journal.json` entry, no `drizzle-kit push`). Snapshot committed alongside. Column definition `text("status").notNull().default("active")` at `packages/core/src/db/schema/tables.ts:211` is a pixel-perfect copy of the `sources.status` pattern the ticket points to. Index uses `btree`, consistent with every other non-GIN index in the table. No violations.
>
> **2. Functionality gaps vs. Scope**
> All three scope items delivered: `status` column, `chunks_status_idx`, journaled migration `0014_cynical_power_pack.sql` + journal + snapshot. No out-of-scope files appear in the diff.
>
> **3. Test quality**
> Insert-without-status + re-select asserts `"active"` — real DB default round-trip. Index test queries `pg_indexes` for `chunks_status_idx`. Thin but not theater.
>
> **4. Scope creep** — none.
> **5. DRY within the diff** — none.
> **6. Comment discipline** — no new comments.
>
> PASS

## Efficiency notes

Tight run. Ticket scope was a single schema+migration checkpoint; context files were exactly what was needed. One environment hiccup: first `scripts/run-tests-quiet.sh` failed because turbo strips `QUESTLOG_PG_PORT`, so tests hit primary `:5433` which hadn't been migrated yet (worktree `:5587` was already migrated). Already documented under T-072 — fixed by also migrating `:5433`, not by changing turbo. No product-logic retries.

**Retry log:** 1 retry: 1 `environment_setup` (turbo-filtered `QUESTLOG_PG_PORT` → unmigrated `:5433` on first full suite run).

## Anything Alex must decide

None on product scope. Ticket predates T-050's Complexity tier / Strategy-gate flag fields — echoed as absent above. Left `review-chore` / `review-feat` worktrees untouched during Step 1 reap (their HEAD is `develop`; `gh pr view develop` returning MERGED is not a trustworthy feature-branch signal).

**Usage capture:** `capture-usage` skipped — no stdin payload and no `CLAUDE_CODE_SESSION_ID` (this run is Cursor `/executor`, not Claude Code). No `Docs/tickets/cost-reports/T-074.usage.json` produced.
