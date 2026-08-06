# T-132 — Bootstrap architecture & pattern drift audit — Report

**Date:** 2026-08-06
**Run type:** Interactive session with Alex (per ticket's own "NOT ELIGIBLE FOR
AUTONOMOUS NIGHTLY EXECUTION" banner), executed on Sonnet at Alex's explicit
direction rather than Fable/Opus.
**Scope:** Full-history audit spanning `MILESTONES_V1_MCP.md` through
v1.4-to-date, per the ticket's 7 dimensions.

## Summary

3 findings substantive enough to file as follow-up tickets (`T-134`,
`T-135`, `T-136`, all landed in `Docs/tickets/backlog/`). 2 trivial fixes
applied inline in this branch. 4 of the 7 dimensions came back clean —
no findings beyond what's noted below.

---

## 1. Cross-service/tool pattern consistency

**Clean, with one cross-cutting note (→ `T-134`).**

- All 22 MCP tools (`packages/mcp/src/tools/*.ts`) wrap their handlers in
  `withToolErrors`; all 7 tRPC routers (`apps/server/src/routers/*.ts`)
  wrap theirs in `withErrorHandling`. No one-off error handling found.
- `packages/mcp/src/server.ts`'s tool registration list is a 1:1 match
  against every file under `packages/mcp/src/tools/` — no orphaned
  registration, no tool file missing a `register*` call.
- Every tool's `description` is imported from
  `packages/mcp/src/content/tool-descriptions.ts` as documented —  zero
  inline description string literals found.
- Campaign-scoping (`.claude/rules/mcp.md` § "Campaign-scoped ID
  lookups"): `entityService.getById(db, campaignId, entityId)` is called
  correctly-scoped from every MCP tool that reaches it
  (`get-entity.ts`, `archive-entity.ts`, `unarchive-entity.ts`,
  `update-entity.ts`, `confirm-update-entity.ts`). The two services with
  an `Unscoped` bare-id method (`sourceService.getByIdUnscoped`) are only
  ever called from trusted-internal service code
  (`import.service.ts`), never directly from an MCP tool handler —
  correct per the rule. `campaignService.getById`/`sessionService.getById`
  are bare-id but are never reached from an MCP tool handler with an
  untrusted external id either (both are only called from tRPC routers) —
  not a violation, just worth noting they'd need the same treatment if an
  MCP tool ever calls them directly by id.
- **Finding → `T-134`:** `.claude/rules/backend.md` documents Anthropic
  test mocking as "a DI'd client... `createLlmService(client?)`," but
  `createLlmService`'s optional parameter is never actually exercised
  anywhere in the codebase — the sole call site is the parameterless
  `llmService = createLlmService()` singleton, and
  `llm.service.test.ts` instead mocks the whole `@anthropic-ai/sdk`
  module via `vi.mock(...)`. Not a rule *violation* (no live network call
  in the default test tier either way), but the documented mechanism and
  the actual mechanism are two different things. Filed rather than fixed
  inline since which direction to reconcile it is a real judgment call.

## 2. Rules-file accuracy

**One stale reference found and fixed inline; one drift finding filed as
`T-134` (shared with Dimension 1 above, not double-filed).**

- **Fixed inline:** `.claude/rules/backend.md:36` (and its Cursor mirror,
  `.cursor/rules/backend.mdc:36`) described a single `questlog_test`
  database as the test DB. The actual, current convention since `T-071`
  is a per-package physical database
  (`questlog_test_core`/`_server`/`_mcp`/`_observability`, canonical list
  in `scripts/test-db-names.sh`) — already correctly documented in
  `.claude/rules/db.md` § "Test database," just never updated in
  `backend.md` when the split landed. Both files now describe the
  per-package scheme and point at `db.md` as the canonical list rather
  than risk a second copy going stale independently.
- Checked the other 4 rules files (`db.md`, `mcp.md`, `frontend.md`,
  `scripts.md`) against their `.cursor/rules/*.mdc` mirrors — bodies
  match exactly (an initial diff pass flagged `frontend.mdc`/`scripts.mdc`
  as mismatched, but that was a false positive from differing
  frontmatter line counts between the two frontmatter schemas, not real
  content drift).
- `.claude/rules/mcp.md`'s tool-shape, write-tool preview/confirm scope,
  and agent-interaction-philosophy sections all checked out against
  current code (verified in Dimension 1 above).
- `CLAUDE.md`'s task-source list (stops at v1.4) is correct as of today —
  `MILESTONES_V1_5_MCP.md`/`_V1_6_`/`_V1_7_` all exist but each
  explicitly self-declares "Not yet a task source `CLAUDE.md` points to"
  in its own Status line (all fully gated, no task list yet). Not drift.
- Did not find any rules-file section describing a pattern the code has
  since abandoned, beyond the `questlog_test` case above.

## 3. Dead / deprecated code

**No genuinely orphaned code found via targeted spot-checks; tooling gap
noted → `T-135`.**

- Confirmed the v2-deferred web surfaces
  (`apps/web/src/features/agent-chat/`,
  `apps/web/src/features/session-log/`) match
  `.claude/rules/frontend.md`'s "v2-deferred surfaces stay as-is" list,
  and `router.tsx` still routes them — intentional per
  `MILESTONES_V1_MCP.md`'s "Already-shipped v2 surfaces... remain in the
  repo untouched." Not debt.
- Spot-checked a plausible dead-code candidate by name
  (`EmberPlaceholder.tsx`, which coincidentally shares a name with the
  deferred-to-v2 "mascot (Ember)" milestone item, 8.1–8.3) — it's
  actively imported and rendered in
  `features/sources/components/import/ImportQueueItem.tsx`, part of the
  kept `SourcesPage` tree. Not dead.
- A first-pass automated sweep (grepping each file's basename against
  the rest of the tree) produced unreliable results — it flagged nearly
  every file in `apps/web/src` as "possibly orphaned," which is itself
  evidence the heuristic was broken (import-path/extension mismatches),
  not evidence of real dead code. No `ts-prune`/`knip`-equivalent tool
  exists in the repo to do this reliably.
- **Filed `T-135`** rather than continuing to hand-verify ~106 frontend
  files one at a time: add real dead-code detection tooling so this
  dimension is actually checkable (by a human or by `/drift-audit`'s
  future runs) instead of relying on an ad hoc grep script.

## 4. `IMPLEMENTATION_NOTES.md` hygiene

**No urgent issues; no ticket filed.**

- Skimmed all 65 section headers (1073 lines total). No section found
  that directly contradicts current code behavior beyond the
  already-noted `questlog_test` naming (Dimension 2).
- The recurring nested-transaction gotcha (`db.transaction()` not
  composing with a `BEGIN`/`ROLLBACK` test wrapper) — which shows up at
  three separate notes (`conversation.service.ts`, `context.service.ts`
  via keywordSearch, and originally `write-request.service.ts`) — has
  already been promoted into an actual rule
  (`.claude/rules/backend.md` § "Test DB pattern," the
  `deleteCampaignTree()` guidance). This is the exact "recurred more than
  once → turn into a rule" pattern Dimension 4 asks to check for, and
  it's already been done correctly. No gap.
- The pre-pivot frontend notes ("Component directory organization,"
  2026-04-24; "Session notes (Milestone 4.5) — UI Component Library
  Refactor") are old but not stale or contradicted — they document *why*
  the current `apps/web/src/components/` by-kind structure exists, and
  `frontend.md`'s "Component-first" section still accurately describes
  that same structure today. Kept as decision-log context rather than
  flagged for archival. Given their age, though, this doc as a whole is
  a reasonable candidate for a routine pass through the existing
  `archive-implementation-notes` skill (not filed as a new ticket — that
  skill already exists and doesn't need a ticket to invoke).

## 5. Ticket-pipeline health

**One stale `Blocked on:` line fixed inline; ticket-numbering gap
explained (no action needed).**

- **Fixed inline:** `Docs/tickets/backlog/T-115-wire-enforcement-guards-into-preflight.md`'s
  `Blocked on:` line listed `T-110, T-111, T-112, T-113, T-114`, but
  `T-110` shipped (`Docs/tickets/done/T-110-ci-gate-guard.md`). Trimmed
  to `T-111, T-112, T-113, T-114` with a note pointing at the done file.
- Checked every other `backlog/` ticket's `Blocked on:` line
  (`T-057`, `T-058`, `T-106`, `T-109`, `T-119`, `T-123`) — every named
  dependency is still genuinely open in `queue/`. No other stale
  references found.
- Ticket numbering gap at `T-128`/`T-129`: not a real gap — both numbers
  were claimed then renumbered after real collisions with concurrently-
  filed tickets from other sessions, per
  `Docs/tickets/gated/resolved/G-035-prewarmed-sandbox-environment-investigation.md`'s
  own resolution note (`T-127`→`T-130`, `T-126`→`T-128`, both
  documented at filing time). Already self-explained; no action needed.
- No ticket found whose scope has been silently superseded by later work
  beyond `T-132` itself superseding `T-017` (the worked example the
  ticket's own Scope asked to note as precedent — recorded here).

## 6. Test-suite hygiene

**Clean.**

- No test file outside the `*.e2e.test.ts` tier makes a real network
  call — checked every `*.test.ts` under `packages/core/src/services/`,
  `packages/mcp/src/`, and `apps/server/src/` for `globalThis.fetch`/
  `await fetch(...)` usage with no match. The four files that don't use
  `vi.mock`/`fetchFn`/`createTestDb` (`chunking.service.test.ts`,
  `extraction.service.test.ts`, `campaign-scoping.test.ts`,
  `tool-descriptions.test.ts`) are pure unit tests with no DB or network
  dependency at all — nothing to mock.
- Voyage tests inject `fetchFn` per the documented pattern
  (`embedding.service.test.ts`); Anthropic tests use module-level
  `vi.mock` instead (see Dimension 1/2's `T-134` finding — a convention
  mismatch, not a live-network violation).
- Tool coverage: all 22 registered MCP tool names appear in
  `packages/mcp/src/server.test.ts`'s integration suite. No tool found
  without at least one test referencing its name.

## 7. Schema/migration hygiene

**Clean — no repeat of the `entities_name_trgm_idx` class of bug.**

- Cross-checked all 13 named indexes in
  `packages/core/src/db/schema/tables.ts` against
  `CREATE INDEX` statements across every file in
  `packages/core/src/db/migrations/*.sql` — 1:1 match both directions,
  no index defined in one place and missing from the other.
  (`chunks_campaign_id_idx`, `chunks_content_trgm_idx`,
  `chunks_embedding_hnsw_idx`, `chunks_status_idx`,
  `conversations_campaign_id_idx`, `entities_campaign_id_idx`,
  `entities_name_trgm_idx`, `entity_relationships_campaign_id_idx`,
  `mcp_oauth_codes_client_id_idx`, `mcp_oauth_tokens_client_id_idx`,
  `sessions_campaign_id_idx`, `sources_campaign_id_idx`,
  `write_requests_campaign_id_idx`.)
- The one `UNIQUE` constraint in `tables.ts`
  (`mcp_oauth_tokens.refreshToken`) has a matching
  `CONSTRAINT ... UNIQUE("refresh_token")` in its migration
  (`0013_pretty_wendell_rand.sql`).
- Migration journal (`meta/_journal.json`, 17 entries) matches the
  physical migration file count (17 `.sql` files) exactly — no orphaned
  journal entry, no un-journaled SQL file on disk.

---

## Trivial inline fixes (this branch's diff)

1. `.claude/rules/backend.md` + `.cursor/rules/backend.mdc` — corrected
   the stale single-`questlog_test` reference to the actual per-package
   test-database scheme.
2. `Docs/tickets/backlog/T-115-wire-enforcement-guards-into-preflight.md`
   — dropped the shipped `T-110` from its `Blocked on:` line.

## Filed tickets (all in `Docs/tickets/backlog/`, awaiting Alex's review
before promotion — none auto-promoted per this ticket's own
Out-of-scope note)

- **`T-134`** — Reconcile `llm.service.ts`'s DI factory with how its
  tests actually mock Anthropic (Dimension 1/2).
- **`T-135`** — Add automated unused-export/dead-code detection tooling
  (Dimension 3).
- **`T-136`** — Re-audit `MILESTONES_V1_MCP.md`'s "Deferred to v2" table
  against current v1 shape — the table's own long-standing "flagged for
  a future pass" note, still open (Dimension 2/5).

## Supersession precedent (per Scope's request)

This ticket (`T-132`) supersedes `T-017-architecture-pattern-audit.md`
outright rather than amending it a second time, moved to
`Docs/tickets/archive/`. Recorded here as the worked example for how a
future supersession should be handled: retire the old ticket to
`archive/`, note the supersession in the new ticket's own header (T-132
already did this at draft time), and don't carry forward a stale
context-file list that's been widened twice already.

## `DRIFT_AUDIT_STATE.md`

Seeded at this run's completion commit — see
`Docs/tickets/DRIFT_AUDIT_STATE.md`, format per `T-133`'s Scope.

## Sign-off

Awaiting Alex's review before any of `T-134`/`T-135`/`T-136` gets
promoted toward `queue/`.
