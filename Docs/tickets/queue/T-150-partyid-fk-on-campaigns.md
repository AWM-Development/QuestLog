# T-150 — `partyId` column on `campaigns`

Milestone ref: M-PARTYMODEL.1 (`Docs/milestones/MILESTONES_V1_7_MCP.md`)

Complexity tier: S

Strategy-gate flag: yes

Priority: P2

Branch: feat/m-mcp/t-150-partyid-fk-on-campaigns

Context files (load ONLY these):
  - packages/core/src/db/schema/tables.ts (`campaigns` table, lines ~47-61; `entities.sourceId` at lines ~100 is the closest precedent for a bare nullable-uuid column shape — note `campaigns` gets no `.references()` call, since there is no `parties` table)
  - packages/core/src/db/migrations/0016_normal_guardian.sql (most recent nullable-column migration, for format — note it also adds an FK constraint line that this ticket's migration must NOT include, since `partyId` isn't a foreign key)
  - packages/core/src/db/migrations/meta/_journal.json (append new entry here, matching every prior entry's shape)
  - packages/mcp/src/tools/campaign-scoping.test.ts (existing campaign-isolation test suite — must stay green unmodified, proving the new column changes no read's behavior)

## Relevant background
excerpted from `Docs/IMPLEMENTATION_NOTES.md` § G-024, as of 2026-08-07

**Party as a real parent of campaigns, not a tag.** Decided but not yet built: a future `partyId` FK belongs on `campaigns` (nullable, optional) so a group's later campaign can join back to an earlier one's lore — a shared label on entities/sessions can't deliver that on its own. Existing reads stay `campaignId`-scoped by default; cross-campaign access, when built, should be an opt-in search-time join, not copy/import. Full rationale: `Docs/tickets/gated/resolved/G-024-campaign-source-party-conceptual-model.md`.

Mockup: none

Model: sonnet

Scope: Add a nullable `party_id` (uuid) column to `campaigns` in `packages/core/src/db/schema/tables.ts`, with a corresponding `drizzle-kit generate`-produced migration SQL file plus its `_journal.json` entry. The column carries **no FK constraint** — there is no `parties` table (per G-024's resolution, a party is just a shared UUID value campaigns can optionally carry in common; promoting it to a dedicated table is explicitly future work, not this ticket's scope). No index is needed yet — nothing queries by `partyId` in this ticket. This is schema-only: no service, router, or MCP tool reads or writes the column in this ticket.

Out of scope: Any `parties` table. Any query, service method, or MCP tool that reads/writes/filters by `partyId` (that's the future "include party history" work G-024 explicitly deferred). Any index on the new column (add one only when a query actually needs it). Backfilling existing campaigns with a party value (column stays `NULL` for everything that exists today).

Exit condition (machine-checkable):
  - all tests green, typecheck clean, lint clean
  - `pnpm --filter @questlog/server db:migrate` applies the new migration cleanly against a freshly seeded test DB with no manual intervention
  - `packages/mcp/src/tools/campaign-scoping.test.ts` and every other existing campaign/entity test pass unmodified — proof the new column is inert (no query anywhere references it yet)

Iteration cap: 3 distinct approaches on any single failure, then Blocked Protocol

Definition of done includes: checkbox flipped in Docs/milestones/MILESTONES_V1_7_MCP.md,
  IMPLEMENTATION_NOTES.md updated if any non-obvious decision was made,
  a CHANGELOG.md entry under [Unreleased], morning report written.
