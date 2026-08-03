# T-108 — `runner` dimension on `ticket_runs`

Milestone ref: M-PIPELINE.12 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-pipeline/t-108-ticket-runs-runner-dimension

Context files (load ONLY these):
  - packages/observability/src/schema/tables.ts
  - packages/observability/src/db/migrate.ts
  - Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md § Resolution (Q1)

## Relevant background
excerpted from `Docs/tickets/gated/resolved/G-020-pipeline-audit-and-improvement.md` § Notes, as of 2026-08-02

**3. Usage capture is the only component with no runner-neutral
equivalent.** `capture-usage.ts` resolves its input from
`CLAUDE_CODE_SESSION_ID` plus `~/.claude/projects/**/<session>.jsonl`, and
`pricing.ts` prices Claude tokens. Other runners expose session-level cost
in their own unit (Devin: ACUs) with no transcript and no token/cache
breakdown, so `turns_to_green`, `human_message_count` and the
reviewer-subagent split have no direct analogue. Mixing units into one
`ticket_runs` series would silently corrupt the very thing `M-OBS` exists to
measure; the honest options are a `runner` dimension with per-runner views,
or accepting that only Claude-run tickets carry cost data.

Mockup: none

Model: sonnet

Scope: Add a nullable `runner` text column to `ticketRuns`
  (`packages/observability/src/schema/tables.ts`), following the file's own
  established "nullable placeholder column for a not-yet-shipped field"
  pattern (see `complexityTier`/`filesChanged` on the same table). Generate
  the matching Drizzle migration. Backfill: a migration-time `UPDATE
  ticket_runs SET runner = 'claude-code' WHERE runner IS NULL` for existing
  rows — every row ingested to date came from a Claude Code run, and leaving
  them `NULL` would make "how many Claude runs exist" a `runner IS NULL OR
  runner = 'claude-code'` query forever instead of a plain equality one.
  `ingest.ts`'s upsert path defaults new rows to `'claude-code'` when no
  value is supplied, so today's ingestion (which never sets this field) keeps
  working unchanged.

Out of scope: Building the actual adapter that would populate `'devin'` (or
  any non-Claude value) — that's `T-109`, blocked on this ticket. Any UI/API
  surfacing of the new column (`M-OBS.4`/`M-OBS.5`'s existing tickets own
  that once this field has real data in it).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `ticketRuns` has a `runner` column (nullable at the schema level, but a
    migration test confirms every pre-existing row and every newly-inserted
    row via `ingest.ts`'s default path reads back `'claude-code'`, never
    actually `NULL`, post-migration)
  - `pnpm --filter @questlog/observability db:migrate` runs clean against a
    fixture database seeded with pre-migration rows

Iteration cap: 2 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_1_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
