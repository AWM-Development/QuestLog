# T-074 — Supersession column on `chunks`

Milestone ref: Docs/milestones/MILESTONES_V1_3_MCP.md M-CANON.1

Priority: P1

Branch: feat/m-canon/t-074-chunks-supersession-column

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`chunks` table def, lines ~199-226; `sources.status` at line 184 is the pattern to mirror)
  - .claude/rules/db.md (migration workflow — journaled migration required, no `drizzle-kit push`; GIN trgm index rule)
  - packages/core/src/services/search.service.ts (current `chunks` query shape, for awareness of what T-077 will later filter — not touched by this ticket)

Mockup: none

Model: sonnet

Scope: Add a `status` text column to `chunks` (mirroring `sources.status`'s shape: `text("status").notNull().default("active")`), plus a btree index on it (`chunks_status_idx`), so a chunk can be marked `superseded` without deleting it. Generate the journaled Drizzle migration (`drizzle-kit generate`) and commit both the SQL file and the `_journal.json` entry. Run the migration against the local dev/test DB and confirm it applies cleanly.

Out of scope: Any tool or service that sets/reads this column (T-075/T-076/T-077) — this ticket only adds the column and its index. Do not touch `query_lore`/`search.service.ts`/`context.service.ts` filtering logic here.

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm --filter @questlog/server db:migrate` applies the new migration against a fresh `questlog_test` DB without error
  - a Drizzle query selecting `chunks.status` for a freshly-inserted chunk returns `"active"` (the default) without any code needing to set it explicitly

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_3_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
