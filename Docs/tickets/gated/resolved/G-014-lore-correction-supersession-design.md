# G-014 — Lore correction / supersession design

Gate type: 🧠 strategy

Milestone ref: M-CANON

Opened: 2026-07-29 — by Alex during the conversation that drafted
  `Docs/milestones/MILESTONES_V1_3_MCP.md`

Context files (load ONLY these):
  - packages/mcp/src/tools/append-entity-note.ts (existing additive-only note write — direct append to `entities.description`, no conflict resolution)
  - packages/mcp/src/tools/ingest-text tool + packages/core/src/db/schema/tables.ts `chunks`/`sources` tables (independent chunk/embed on ingest, no versioning)
  - packages/core/src/services/context.service.ts (`query_lore`'s hybrid search — vector + pg_trgm, no supersession filter today)
  - Docs/tickets/gated/resolved/G-001-write-tool-preview-confirm-scope.md (resolved rule: preview/confirm applies to mutations of *existing* data, not additive-only writes — governs whether a correction tool needs the `write_requests` preview/confirm flow)
  - packages/mcp/src/tools/log-session.ts / confirm-log-session.ts (the one existing preview→confirm pattern via `write_requests`, to mirror for a correction tool)

Open question: Neither `append_entity_note` nor `ingest_text` edits or
  retires existing source chunks, so a canon correction only ever adds a
  new fact alongside the old one — `query_lore`'s hybrid search can and
  will still surface the superseded/conflicting text right next to it.
  Two sub-decisions needed: (1) how is a correction issued — a new
  dedicated tool, or an optional field on an existing tool; (2) what
  happens to the superseded content in storage/retrieval — flagged and
  filtered, or edited/deleted outright.

Blocks: M-CANON (this milestone's own task list)

Notes: none — resolved in the same conversation it was opened in.

## Resolution (2026-07-29)

Resolved live with Alex, no separate `/ungate` session needed.

**Correction interface: a new dedicated tool, `correct_lore`.** Takes a
correction statement plus a reference to what it supersedes (entity id,
source id, or explicit chunk id(s)). Kept separate from
`append_entity_note` (still additive-only, no conflict semantics) and
`ingest_text` (still independent document ingestion) rather than
overloading either with correction semantics.

**Supersession model: soft-supersede flag, excluded from default
`query_lore` results.** The superseded chunk stays in the `chunks` table
tagged superseded (pattern-matched against the existing `status` text
column on `sources`/`sessions` — `chunks` gets its own status-style
column, not a boolean, per `.claude/rules/db.md` indexing requirements).
`query_lore`'s vector search (`search.service.ts`) and pg_trgm keyword
search (`context.service.ts`) both need the exclusion threaded into their
`where` clauses. History is not deleted — recoverable/inspectable later
if a "what did we used to think" need shows up, but that surfacing UI is
explicitly not scoped into M-CANON.

**Preview/confirm: required.** Per `G-001`'s resolved rule, marking prior
chunks superseded is a mutation of existing data, not an additive write —
`correct_lore` goes through the same `write_requests` preview→confirm
pattern `log_session`/`confirm_log_session` already use (a
`confirm_correct_lore` companion tool, atomic claim + apply).

Ticketed via `ticket-writer` against `Docs/milestones/MILESTONES_V1_3_MCP.md`
Milestone M-CANON.
